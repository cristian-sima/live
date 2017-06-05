// @flow

type DetailsPropTypes = {
  data: any;
  group: string;
}

import React from "react";
import ReactCSSTransitionGroup from "react-addons-css-transition-group";

import { OptiuneGuvern, OptiuneComisie, Optiune } from "./Optiuni";

import { optiuneNecunoscuta } from "utility";

const hasOption = (raw? : string) => (
  raw !== null &&
  typeof raw !== "undefined"
);

const Details = ({ data, group } : DetailsPropTypes) => {
  const
    cameraDecizionala = data.get("cameraDecizionala"),
    comisie = data.get("comisie"),
    guvern = data.get("guvern"),
    publicVote = data.get("publicVote") || "",
    parties = publicVote.split("|").filter((party) => party !== ""),
    noGuvernSiComisie = typeof comisie === "undefined" && typeof guvern === "undefined";

  return (
    <div>
      {
        hasOption(guvern) ? (
          <OptiuneGuvern
            an={data.get("anGuvern")}
            optiune={guvern}
          />
        ) : null
      }
      {
        hasOption(comisie) ? (
          <OptiuneComisie
            optiune={comisie}
          />
        ) : null
      }
      {
        cameraDecizionala ? (
          <div className="text-center">
            <hr className="hr-sm" />
            {"Vot decizional"}
          </div>
        ) : null
      }
      {
        parties.length > 0 ? (
          <div>
            {
              noGuvernSiComisie ? null : (
                <hr className="hr-sm" />
              )
            }
            <ReactCSSTransitionGroup
              transitionEnterTimeout={700}
              transitionLeaveTimeout={700}
              transitionName="party">
              {
                parties.includes(group) ? (
                  <span>
                    <i className="fa fa-eye text-muted" key={group} />
                    {" "}
                  </span>
                ) : null
              }
              {
                parties.map((party) => {
                  const
                    optiune = data.get(party),
                    doNotDisplay = (
                      typeof optiune === "undefined" ||
                      optiune === null ||
                      party === group ||
                      optiune === optiuneNecunoscuta
                    );

                  if (doNotDisplay) {
                    return null;
                  }

                  return (
                    <Optiune content={`${party} `} inline key={party} optiune={optiune} />
                  );
                })
              }
            </ReactCSSTransitionGroup>
          </div>
        ) : null
      }
    </div>
  );
};

export default Details;
