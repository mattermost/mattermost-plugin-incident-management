// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {FC} from 'react';

import styled from 'styled-components';

import {ActionFunc} from 'mattermost-redux/types/actions';

import {WebhookOnCreation} from 'src/components/backstage/automation/webhook_on_creation';

import {InviteUsers} from 'src/components/backstage/automation/invite_users';
import {AutoAssignCommander} from 'src/components/backstage/automation/auto_assign_commander';
import {Announcement} from 'src/components/backstage/automation/announcement';

import {BackstageSubheader, BackstageSubheaderDescription} from 'src/components/backstage/styles';
import {MessageOnJoin} from 'src/components/backstage/automation/message_on_join';

interface Props {
    searchProfiles: (term: string) => ActionFunc;
    getProfiles: () => ActionFunc;
    userIds: string[];
    inviteUsersEnabled: boolean;
    onToggleInviteUsers: () => void;
    onAddUser: (userId: string) => void;
    onRemoveUser: (userId: string) => void;
    defaultCommanderID: string;
    defaultCommanderEnabled: boolean;
    onToggleDefaultCommander: () => void;
    onAssignCommander: (userId: string | undefined) => void;
    teamID: string;
    announcementChannelID: string;
    announcementChannelEnabled: boolean;
    onToggleAnnouncementChannel: () => void;
    onAnnouncementChannelSelected: (channelID: string | undefined) => void;
    webhookOnCreationEnabled: boolean;
    onToggleWebhookOnCreation: () => void;
    webhookOnCreationChange: (url: string) => void;
    webhookOnCreationURL: string;
    messageOnJoinEnabled: boolean;
    onToggleMessageOnJoin: () => void;
    messageOnJoin: string;
    messageOnJoinChange: (message: string) => void;
}

export const AutomationSettings: FC<Props> = (props: Props) => {
    return (
        <>
            <BackstageSubheader>
                {'Automation'}
            </BackstageSubheader>
            <BackstageSubheaderDescription>
                {'Select what actions take place after certain situations are triggered.'}
            </BackstageSubheaderDescription>
            <Section>
                <SectionTitle>
                    {'When an incident starts'}
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
                <Setting id={'assign-commander'}>
                    <AutoAssignCommander
                        enabled={props.defaultCommanderEnabled}
                        onToggle={props.onToggleDefaultCommander}
                        searchProfiles={props.searchProfiles}
                        getProfiles={props.getProfiles}
                        commanderID={props.defaultCommanderID}
                        onAssignCommander={props.onAssignCommander}
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
                <Setting id={'incident-creation__outgoing-webhook'}>
                    <WebhookOnCreation
                        enabled={props.webhookOnCreationEnabled}
                        onToggle={props.onToggleWebhookOnCreation}
                        url={props.webhookOnCreationURL}
                        onChange={props.webhookOnCreationChange}
                    />
                </Setting>
            </Section>
            <Section>
                <SectionTitle>
                    {'When a new member joins'}
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
