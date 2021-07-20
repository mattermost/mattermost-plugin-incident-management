import React from 'react';
import {Redirect} from 'react-router-dom';

import {useSelector} from 'react-redux';
import {Team} from 'mattermost-redux/types/teams';
import {getMyTeams} from 'mattermost-redux/selectors/entities/teams';
import {GlobalState} from 'mattermost-redux/types/store';

import PlaybookEdit from 'src/components/backstage/playbook_edit';
import {useAllowPlaybookCreationInCurrentTeam} from 'src/hooks';
import {teamPluginUrl} from 'src/browser_routing';

interface Props {
    currentTeam: Team
}

export const NewPlaybook = (props: Props) => {
    const allowPlaybookCreation = useAllowPlaybookCreationInCurrentTeam();
    const teams = useSelector<GlobalState, Team[]>(getMyTeams);

    function getTeam(teamId: string) {
        return teams.find((team) => team.id === teamId);
    }
    const searchParams = new URLSearchParams(location.search);
    const teamId = searchParams.get('team_id');

    const team = teamId ? getTeam(teamId) : null;

    if (!allowPlaybookCreation) {
        return <Redirect to={teamPluginUrl(team ? team.name : props.currentTeam.name, '/playbooks')}/>;
    }

    return (
        <PlaybookEdit
            currentTeam={team || props.currentTeam}
            isNew={true}
        />
    );
};
