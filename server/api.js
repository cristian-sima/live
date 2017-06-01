/* eslint-disable no-sync, global-require, no-prototype-builtins, max-lines, id-length, no-underscore-dangle, no-mixed-requires, no-magic-numbers, handle-callback-err, max-len, callback-return */

import Q from "q";
import express from "express";
import bodyParser from "body-parser";
import fetch from "node-fetch";
import bcrypt from "bcrypt";

const router = express.Router();

import {
  sessionMiddleware,
  marcaOperator,
  marcaAdministrator,
  requireLogin,
  requireAdministrator,
  performLogin,
} from "./util/auth";

router.use(bodyParser.urlencoded({
  extended: true,
}));

router.use(bodyParser.json());

router.use(sessionMiddleware);

router.post("/auth/login", (req, res) => {

  const { body, db } = req;

  const {
    UserID: {
      Position1,
      Position2,
      Position3,
    },
    Password : RawPassword,
  } = body;

  const marca = Number(`${Position1 || " "}${Position2 || " "}${Position3 || " "}`, 10);

  const error = () => {
    req.session.reset();
    res.json({
      Error: "Datele nu au fost corecte pentru a vă conecta",
    });
  };

  if (isNaN(marca)) {
    error();
  } else {

    const users = db.collection("users");

    const
    findCurrentUser = () => {

      const
      credentials = {
        marca,
      };

      users.findOne(credentials, (err, user) => {

        if (err !== null || !user) {
          error();
        } else {
          const connect = () => {
            req.session.marca = marca;

            res.json({
              Error   : "",
              account : {
                ...user,
                password: "",
              },
            });
          };

          if (user.requireChange) {
            if (user.temporaryPassword === RawPassword) {
              connect();
            } else {
              error();
            }
          } else {
            bcrypt.compare(RawPassword, user.password, (errComparePassword, isPasswordMatch) => {
              if (errComparePassword) {
                error();
              }

              if (isPasswordMatch) {
                connect();
              } else {
                error();
              }
            });
          }
        }
      });
    };

    users.count().then((nrOfUsers) => {

      if (nrOfUsers === 0) {
        const specialAccounts = [{
          marca             : marcaOperator,
          name              : "Operator",
          temporaryPassword : "1234",
          requireChange     : true,
        }, {
          marca             : marcaAdministrator,
          name              : "Administrator",
          temporaryPassword : "1234",
          requireChange     : true,
        }];

        users.insertMany(specialAccounts, (errUsersInsert) => {
          if (errUsersInsert) {
            error();
          }

          findCurrentUser();
        });
      } else {
        findCurrentUser();
      }
    });
  }
});

const
  generateTemporaryPassword = () => {
    const
      min = 1000,
      max = 9999,
      raw = Math.floor(Math.random() * (max - min + 1)) + min;

    return String(raw);
  },
  prepareUser = ({ nume, prenume, marca, grup }, temporaryPassword) => ({
    name  : `${nume} ${prenume}`,
    marca : Number(marca),
    group : grup,
    temporaryPassword,

    requireChange: true,
  });


router.use(performLogin);

