// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {createSelector} from 'reselect';

import General from 'mattermost-redux/constants/general';
import {GlobalState} from 'mattermost-redux/types/store';
import {GlobalState as WebGlobalState} from 'mattermost-webapp/types/store';
import {getLicense, getConfig} from 'mattermost-redux/selectors/entities/general';
import {getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';
import {getCurrentChannelId} from 'mattermost-redux/selectors/entities/channels';
import {getUsers} from 'mattermost-redux/selectors/entities/common';
import {UserProfile} from 'mattermost-redux/types/users';
import {sortByUsername} from 'mattermost-redux/utils/user_utils';
import {$ID, IDMappedObjects, Dictionary} from 'mattermost-redux/types/utilities';
import {getCurrentUser} from 'mattermost-redux/selectors/entities/users';

import {pluginId} from 'src/manifest';

import {PlaybookRun, playbookRunIsActive} from 'src/types/playbook_run';
import {
    RHSState,
    RHSTabState,
    TimelineEventsFilter,
    TimelineEventsFilterDefault,
} from 'src/types/rhs';
import {findLastUpdated} from 'src/utils';

import {GlobalSettings} from './types/settings';

//@ts-ignore GlobalState is not complete
const pluginState = (state: GlobalState) => state['plugins-' + pluginId] || {};

export const selectToggleRHS = (state: GlobalState): () => void => pluginState(state).toggleRHSFunction;

export const isPlaybookRunRHSOpen = (state: GlobalState): boolean => pluginState(state).rhsOpen;

export const getIsRhsExpanded = (state: WebGlobalState): boolean => state.views.rhs.isSidebarExpanded;

export const getAdminAnalytics = (state: GlobalState): Dictionary<number> => state.entities.admin.analytics as Dictionary<number>;

export const clientId = (state: GlobalState): string => pluginState(state).clientId;

export const isDisabledOnCurrentTeam = (state: GlobalState): boolean => pluginState(state).myPlaybookRunsByTeam[getCurrentTeamId(state)] === false;

export const globalSettings = (state: GlobalState): GlobalSettings | null => pluginState(state).globalSettings;

// reminder: myPlaybookRunsByTeam indexes teamId->channelId->playbookRun
const myPlaybookRunsByTeam = (state: GlobalState): Record<string, Record<string, PlaybookRun>> =>
    pluginState(state).myPlaybookRunsByTeam;

export const inPlaybookRunChannel = createSelector(
    getCurrentTeamId,
    getCurrentChannelId,
    myPlaybookRunsByTeam,
    (teamId, channelId, playbookRunMapByTeam) => {
        return Boolean(playbookRunMapByTeam[teamId]?.[channelId]);
    },
);

export const currentPlaybookRun = createSelector(
    getCurrentTeamId,
    getCurrentChannelId,
    myPlaybookRunsByTeam,
    (teamId, channelId, playbookRunMapByTeam) => {
        return playbookRunMapByTeam[teamId]?.[channelId];
    },
);

export const myActivePlaybookRunsList = createSelector(
    getCurrentTeamId,
    myPlaybookRunsByTeam,
    (teamId, playbookRunMapByTeam) => {
        if (!playbookRunMapByTeam[teamId]) {
            return [];
        }

        // return active playbook runs, sorted descending by create_at
        return Object.values(playbookRunMapByTeam[teamId])
            .filter((i) => playbookRunIsActive(i))
            .sort((a, b) => b.create_at - a.create_at);
    },
);

// myActivePlaybookRunsMap returns a map indexed by channelId->playbookRun for the current team
export const myPlaybookRunsMap = (state: GlobalState) => {
    return myPlaybookRunsByTeam(state)[getCurrentTeamId(state)] || {};
};

export const currentRHSState = (state: GlobalState): RHSState => pluginState(state).rhsState;

export const currentRHSTabState = (state: GlobalState): RHSTabState => {
    const channelId = getCurrentChannelId(state);
    return pluginState(state).tabStateByChannel[channelId] || RHSTabState.ViewingAbout;
};

export const currentRHSEventsFilter = (state: GlobalState): TimelineEventsFilter => {
    const channelId = getCurrentChannelId(state);
    return pluginState(state).eventsFilterByChannel[channelId] || TimelineEventsFilterDefault;
};

export const rhsEventsFilterForChannel = (state: GlobalState, channelId: string): TimelineEventsFilter => {
    return pluginState(state).eventsFilterByChannel[channelId] || TimelineEventsFilterDefault;
};

export const lastUpdatedByPlaybookRunId = createSelector(
    getCurrentTeamId,
    myPlaybookRunsByTeam,
    (teamId, playbookRunsMapByTeam) => {
        const result = {} as Record<string, number>;
        const playbookRunMap = playbookRunsMapByTeam[teamId];
        if (!playbookRunMap) {
            return {};
        }
        for (const playbookRun of Object.values(playbookRunMap)) {
            result[playbookRun.id] = findLastUpdated(playbookRun);
        }
        return result;
    },
);

const PROFILE_SET_ALL = 'all';

// sortAndInjectProfiles is an unexported function copied from mattermost-redux, it is called
// whenever a function returns a populated list of UserProfiles. Since getProfileSetForChannel is
// new, we have to sort and inject profiles before returning the list.
function sortAndInjectProfiles(profiles: IDMappedObjects<UserProfile>, profileSet?: 'all' | Array<$ID<UserProfile>> | Set<$ID<UserProfile>>): Array<UserProfile> {
    let currentProfiles: UserProfile[] = [];

    if (typeof profileSet === 'undefined') {
        return currentProfiles;
    } else if (profileSet === PROFILE_SET_ALL) {
        currentProfiles = Object.keys(profiles).map((key) => profiles[key]);
    } else {
        currentProfiles = Array.from(profileSet).map((p) => profiles[p]);
    }

    currentProfiles = currentProfiles.filter((profile) => Boolean(profile));

    return currentProfiles.sort(sortByUsername);
}

export const getProfileSetForChannel = (state: GlobalState, channelId: string) => {
    const profileSet = state.entities.users.profilesInChannel[channelId];
    const profiles = getUsers(state);
    return sortAndInjectProfiles(profiles, profileSet);
};

export const numPlaybooksByTeam = (state: GlobalState): Record<string, number> =>
    pluginState(state).numPlaybooksByTeam;

export const currentTeamNumPlaybooks = createSelector(
    getCurrentTeamId,
    numPlaybooksByTeam,
    (teamId, playbooksPerTeamMap) => {
        return playbooksPerTeamMap[teamId] || 0;
    },
);

export const isPostMenuModalVisible = (state: GlobalState): boolean =>
    pluginState(state).postMenuModalVisibility;

export const isCurrentUserAdmin = createSelector(
    getCurrentUser,
    (user) => {
        const rolesArray = user.roles.split(' ');
        return rolesArray.includes(General.SYSTEM_ADMIN_ROLE);
    },
);

export const hasViewedByChannelID = (state: GlobalState) => pluginState(state).hasViewedByChannel;

export const isTeamEdition = createSelector(
    getConfig,
    (config) => config.BuildEnterpriseReady !== 'true',
);
