// @flow

import { combineReducers } from "redux";
import { reducer as formReducer } from "redux-form/immutable";
import { routerReducer } from "react-router-redux";
import { reducer as notifications } from "react-notification-system-redux";

import auth from "./auth";
import users from "./users";
import list from "./list";

// try to keep them in alphabetic order
const rootReducer = combineReducers({
  auth,
  users,
  list,

  notifications,
  form   : formReducer,
  router : routerReducer,
});

export default rootReducer;
