// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {AnyAction, Dispatch} from 'redux';
import qs from 'qs';

import {getCurrentChannel} from 'mattermost-redux/selectors/entities/channels';
import {getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';
import {GetStateFunc} from 'mattermost-redux/types/actions';
import {UserProfile} from 'mattermost-redux/types/users';
import {IntegrationTypes} from 'mattermost-redux/action_types';
import {Client4} from 'mattermost-redux/client';
import {ClientError} from 'mattermost-redux/client/client4';

import {
    FetchPlaybookRunsParams,
    FetchPlaybookRunsReturn,
    PlaybookRun,
    isPlaybookRun,
    isMetadata,
    Metadata,
} from 'src/types/playbook_run';

import {setTriggerId} from 'src/actions';
import {OwnerInfo} from 'src/types/backstage';
import {
    ChecklistItem,
    ChecklistItemState,
    FetchPlaybooksParams,
    FetchPlaybooksReturn,
    PlaybookWithChecklist,
    DraftPlaybookWithChecklist,
    Playbook,
    FetchPlaybooksCountReturn,
} from 'src/types/playbook';
import {PROFILE_CHUNK_SIZE, AdminNotificationType} from 'src/constants';

import {EmptyPlaybookStats, PlaybookStats, Stats} from 'src/types/stats';

import {pluginId} from './manifest';
import {GlobalSettings, globalSettingsSetDefaults} from './types/settings';

const apiUrl = `/plugins/${pluginId}/api/v0`;

export async function fetchPlaybookRuns(params: FetchPlaybookRunsParams) {
    const queryParams = qs.stringify(params, {addQueryPrefix: true, indices: false});

    let data = await doGet(`${apiUrl}/runs${queryParams}`);
    if (!data) {
        data = {items: [], total_count: 0, page_count: 0, has_more: false} as FetchPlaybookRunsReturn;
    }

    return data as FetchPlaybookRunsReturn;
}

export async function fetchPlaybookRun(id: string) {
    const data = await doGet(`${apiUrl}/runs/${id}`);
    // eslint-disable-next-line no-process-env
    if (process.env.NODE_ENV !== 'production') {
        if (!isPlaybookRun(data)) {
            // eslint-disable-next-line no-console
            console.error('expected an PlaybookRun in fetchPlaybookRun, received:', data);
        }
    }

    return data as PlaybookRun;
}

export async function fetchPlaybookRunMetadata(id: string) {
    const data = await doGet(`${apiUrl}/runs/${id}/metadata`);
    // eslint-disable-next-line no-process-env
    if (process.env.NODE_ENV !== 'production') {
        if (!isMetadata(data)) {
            // eslint-disable-next-line no-console
            console.error('expected a Metadata in fetchPlaybookRunMetadata, received:', data);
        }
    }

    return data as Metadata;
}

export async function fetchPlaybookRunByChannel(channelId: string) {
    const data = await doGet(`${apiUrl}/runs/channel/${channelId}`);
    // eslint-disable-next-line no-process-env
    if (process.env.NODE_ENV !== 'production') {
        if (!isPlaybookRun(data)) {
            // eslint-disable-next-line no-console
            console.error('expected an PlaybookRun in fetchPlaybookRun, received:', data);
        }
    }

    return data as PlaybookRun;
}

export async function fetchCheckAndSendMessageOnJoin(playbookRunID: string, channelId: string) {
    const data = await doGet(`${apiUrl}/runs/${playbookRunID}/check-and-send-message-on-join/${channelId}`);
    return Boolean(data.viewed);
}

export function fetchPlaybookRunChannels(teamID: string, userID: string) {
    return doGet(`${apiUrl}/runs/channels?team_id=${teamID}&member_id=${userID}`);
}

export async function clientExecuteCommand(dispatch: Dispatch<AnyAction>, getState: GetStateFunc, command: string) {
    let currentChannel = getCurrentChannel(getState());
    const currentTeamId = getCurrentTeamId(getState());

    // Default to town square if there is no current channel (i.e., if Mattermost has not yet loaded)
    if (!currentChannel) {
        currentChannel = await Client4.getChannelByName(currentTeamId, 'town-square');
    }

    const args = {
        channel_id: currentChannel?.id,
        team_id: currentTeamId,
    };

    try {
        //@ts-ignore Typing in mattermost-redux is wrong
        const data = await Client4.executeCommand(command, args);
        dispatch(setTriggerId(data?.trigger_id));
    } catch (error) {
        console.error(error); //eslint-disable-line no-console
    }
}

export async function clientRunChecklistItemSlashCommand(dispatch: Dispatch, playbookRunId: string, checklistNumber: number, itemNumber: number) {
    try {
        const data = await doPost(`${apiUrl}/runs/${playbookRunId}/checklists/${checklistNumber}/item/${itemNumber}/run`);
        if (data.trigger_id) {
            dispatch({type: IntegrationTypes.RECEIVED_DIALOG_TRIGGER_ID, data: data.trigger_id});
        }
    } catch (error) {
        console.error(error); //eslint-disable-line no-console
    }
}

export function clientFetchPlaybooks(teamID: string, params: FetchPlaybooksParams) {
    const queryParams = qs.stringify({
        team_id: teamID,
        ...params,
    }, {addQueryPrefix: true});
    return doGet<FetchPlaybooksReturn>(`${apiUrl}/playbooks${queryParams}`);
}

const clientHasPlaybooks = async (teamID: string): Promise<boolean> => {
    const result = await clientFetchPlaybooks(teamID, {
        page: 0,
        per_page: 1,
    }) as FetchPlaybooksReturn;

    return result.items?.length > 0;
};

export {clientHasPlaybooks};

export function clientFetchPlaybook(playbookID: string) {
    return doGet<PlaybookWithChecklist>(`${apiUrl}/playbooks/${playbookID}`);
}

export async function clientFetchPlaybooksCount(teamID: string) {
    const queryParams = qs.stringify({
        team_id: teamID,
    }, {addQueryPrefix: true});
    return doGet<FetchPlaybooksCountReturn>(`${apiUrl}/playbooks/count${queryParams}`);
}

export async function savePlaybook(playbook: PlaybookWithChecklist | DraftPlaybookWithChecklist) {
    if (!playbook.id) {
        const data = await doPost(`${apiUrl}/playbooks`, JSON.stringify(playbook));
        return data;
    }

    await doFetchWithoutResponse(`${apiUrl}/playbooks/${playbook.id}`, {
        method: 'PUT',
        body: JSON.stringify(playbook),
    });
    return {id: playbook.id};
}

export async function deletePlaybook(playbookId: Playbook['id']) {
    const {data} = await doFetchWithTextResponse(`${apiUrl}/playbooks/${playbookId}`, {
        method: 'delete',
    });
    return data;
}

export async function fetchUsersInChannel(channelId: string): Promise<UserProfile[]> {
    return Client4.getProfilesInChannel(channelId, 0, PROFILE_CHUNK_SIZE);
}

export async function fetchUsersInTeam(teamId: string): Promise<UserProfile[]> {
    return Client4.getProfilesInTeam(teamId, 0, 200);
}

export async function fetchOwnersInTeam(teamId: string): Promise<OwnerInfo[]> {
    const queryParams = qs.stringify({team_id: teamId}, {addQueryPrefix: true});

    let data = await doGet(`${apiUrl}/runs/owners${queryParams}`);
    if (!data) {
        data = [];
    }
    return data as OwnerInfo[];
}

export async function setOwner(playbookRunId: string, ownerId: string) {
    const body = `{"owner_id": "${ownerId}"}`;
    try {
        const data = await doPost(`${apiUrl}/runs/${playbookRunId}/owner`, body);
        return data;
    } catch (error) {
        return {error};
    }
}

export async function setAssignee(playbookRunId: string, checklistNum: number, itemNum: number, assigneeId?: string) {
    const body = JSON.stringify({assignee_id: assigneeId});
    try {
        return await doPut(`${apiUrl}/runs/${playbookRunId}/checklists/${checklistNum}/item/${itemNum}/assignee`, body);
    } catch (error) {
        return {error};
    }
}

export async function setChecklistItemState(playbookRunID: string, checklistNum: number, itemNum: number, newState: ChecklistItemState) {
    return doPut(`${apiUrl}/runs/${playbookRunID}/checklists/${checklistNum}/item/${itemNum}/state`,
        JSON.stringify({
            new_state: newState,
        }),
    );
}

export async function clientAddChecklistItem(playbookRunID: string, checklistNum: number, checklistItem: ChecklistItem) {
    const data = await doPut(`${apiUrl}/runs/${playbookRunID}/checklists/${checklistNum}/add`,
        JSON.stringify(checklistItem),
    );

    return data;
}

export async function clientRemoveChecklistItem(playbookRunID: string, checklistNum: number, itemNum: number) {
    await doFetchWithoutResponse(`${apiUrl}/runs/${playbookRunID}/checklists/${checklistNum}/item/${itemNum}`, {
        method: 'delete',
        body: '',
    });
}

interface ChecklistItemUpdate {
    title: string
    command: string
    description: string
}

export async function clientEditChecklistItem(playbookRunID: string, checklistNum: number, itemNum: number, itemUpdate: ChecklistItemUpdate) {
    const data = await doPut(`${apiUrl}/runs/${playbookRunID}/checklists/${checklistNum}/item/${itemNum}`,
        JSON.stringify({
            title: itemUpdate.title,
            command: itemUpdate.command,
            description: itemUpdate.description,
        }));

    return data;
}

export async function clientReorderChecklist(playbookRunID: string, checklistNum: number, itemNum: number, newLocation: number) {
    const data = await doPut(`${apiUrl}/runs/${playbookRunID}/checklists/${checklistNum}/reorder`,
        JSON.stringify({
            item_num: itemNum,
            new_location: newLocation,
        }),
    );

    return data;
}

export async function clientRemoveTimelineEvent(playbookRunID: string, entryID: string) {
    await doFetchWithoutResponse(`${apiUrl}/runs/${playbookRunID}/timeline/${entryID}`, {
        method: 'delete',
        body: '',
    });
}

export async function fetchStats(teamID: string): Promise<Stats | null> {
    const data = await doGet(`${apiUrl}/stats?team_id=${teamID}`);
    if (!data) {
        return null;
    }

    return data as Stats;
}

export async function fetchPlaybookStats(playbookID: string): Promise<PlaybookStats> {
    const data = await doGet(`${apiUrl}/stats/playbook?playbook_id=${playbookID}`);
    if (!data) {
        return EmptyPlaybookStats;
    }

    return data as PlaybookStats;
}

export async function telemetryEventForPlaybookRun(playbookRunID: string, action: string) {
    await doFetchWithoutResponse(`${apiUrl}/telemetry/run/${playbookRunID}`, {
        method: 'POST',
        body: JSON.stringify({action}),
    });
}

export async function telemetryEventForPlaybook(playbookID: string, action: string) {
    await doFetchWithoutResponse(`${apiUrl}/telemetry/playbook/${playbookID}`, {
        method: 'POST',
        body: JSON.stringify({action}),
    });
}

export async function setGlobalSettings(settings: GlobalSettings) {
    await doFetchWithoutResponse(`${apiUrl}/settings`, {
        method: 'PUT',
        body: JSON.stringify(settings),
    });
}

export async function fetchGlobalSettings(): Promise<GlobalSettings> {
    const data = await doGet(`${apiUrl}/settings`);
    if (!data) {
        return globalSettingsSetDefaults({});
    }

    return globalSettingsSetDefaults(data);
}

export async function updateRetrospective(playbookRunID: string, updatedText: string) {
    const data = await doPost(`${apiUrl}/runs/${playbookRunID}/retrospective`,
        JSON.stringify({
            retrospective: updatedText,
        }));
    return data;
}

export async function publishRetrospective(playbookRunID: string, currentText: string) {
    const data = await doPost(`${apiUrl}/runs/${playbookRunID}/retrospective/publish`,
        JSON.stringify({
            retrospective: currentText,
        }));
    return data;
}

export async function noRetrospective(playbookRunID: string) {
    await doFetchWithoutResponse(`${apiUrl}/runs/${playbookRunID}/no-retrospective-button`, {
        method: 'POST',
    });
}

export function exportChannelUrl(channelId: string) {
    const exportPluginUrl = '/plugins/com.mattermost.plugin-channel-export/api/v1';

    const queryParams = qs.stringify({
        channel_id: channelId,
        format: 'csv',
    }, {addQueryPrefix: true});

    return `${exportPluginUrl}/export${queryParams}`;
}

export async function trackRequestTrialLicense(action: string) {
    await doFetchWithoutResponse(`${apiUrl}/telemetry/start-trial`, {
        method: 'POST',
        body: JSON.stringify({action}),
    });
}

export const requestTrialLicense = async (users: number, action: string) => {
    trackRequestTrialLicense(action);

    try {
        const response = await Client4.doFetch(`${Client4.getBaseRoute()}/trial-license`, {
            method: 'POST', body: JSON.stringify({users, terms_accepted: true, receive_emails_accepted: true}),
        });
        return {data: response};
    } catch (e) {
        return {error: e.message};
    }
};

export const postMessageToAdmins = async (messageType: AdminNotificationType, isServerTeamEdition: boolean) => {
    const body = `{"message_type": "${messageType}", "is_team_edition": ${isServerTeamEdition}}`;
    try {
        const response = await doPost(`${apiUrl}/bot/notify-admins`, body);
        return {data: response};
    } catch (e) {
        return {error: e.message};
    }
};

export const promptForFeedback = async () => {
    try {
        const response = await doPost(`${apiUrl}/bot/prompt-for-feedback`);
        return {data: response};
    } catch (e) {
        return {error: e.message};
    }
};

export const doGet = async <TData = any>(url: string) => {
    const {data} = await doFetchWithResponse<TData>(url, {method: 'get'});

    return data;
};

export const doPost = async <TData = any>(url: string, body = {}) => {
    const {data} = await doFetchWithResponse<TData>(url, {
        method: 'POST',
        body,
    });

    return data;
};

export const doPut = async <TData = any>(url: string, body = {}) => {
    const {data} = await doFetchWithResponse<TData>(url, {
        method: 'PUT',
        body,
    });

    return data;
};

export const doPatch = async <TData = any>(url: string, body = {}) => {
    const {data} = await doFetchWithResponse<TData>(url, {
        method: 'PATCH',
        body,
    });

    return data;
};

export const doFetchWithResponse = async <TData = any>(url: string, options = {}) => {
    const response = await fetch(url, Client4.getOptions(options));

    let data;
    if (response.ok) {
        const contentType = response.headers.get('content-type');
        if (contentType === 'application/json') {
            data = await response.json() as TData;
        }

        return {
            response,
            data,
        };
    }

    data = await response.text();

    throw new ClientError(Client4.url, {
        message: data || '',
        status_code: response.status,
        url,
    });
};

export const doFetchWithTextResponse = async <TData extends string>(url: string, options = {}) => {
    const response = await fetch(url, Client4.getOptions(options));

    let data;
    if (response.ok) {
        data = await response.text() as TData;

        return {
            response,
            data,
        };
    }

    data = await response.text();

    throw new ClientError(Client4.url, {
        message: data || '',
        status_code: response.status,
        url,
    });
};

export const doFetchWithoutResponse = async (url: string, options = {}) => {
    const response = await fetch(url, Client4.getOptions(options));

    if (response.ok) {
        return;
    }

    throw new ClientError(Client4.url, {
        message: '',
        status_code: response.status,
        url,
    });
};
