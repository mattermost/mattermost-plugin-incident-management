// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export interface Playbook {
    id: string;
    title: string;
    description: string;
    team_id: string;
    create_public_playbook_run: boolean;

    /** @alias num_checklists */
    num_stages: number;
    num_steps: number;
    num_runs: number;
    num_actions: number;
    last_run_at: number;
    member_ids: string[];
}

export interface PlaybookWithChecklist extends Playbook {
    checklists: Checklist[];
    broadcast_channel_id: string;
    reminder_message_template: string;
    reminder_timer_default_seconds: number;
    invited_user_ids: string[];
    invited_group_ids: string[];
    invite_users_enabled: boolean;
    default_owner_id: string;
    default_owner_enabled: boolean;
    announcement_channel_id: string;
    announcement_channel_enabled: boolean;
    webhook_on_creation_url: string;
    webhook_on_creation_enabled: boolean;
    webhook_on_status_update_url: string;
    webhook_on_status_update_enabled: boolean;
    message_on_join: string;
    message_on_join_enabled: boolean;
    retrospective_reminder_interval_seconds: number;
    retrospective_template: string;
    export_channel_on_archive_enabled: boolean;
    signal_any_keywords_enabled: boolean;
    signal_any_keywords: string[];
    categorize_channel_enabled: boolean;
}

export interface FetchPlaybooksParams {
    team_id?: string;
    page?: number;
    per_page?: number;
    sort?: 'title' | 'stages' | 'steps' | 'runs';
    direction?: 'asc' | 'desc';
}

export interface FetchPlaybooksReturn {
    total_count: number;
    page_count: number;
    has_more: boolean;
    items: Playbook[];
}

export interface FetchPlaybooksCountReturn {
    count: number;
}

export interface Checklist {
    title: string;
    items: ChecklistItem[];
}

export enum ChecklistItemState {
    Open = '',
    InProgress = 'in_progress',
    Closed = 'closed',
}

export interface ChecklistItem {
    title: string;
    description: string;
    state: ChecklistItemState;
    state_modified?: number;
    state_modified_post_id?: string;
    assignee_id?: string;
    assignee_modified?: number;
    assignee_modified_post_id?: string;
    command: string;
    command_last_run: number;
}

export interface DraftPlaybookWithChecklist extends Omit<PlaybookWithChecklist, 'id'> {
    id?: string;
}

export function emptyPlaybook(): DraftPlaybookWithChecklist {
    return {
        title: '',
        description: '',
        team_id: '',
        create_public_playbook_run: false,
        num_stages: 0,
        num_steps: 0,
        num_runs: 0,
        num_actions: 0,
        last_run_at: 0,
        checklists: [emptyChecklist()],
        member_ids: [],
        broadcast_channel_id: '',
        reminder_message_template: '',
        reminder_timer_default_seconds: 0,
        invited_user_ids: [],
        invited_group_ids: [],
        invite_users_enabled: false,
        default_owner_id: '',
        default_owner_enabled: false,
        announcement_channel_id: '',
        announcement_channel_enabled: false,
        webhook_on_creation_url: '',
        webhook_on_creation_enabled: false,
        webhook_on_status_update_url: '',
        webhook_on_status_update_enabled: false,
        message_on_join: defaultMessageOnJoin,
        message_on_join_enabled: false,
        retrospective_reminder_interval_seconds: 0,
        retrospective_template: defaultRetrospectiveTemplate,
        export_channel_on_archive_enabled: false,
        signal_any_keywords: [],
        signal_any_keywords_enabled: false,
        categorize_channel_enabled: false,
    };
}

export function emptyChecklist(): Checklist {
    return {
        title: 'Default checklist',
        items: [emptyChecklistItem()],
    };
}

export function emptyChecklistItem(): ChecklistItem {
    return {
        title: '',
        state: ChecklistItemState.Open,
        command: '',
        description: '',
        command_last_run: 0,
    };
}

export const newChecklistItem = (title = '', description = '', command = '', state = ChecklistItemState.Open): ChecklistItem => ({
    title,
    description,
    command,
    command_last_run: 0,
    state,
});

