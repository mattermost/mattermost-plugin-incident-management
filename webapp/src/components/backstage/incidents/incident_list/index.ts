// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators, Dispatch} from 'redux';
import {withRouter} from 'react-router-dom';

import {GlobalState} from 'mattermost-redux/types/store';
import {getUser} from 'mattermost-redux/selectors/entities/users';

import {getIncidentWithDetails, navigateToTeamPluginUrl} from 'src/actions';

import {BackstageIncidentList} from './incident_list';

interface Props {
    currentTeamId: string;
    currentTeamName: string;
}

function mapStateToProps(state: GlobalState, props: Props) {
    return {
        getUser: (userId: string) => getUser(state, userId),
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            getIncidentWithDetails,
            navigateToTeamPluginUrl,
        }, dispatch),
    }
}


export default withRouter(connect(mapStateToProps, mapDispatchToProps)(BackstageIncidentList));
