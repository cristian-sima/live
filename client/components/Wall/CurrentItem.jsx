// @flow

import type { State, Dispatch } from "types";

type CurrentItemPropTypes = {
  account: any;
  item: any;
  showItemDetails: (id : string) => () => void;
};

import React from "react";
import { connect } from "react-redux";
import { Link, withRouter } from "react-router-dom";

import { Optiune } from "./Optiuni";
import Details from "./Details";

import {
  showItemDetailsModal as showItemDetailsModalAction,
} from "actions";

import { getItem, getSelectedItem, getCurrentAccount } from "reducers";

const
  mapStateToProps = (state : State) => {
    const selected = getSelectedItem(state) || "";

    return {
      item    : getItem(state, selected),
      account : getCurrentAccount(state),
    };
  },
  mapDispatchToProps = (dispatch : Dispatch) => ({
    showItemDetails: (id : string) => () => {
      dispatch(showItemDetailsModalAction(id));
    },
  });


class CurrentItem extends React.Component {
  props: CurrentItemPropTypes;

  shouldComponentUpdate (nextProps : CurrentItemPropTypes) {
    return (
      this.props.account !== nextProps.account ||
      this.props.item !== nextProps.item
    );
  }

  render () {
    const
      { item, account, showItemDetails } = this.props;

    if (typeof item === "undefined") {
      return (
        <div className="text-center lead">
          {"Nu se votează niciun proiect încă. Vizualizați "}
           <Link to="/">
            {"Ordinea de zi"}
          </Link>
        </div>
      );
    }

    const
      group = account.get("group");

    const
      id = item.get("_id"),
      project = item.get("project"),
      title = item.get("title"),
      description = item.get("description"),
      groupOption = item.get(group);

    return (
      <div>
        <hr />
        <div className="container">
          <div className="row">
            <div className="col-sm-8">
              <div className="h4 cursor-pointer" onClick={showItemDetails(id)}>
                <Optiune content={project} inline optiune={groupOption} />
              </div>
              <div className="ellipsis-big">
                {title}
              </div>
              <div className="hidden-md-down">
                {
                  description ? (
                    <div>
                      <hr />
                      {description}
                    </div>
                  ) : null
                }
              </div>
            </div>
            <div className="col-sm-4">
              <div className="mt-4 mt-md-0">
                <Details data={item} group={group} />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
}

export default withRouter(connect(mapStateToProps, mapDispatchToProps)(CurrentItem));
