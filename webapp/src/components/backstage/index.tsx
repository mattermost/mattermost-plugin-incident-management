import {bindActionCreators, Dispatch} from 'redux';

import {connect} from 'react-redux';

import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';
import {GlobalState} from 'mattermost-redux/types/store';

import {navigateToTeamPluginUrl} from 'src/actions';
import {navigateToUrl} from 'src/utils/utils';

import {Backstage} from './backstage';

const mapStateToProps = (state: GlobalState): object => {
    const currentTeam = getCurrentTeam(state);

    return {
        currentTeamId: currentTeam.id,
        currentTeamName: currentTeam.name,
        currentTeamDisplayName: currentTeam.display_name,
    };
};

const mapDispatchToProps = (dispatch: Dispatch): object =>
    bindActionCreators({
        navigateToTeamPluginUrl,
    }, dispatch);

export default connect(mapStateToProps, mapDispatchToProps)(Backstage);
