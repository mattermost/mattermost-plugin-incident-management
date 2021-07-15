// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {TimelineEvent, TimelineEventType} from 'src/types/rhs';
import {Checklist, isChecklist} from 'src/types/playbook';

export interface PlaybookRun {
    id: string;
    name: string;
    description: string;
    owner_user_id: string;
    reporter_user_id: string;
    team_id: string;
    channel_id: string;
    create_at: number;
    end_at: number;
    delete_at: number;
    active_stage: number;
    active_stage_title: string;
    post_id: string;
    playbook_id: string;
    checklists: Checklist[];
    status_posts: StatusPost[];
    current_status: PlaybookRunStatus;
    reminder_post_id: string;
    broadcast_channel_id: string;
    timeline_events: TimelineEvent[];
    retrospective: string;
    retrospective_published_at: number;
    retrospective_was_canceled: boolean;
    retrospective_reminder_interval_seconds: number;
    participant_ids: string[];
}

export interface StatusPost {
    id: string;
    status: PlaybookRunStatus;
    create_at: number;
    delete_at: number;
}

export interface Metadata {
    channel_name: string;
    channel_display_name: string;
    team_name: string;
    num_members: number;
    total_posts: number;
}

export interface FetchPlaybookRunsReturn {
    total_count: number;
    page_count: number;
    has_more: boolean;
    items: PlaybookRun[];
    disabled?: boolean;
}

export enum PlaybookRunStatus {
    Reported = 'Reported',
    Active = 'Active',
    Resolved = 'Resolved',
    Archived = 'Archived',
    Old = '',
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isPlaybookRun(arg: any): arg is PlaybookRun {
    return Boolean(arg &&
        arg.id && typeof arg.id === 'string' &&
        arg.name && typeof arg.name === 'string' &&
        typeof arg.description === 'string' &&
        arg.owner_user_id && typeof arg.owner_user_id === 'string' &&
        arg.reporter_user_id && typeof arg.reporter_user_id === 'string' &&
        arg.team_id && typeof arg.team_id === 'string' &&
        arg.channel_id && typeof arg.channel_id === 'string' &&
        typeof arg.create_at === 'number' &&
        typeof arg.end_at === 'number' &&
        typeof arg.delete_at === 'number' &&
        typeof arg.active_stage === 'number' &&
        typeof arg.active_stage_title === 'string' &&
        typeof arg.post_id === 'string' &&
        arg.playbook_id && typeof arg.playbook_id === 'string' &&
        arg.checklists && Array.isArray(arg.checklists) && arg.checklists.every(isChecklist) &&
        arg.status_posts && Array.isArray(arg.status_posts) && arg.status_posts.every(isStatusPost) &&
        typeof arg.reminder_post_id === 'string' &&
        typeof arg.broadcast_channel_id === 'string' &&
        arg.timeline_events && Array.isArray(arg.timeline_events) && arg.timeline_events.every(isTimelineEvent) &&
        arg.participant_ids && Array.isArray(arg.participant_ids) && arg.participant_ids.every(isString));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isStatusPost(arg: any): arg is StatusPost {
    return Boolean(arg &&
        arg.id && typeof arg.id === 'string' &&
        typeof arg.create_at === 'number' &&
        typeof arg.status === 'string' &&
        typeof arg.delete_at === 'number');
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isMetadata(arg: any): arg is Metadata {
    return Boolean(arg &&
        arg.channel_name && typeof arg.channel_name === 'string' &&
        arg.channel_display_name && typeof arg.channel_display_name === 'string' &&
        arg.team_name && typeof arg.team_name === 'string' &&
        typeof arg.num_members === 'number' &&
        typeof arg.total_posts === 'number');
}

export function isTimelineEvent(arg: any): arg is TimelineEvent {
    return Boolean(arg &&
        typeof arg.id === 'string' &&
        typeof arg.playbook_run_id === 'string' &&
        typeof arg.create_at === 'number' &&
        typeof arg.delete_at === 'number' &&
        typeof arg.event_at === 'number' &&
        typeof arg.event_type === 'string' && Object.values(TimelineEventType).includes(arg.event_type) &&
        typeof arg.summary === 'string' &&
        typeof arg.details === 'string' &&
        typeof arg.post_id === 'string' &&
        typeof arg.subject_user_id === 'string' &&
        typeof arg.creator_user_id === 'string');
}

function isString(arg: any): arg is string {
    return Boolean(typeof arg === 'string');
}

export function playbookRunCurrentStatusPost(playbookRun: PlaybookRun): StatusPost | undefined {
    const sortedPosts = [...playbookRun.status_posts]
        .filter((a) => a.delete_at === 0)
        .sort((a, b) => b.create_at - a.create_at);

    return sortedPosts[0];
}

export function playbookRunCurrentStatus(playbookRun: PlaybookRun): PlaybookRunStatus {
    return playbookRun.current_status;
}

export function playbookRunIsActive(playbookRun: PlaybookRun): boolean {
    const currentStatus = playbookRunCurrentStatus(playbookRun);
    return currentStatus !== PlaybookRunStatus.Archived;
}

export interface FetchPlaybookRunsParams {
    team_id?: string;
    page?: number;
    per_page?: number;
    sort?: string;
    direction?: string;
    statuses?: string[];
    owner_user_id?: string;
    search_term?: string;
    member_id?: string;
    disabled?: boolean;
    playbook_id?: string;
    active_gte?: number;
    active_lt?: number;
    started_gte?: number;
    started_lt?: number;
}

export interface FetchPlaybookRunsParamsTime {
    active_gte?: number;
    active_lt?: number;
    started_gte?: number;
    started_lt?: number;
}

export const DefaultFetchPlaybookRunsParamsTime: FetchPlaybookRunsParamsTime = {};

export const fetchParamsTimeEqual = (a: FetchPlaybookRunsParamsTime, b: FetchPlaybookRunsParamsTime) => {
    return Boolean(a.active_gte === b.active_gte &&
        a.active_lt === b.active_lt &&
        a.started_gte === b.started_gte &&
        a.started_lt === b.started_lt);
};

export interface FetchPlaybooksParams {
    team_id?: string;
    page?: number;
    per_page?: number;
    sort?: string;
    direction?: string;
}
