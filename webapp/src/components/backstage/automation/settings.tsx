// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import styled from 'styled-components';

import {ActionFunc} from 'mattermost-redux/types/actions';

import {InputKeywords} from 'src/components/backstage/automation/input_keywords';
import {PatternedInput} from 'src/components/backstage/automation/patterned_input';

import {InviteUsers} from 'src/components/backstage/automation/invite_users';
import {AutoAssignOwner} from 'src/components/backstage/automation/auto_assign_owner';
import {Announcement} from 'src/components/backstage/automation/announcement';
import {ExportChannelOnArchive} from 'src/components/backstage/automation/export_channel_on_archive';

import {MessageOnJoin} from 'src/components/backstage/automation/message_on_join';

interface Props {
    searchProfiles: (term: string) => ActionFunc;
    getProfiles: () => ActionFunc;
    userIds: string[];
    inviteUsersEnabled: boolean;
    onToggleInviteUsers: () => void;
    onAddUser: (userId: string) => void;
    onRemoveUser: (userId: string) => void;
    defaultOwnerID: string;
    defaultOwnerEnabled: boolean;
    onToggleDefaultOwner: () => void;
    onAssignOwner: (userId: string | undefined) => void;
    teamID: string;
    announcementChannelID: string;
    announcementChannelEnabled: boolean;
    onToggleAnnouncementChannel: () => void;
    onAnnouncementChannelSelected: (channelID: string | undefined) => void;
    webhookOnCreationEnabled: boolean;
    onToggleWebhookOnCreation: () => void;
    webhookOnCreationChange: (url: string) => void;
    webhookOnCreationURL: string;
    webhookOnStatusUpdateEnabled: boolean;
    onToggleWebhookOnStatusUpdate: () => void;
    webhookOnStatusUpdateURL: string;
    webhookOnStatusUpdateChange: (url: string) => void;
    messageOnJoinEnabled: boolean;
    onToggleMessageOnJoin: () => void;
    messageOnJoin: string;
    messageOnJoinChange: (message: string) => void;
    exportChannelOnArchiveEnabled: boolean;
    onToggleExportChannelOnArchiveEnabled: () => void;
    signalAnyKeywordsEnabled: boolean;
    onToggleSignalAnyKeywords: () => void;
    signalAnyKeywordsChange: (keywords: string) => void;
    signalAnyKeywords: string[];
    onAppendKeyword: (keywords: string) => void;
    onRemoveKeyword: (i: number) => void;
}

export const AutomationSettings = (props: Props) => {
    return (
        <>
            <Section>
                <SectionTitle>
                    {'Prompt to run the playbook when a user posts a message'}
                </SectionTitle>
                <Setting id={'signal-any-keywords'}>
                    <InputKeywords
                        enabled={props.signalAnyKeywordsEnabled}
                        onToggle={props.onToggleSignalAnyKeywords}
                        textOnToggle={'Containing any of these keywords'}
                        placeholderText={'Add keywords'}
                        keywords={props.signalAnyKeywords}
                        onAppendKeyword={props.onAppendKeyword}
                        onRemoveKeyword={props.onRemoveKeyword}
                    />

                </Setting>
            </Section>
            <Section>
                <SectionTitle>
                    {'When a run starts'}
                </SectionTitle>
                <Setting id={'invite-users'}>
                    <InviteUsers
                        enabled={props.inviteUsersEnabled}
                        onToggle={props.onToggleInviteUsers}
                        searchProfiles={props.searchProfiles}
                        getProfiles={props.getProfiles}
                        userIds={props.userIds}
                        onAddUser={props.onAddUser}
                        onRemoveUser={props.onRemoveUser}
                    />
                </Setting>
                <Setting id={'assign-owner'}>
                    <AutoAssignOwner
                        enabled={props.defaultOwnerEnabled}
                        onToggle={props.onToggleDefaultOwner}
                        searchProfiles={props.searchProfiles}
                        getProfiles={props.getProfiles}
                        ownerID={props.defaultOwnerID}
                        onAssignOwner={props.onAssignOwner}
                        teamID={props.teamID}
                    />
                </Setting>
                <Setting id={'announcement-channel'}>
                    <Announcement
                        enabled={props.announcementChannelEnabled}
                        onToggle={props.onToggleAnnouncementChannel}
                        channelId={props.announcementChannelID}
                        onChannelSelected={props.onAnnouncementChannelSelected}
                    />
                </Setting>
                <Setting id={'playbook-run-creation__outgoing-webhook'}>
                    <PatternedInput
                        enabled={props.webhookOnCreationEnabled}
                        onToggle={props.onToggleWebhookOnCreation}
                        input={props.webhookOnCreationURL}
                        onChange={props.webhookOnCreationChange}
                        pattern={'https?://.*'}
                        placeholderText={'Enter webhook'}
                        textOnToggle={'Send outgoing webhook'}
                        type={'url'}
                        errorText={'URL is not valid.'}
                    />
                </Setting>
            </Section>
            <Section>
                <SectionTitle>
                    {'When a status update is posted'}
                </SectionTitle>
                <Setting id={'playbook-run-status-update__outgoing-webhook'}>
                    <PatternedInput
                        enabled={props.webhookOnStatusUpdateEnabled}
                        onToggle={props.onToggleWebhookOnStatusUpdate}
                        input={props.webhookOnStatusUpdateURL}
                        onChange={props.webhookOnStatusUpdateChange}
                        pattern={'https?://.*'}
                        placeholderText={'Enter webhook'}
                        textOnToggle={'Send outgoing webhook'}
                        type={'url'}
                        errorText={'URL is not valid.'}
                    />
                </Setting>
            </Section>
            <Section>
                <SectionTitle>
                    {'When a new member joins the channel'}
                </SectionTitle>
                <Setting id={'user-joins-message'}>
                    <MessageOnJoin
                        enabled={props.messageOnJoinEnabled}
                        onToggle={props.onToggleMessageOnJoin}
                        message={props.messageOnJoin}
                        onChange={props.messageOnJoinChange}
                    />
                </Setting>

            </Section>
            <Section>
                <SectionTitle>
                    {'When a run is archived'}
                </SectionTitle>
                <Setting id={'export-channel-on-archive'}>
                    <ExportChannelOnArchive
                        enabled={props.exportChannelOnArchiveEnabled}
                        onToggle={props.onToggleExportChannelOnArchiveEnabled}
                    />
                </Setting>
            </Section>
        </>
    );
};

const Section = styled.div`
    margin: 32px 0;
`;

const SectionTitle = styled.div`
    font-weight: 600;
    margin: 0 0 32px 0;
`;

const Setting = styled.div`
    display: flex;
    flex-direction: column;
    align-items: flex-start;

    margin-bottom: 24px;
`;