// eslint-disable-next-line
export function isPlaybook(arg: any): arg is PlaybookWithChecklist {
    return (
        arg &&
        typeof arg.id === 'string' &&
        typeof arg.title === 'string' &&
        typeof arg.team_id === 'string' &&
        typeof arg.create_public_playbook_run === 'boolean' &&
        arg.checklists && Array.isArray(arg.checklists) && arg.checklists.every(isChecklist) &&
        arg.member_ids && Array.isArray(arg.member_ids) && arg.checklists.every((id: any) => typeof id === 'string') &&
        typeof arg.broadcast_channel_id === 'string' &&
        typeof arg.reminder_message_template == 'string' &&
        typeof arg.reminder_timer_default_seconds == 'number' &&
        arg.invited_user_ids && Array.isArray(arg.invited_user_ids) && arg.invited_user_ids.every((id: any) => typeof id === 'string') &&
        arg.invited_group_ids && Array.isArray(arg.invited_group_ids) && arg.invited_group_ids.every((id: any) => typeof id === 'string') &&
        typeof arg.invite_users_enabled === 'boolean' &&
        typeof arg.default_owner_id === 'string' &&
        typeof arg.default_owner_enabled === 'boolean' &&
        typeof arg.announcement_channel_id === 'string' &&
        typeof arg.announcement_channel_enabled === 'boolean' &&
        typeof arg.webhook_on_creation_url === 'string' &&
        typeof arg.webhook_on_creation_enabled === 'boolean' &&
        typeof arg.webhook_on_status_update_url === 'string' &&
        typeof arg.webhook_on_status_update_enabled === 'boolean' &&
        typeof arg.message_on_join === 'string' &&
        typeof arg.message_on_join_enabled === 'boolean' &&
        typeof arg.signal_any_keywords && Array.isArray(arg.signal_any_keywords) && arg.signal_any_keywords.every((id: any) => typeof id === 'string') &&
        typeof arg.signal_any_keywords_enabled === 'boolean'
    );
}

// eslint-disable-next-line
export function isChecklist(arg: any): arg is Checklist {
    return arg &&
        typeof arg.title === 'string' &&
        arg.items && Array.isArray(arg.items) && arg.items.every(isChecklistItem);
}

// eslint-disable-next-line
export function isChecklistItem(arg: any): arg is ChecklistItem {
    return arg &&
        typeof arg.title === 'string' &&
        typeof arg.state_modified === 'number' &&
        typeof arg.state_modified_post_id === 'string' &&
        typeof arg.assignee_id === 'string' &&
        typeof arg.assignee_modified === 'number' &&
        typeof arg.assignee_modified_post_id === 'string' &&
        typeof arg.state === 'string' &&
        typeof arg.command === 'string' &&
        typeof arg.command_last_run === 'number';
}

export const defaultMessageOnJoin = `Welcome! This channel was automatically created as part of a playbook run. You can [learn more about playbooks here](https://docs.mattermost.com/administration/devops-command-center.html?highlight=playbook#playbooks). To see information about this run, such as current owner and checklist of tasks, select the shield icon in the channel header.

Here are some resources that you may find helpful:
[Mattermost community channel](https://community.mattermost.com/core/channels/ee-incident-response)
[User guide and documentation](https://docs.mattermost.com/administration/devops-command-center.html)`;

export const defaultRetrospectiveTemplate = `### Summary
This should contain 2-3 sentences that give a reader an overview of what happened, what was the cause, and what was done. The briefer the better as this is what future teams will look at first for reference.

### What was the impact?
This section describes the impact of this playbook run as experienced by internal and external customers as well as stakeholders.

### What were the contributing factors?
This playbook may be a reactive protocol to a situation that is otherwise undesirable. If that's the case, this section explains the reasons that caused the situation in the first place. There may be multiple root causes - this helps stakeholders understand why.

### What was done?
This section tells the story of how the team collaborated throughout the event to achieve the outcome. This will help future teams learn from this experience on what they could try.

### What did we learn?
This section should include perspective from everyone that was involved to celebrate the victories and identify areas for improvement. For example: What went well? What didn't go well? What should be done differently next time?

### Follow-up tasks
This section lists the action items to turn learnings into changes that help the team become more proficient with iterations. It could include tweaking the playbook, publishing the retrospective, or other improvements. The best follow-ups will have a clear owner as well as due date.

### Timeline Highlights
This section is a curated log that details the most important moments. It can contain key communications, screen shots, or other artifacts. Use the built-in timeline feature to help you retrace and replay the sequence of events.`;