router.post("/update-user-list", [requireLogin, requireAdministrator, ({ body, db }, res) => {

  const
    error = (msg) => res.status(503).json({
      Error: msg || "Nu am putut actualiza lista",
    }),
    processData = (serverData) => {

      const
        users = db.collection("users"),
        info = db.collection("info");

      const {
      camera : {
        legislatura: currentSession,
        deputati: newUsers,
      },
    } = serverData;

      const
        insertNewUsers = () => {
          const
            passwords = {},
            preparedUsers = [];

          for (const newUser of newUsers) {

            const { grup } = newUser;

            let temporaryPassword = passwords[grup];

            if (typeof temporaryPassword === "undefined") {
              temporaryPassword = generateTemporaryPassword();
              passwords[grup] = temporaryPassword;
            }

            preparedUsers.push(prepareUser(newUser, temporaryPassword));
          }

          users.insertMany(preparedUsers, (errInsertMany, { ops }) => {
            if (errInsertMany) {
              error();
            } else {
              res.json({
                Error : "",
                Users : ops,
              });
            }
          });
        },
        createSettings = () => {
          info.insert({
            session: currentSession,
          }, (errCreate) => {
            if (errCreate) {
              error();
            } else {
              insertNewUsers();
            }
          });
        },
        prepareForNewSession = () => {
          info.updateMany({}, {
            $set: {
              session: currentSession,
            },
          }, (errUpdate) => {
            if (errUpdate) {
              error();
            } else {
              users.remove({
                marca: {
                  $nin: [marcaOperator, marcaAdministrator],
                },
              }, (errRemove) => {
                if (errRemove) {
                  error();
                } else {
                  insertNewUsers();
                }
              });
            }
          });
        },

        updateUsers = () => {

          const userMap = {};

          for (const newUser of newUsers) {
            userMap[newUser.marca] = newUser;
          }

          const
            promises = [],
            collection = db.collection("users"),
            cursor = collection.find({
              marca: {
                $nin: [marcaOperator, marcaAdministrator],
              },
            });

      // read all docs
          cursor.each((err, currentUser) => {
            if (err) {
              error();
            } else if (currentUser) {

              const newUser = userMap[currentUser.marca];

              if (typeof newUser === "undefined") {
            // nu exista - stergem

            // create a promise to delete the doc
                const promise = Q.npost(collection, "deleteOne", [{ _id: currentUser._id }]);

                promises.push(promise);
              } else {
            // exista - actualizare

                const { nume, prenume, grup } = newUser;

                userMap[currentUser.marca].updated = true;

            // create a promise to update the doc
                const update = {
                  $set: {
                    name  : `${nume} ${prenume}`,
                    group : grup,
                  },
                };

                const promise = Q.npost(collection, "update", [currentUser, update]);

                promises.push(promise);
              }
            } else {

          // close the connection after executing all promises
              Q.all(promises).
          then(() => {
            if (cursor.isClosed()) {
              const
                returnUser = () => {
                  users.find({
                    marca: {
                      $nin: [marcaOperator, marcaAdministrator],
                    },
                  }).
                toArray((errFind, newData) => {
                  if (errFind) {
                    error();
                  } else {
                    res.json({
                      Error : "",
                      Users : newData,
                    });
                  }
                });
                },
                toAddUser = [];


              for (const key in userMap) {
                if (userMap.hasOwnProperty(key)) {
                  const newUser = userMap[key];

                  if (typeof newUser.updated === "undefined") {
                    toAddUser.push(prepareUser(newUser, generateTemporaryPassword()));
                  }
                }
              }

              if (toAddUser.length === 0) {
                returnUser();
              } else {
                users.insertMany(toAddUser, (errInsertMany) => {
                  if (errInsertMany) {
                    error();
                  } else {
                    returnUser();
                  }
                });
              }
            }
          }).
          fail(() => {
            error();
          });
            }
          });
        };

      info.findOne({}, (errFind, settings) => {
        if (errFind) {
          error();
        } else if (settings) {
          if (settings.session === currentSession) {
            updateUsers();
          } else {
            prepareForNewSession();
          }
        } else {
          createSettings();
        }
      });
    };

  fetch("http://www.cdep.ro/pls/caseta/json_internship_deputati").
  then((response) => response.json()).
  then((json) => {
    processData(json);
  }).
  catch(() => {
    error();
  });
}]);

router.get("/user-list", [requireLogin, requireAdministrator, ({ body, db }, res) => {

  const users = db.collection("users");

  users.find({
    marca: {
      $nin: [marcaOperator, marcaAdministrator],
    },
  }).
  toArray((errFind, data) => {
    if (errFind) {
      res.json({
        Error: "Nu am putut prelua lista",
      });
    } else {
      res.json({
        Users : data,
        Error : "",
      });
    }
  });
}]);

router.post("/auth/changePassword", [requireLogin, (req, res) => {

  const { body, db } = req;

  const { password, confirmation } = body;

  const
    error = (msg) => {
      res.json({
        Error: msg || "Datele nu au fost corecte pentru a vă conecta",
      });
    },
    performChange = () => {

      const
        users = db.collection("users"),
        { session : { user } } = req;


      bcrypt.hash(password, 10, (errHasing, hash) => {
        if (errHasing) {
          return error(errHasing);
        }

        return users.update({ _id: user._id }, {
          ...user,
          requireChange     : false,
          password          : hash,
          temporaryPassword : "",
        }, (err) => {
          if (err) {
            return error("Nu am putut efectua operațiunea");
          }

          return res.json({
            Error: "",
          });
        });
      });
    };

  if (confirmation === password) {
    const
      passLength = password.length,
      notGoodLength = passLength < 4 || passLength > 25;

    if (notGoodLength) {
      error("Parola are între 4 și 25 de caractere");
    } else {
      performChange();
    }
  } else {
    error("Parolele trebuie să fie la fel");
  }
}]);

router.post("/auth/signOff", [requireLogin, ({ session }, res) => {
  const
  thereIsASession = (
    typeof session !== "undefined" &&
    typeof session.marca !== "undefined"
  );

  if (thereIsASession) {
    session.reset();
  }

  res.json({
    Error: "",
  });
}]);

router.post("/auth/reconnect", [requireLogin, ({ session, user }, res) => {
  const
  thereIsASession = (
    typeof session !== "undefined" &&
    typeof session.marca !== "undefined" &&
    typeof user !== "undefined"
  );

  if (thereIsASession) {
    res.json(user);
  } else {
    res.status(404).json({
      Error: "",
    });
  }
}]);

export default router;
