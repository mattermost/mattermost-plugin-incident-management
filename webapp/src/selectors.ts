// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {createSelector} from 'reselect';

import {GlobalState} from 'mattermost-redux/types/store';
import {getLicense} from 'mattermost-redux/selectors/entities/general';
import {getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';

import {pluginId} from './manifest';
import {Incident} from './types/incident';
import {Playbook} from './types/playbook';

const pluginState = (state: GlobalState) => state['plugins-' + pluginId] || {};
const allIncidents = (state: GlobalState) => pluginState(state).incidents;
export const incidentsTeamId = (state: GlobalState) => pluginState(state).incidentsTeamId;

export const activeIncidents = createSelector(allIncidents,
    (incidents) => {
        const list = incidents ? incidents.filter((incident: Incident) => incident.is_active) : [];
        return sortedDescending(list);
    },
);

const sortedDescending = (incidents: Incident[]) => {
    return incidents.sort((a, b) => {
        return b.created_at - a.created_at;
    });
};

export const incidentDetails = (state: GlobalState) => {
    return pluginState(state).incidentDetails || {};
};

export const selectToggleRHS = (state: GlobalState) => pluginState(state).toggleRHSFunction;

export const rhsState = (state: GlobalState) => pluginState(state).rhsState;

export const workflowsRHSOpen = (state: GlobalState) => pluginState(state).rhsOpen;

export const isLoading = (state: GlobalState) => pluginState(state).isLoading;

export const clientId = (state: GlobalState) => pluginState(state).clientId;

const playbooks = (state: GlobalState): Record<string, Playbook[]> => {
    return pluginState(state).playbooks;
};

export const playbooksForTeam = createSelector(
    [playbooks, getCurrentTeamId],
    (pbooks, teamId: string) => {
        return sortPlaybooksByTitle(pbooks[teamId]);
    },
);

const sortPlaybooksByTitle = (pbooks: Playbook[]) => {
    if (!Array.isArray(pbooks)) {
        return [];
    }
    const newPlaybooks = [...pbooks];
    newPlaybooks.sort((a, b) => a.title.localeCompare(b.title));
    return newPlaybooks;
};

export const isExportLicensed = (state: GlobalState) => {
    const license = getLicense(state);

    return license?.IsLicensed === 'true' && license?.MessageExport === 'true';
};
