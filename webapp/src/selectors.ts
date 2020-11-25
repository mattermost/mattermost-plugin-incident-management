// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {createSelector} from 'reselect';

import {GlobalState} from 'mattermost-redux/types/store';
import {GlobalState as WebGlobalState} from 'mattermost-webapp/types/store';
import {getLicense} from 'mattermost-redux/selectors/entities/general';
import {getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';
import {getCurrentChannelId} from 'mattermost-redux/selectors/entities/channels';

import {pluginId} from 'src/manifest';
import {RHSState, RHSTabState} from 'src/types/rhs';
import {Incident} from 'src/types/incident';

//@ts-ignore GlobalState is not complete
const pluginState = (state: GlobalState) => state['plugins-' + pluginId] || {};

export const selectToggleRHS = (state: GlobalState): () => void => pluginState(state).toggleRHSFunction;

export const isIncidentRHSOpen = (state: GlobalState): boolean => pluginState(state).rhsOpen;

export const getIsRhsExpanded = (state: WebGlobalState): boolean => state.views.rhs.isSidebarExpanded;

export const clientId = (state: GlobalState): string => pluginState(state).clientId;

// reminder: myIncidentsByTeam indexes teamId->channelId->incident
const myIncidentsByTeam = (state: GlobalState): Record<string, Record<string, Incident>> =>
    pluginState(state).myIncidentsByTeam;

export const inIncidentChannel = createSelector(
    getCurrentTeamId,
    getCurrentChannelId,
    myIncidentsByTeam,
    (teamId, channelId, incidentMapByTeam) => {
        return Boolean(incidentMapByTeam[teamId]?.[channelId]);
    },
);

export const myActiveIncidentsList = createSelector(
    getCurrentTeamId,
    myIncidentsByTeam,
    (teamId, incidentMapByTeam) => {
        if (!incidentMapByTeam[teamId]) {
            return [];
        }

        // return active incidents, sorted descending by create_at
        return Object.values(incidentMapByTeam[teamId])
            .filter((i) => i.is_active)
            .sort((a, b) => b.create_at - a.create_at);
    },
);

export const isExportLicensed = (state: GlobalState): boolean => {
    const license = getLicense(state);

    return license?.IsLicensed === 'true' && license?.MessageExport === 'true';
};

export const currentRHSState = (state: GlobalState): RHSState => pluginState(state).rhsState;

export const currentRHSTabState = (state: GlobalState): RHSTabState => {
    const channelId = getCurrentChannelId(state);
    return pluginState(state).tabStateByChannel[channelId] || RHSTabState.ViewingSummary;
};

export const lastUpdatedByIncidentId = createSelector(
    getCurrentTeamId,
    myIncidentsByTeam,
    (teamId, incidentsMapByTeam) => {
        const result = {} as Record<string, number>;
        const incidentMap = incidentsMapByTeam[teamId];
        for (const incident of Object.values(incidentMap)) {
            result[incident.id] = findLastUpdated(incident);
        }
        return result;
    },
);

const findLastUpdated = (incident: Incident) => {
    const posts = [...incident.status_posts]
        .filter((a) => a.delete_at === 0)
        .sort((a, b) => b.create_at - a.create_at);
    return posts.length === 0 ? 0 : posts[0].create_at;
};
