// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {FC, useState, useEffect} from 'react';
import {Redirect, useParams, useLocation, Prompt, useRouteMatch} from 'react-router-dom';
import {useSelector, useDispatch} from 'react-redux';
import styled from 'styled-components';

import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';
import {getProfilesInTeam, searchProfiles} from 'mattermost-redux/actions/users';
import {GlobalState} from 'mattermost-redux/types/store';
import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';
import {Team} from 'mattermost-redux/types/teams';


import {Tabs, TabsContent} from 'src/components/tabs';
import {PresetTemplates} from 'src/components/backstage/template_selector';
import {navigateToTeamPluginUrl, teamPluginErrorUrl} from 'src/browser_routing';
import {Playbook, Checklist, emptyPlaybook, defaultMessageOnJoin} from 'src/types/playbook';
import {savePlaybook, clientFetchPlaybook} from 'src/client';
import {StagesAndStepsEdit} from 'src/components/backstage/stages_and_steps_edit';
import {ErrorPageTypes, TEMPLATE_TITLE_KEY, PROFILE_CHUNK_SIZE} from 'src/constants';
import {PrimaryButton} from 'src/components/assets/buttons';
import {BackstageNavbar, BackstageNavbarIcon} from 'src/components/backstage/backstage';
import {AutomationSettings} from 'src/components/backstage/automation/settings';

import './playbook.scss';
import EditableText from './editable_text';
import SharePlaybook from './share_playbook';
import ChannelSelector from './channel_selector';
import {
    BackstageSubheader,
    BackstageSubheaderDescription,
    TabContainer,
    StyledTextarea,
    StyledSelect,
} from './styles';

const Container = styled.div`
    display: flex;
    flex-direction: row;
    flex-grow: 1;
    align-items: stretch;
    width: 100%;
`;

const EditView = styled.div`
    display: flex;
    flex-direction: column;
    align-items: stretch;
    flex-grow: 1;
`;

const TabsHeader = styled.div`
    height: 72px;
    min-height: 72px;
    display: flex;
    padding: 0 32px;
    border-bottom: 1px solid var(--center-channel-color-16);
    white-space: nowrap;
`;

const EditContent = styled.div`
    background: var(--center-channel-color-04);
    flex-grow: 1;
`;

const SidebarBlock = styled.div`
    margin: 0 0 40px;
`;

const NavbarPadding = styled.div`
    flex-grow: 1;
`;

const EditableTexts = styled.div`
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
    padding: 0 15px;
`;

const EditableTitleContainer = styled.div`
    font-size: 20px;
    line-height: 28px;
`;

const RadioContainer = styled.div`
    display: flex;
    flex-direction: column;
`;

const RadioLabel = styled.label`
    && {
        margin: 0 0 8px;
        display: flex;
        align-items: center;
        font-size: 14px;
        font-weight: normal;
        line-height: 20px;
    }
`;

const RadioInput = styled.input`
    && {
        width: 16px;
        height: 16px;
        margin: 0 8px 0 0;
    }
`;

const OuterContainer = styled.div`
    background: var(center-channel-bg);
    display: flex;
    flex-direction: column;
    min-height: 100vh;
`;

interface Props {
    isNew: boolean;
    currentTeam: Team;
}

interface URLParams {
    playbookId?: string;
}

const FetchingStateType = {
    loading: 'loading',
    fetched: 'fetched',
    notFound: 'notfound',
};

// setPlaybookDefaults fills in a playbook with defaults for any fields left empty.
const setPlaybookDefaults = (playbook: Playbook) => ({
    ...playbook,
    title: playbook.title.trim() || 'Untitled Playbook',
    checklists: playbook.checklists.map((checklist) => ({
        ...checklist,
        title: checklist.title || 'Untitled Checklist',
        items: checklist.items.map((item) => ({
            ...item,
            title: item.title || 'Untitled Step',
        })),
    })),
});

const timerOptions = [
    {value: 900, label: '15min'},
    {value: 1800, label: '30min'},
    {value: 3600, label: '60min'},
    {value: 14400, label: '4hr'},
    {value: 86400, label: '24hr'},
];

const PlaybookEdit: FC<Props> = (props: Props) => {
    const dispatch = useDispatch();

    const currentUserId = useSelector(getCurrentUserId);

    const [playbook, setPlaybook] = useState<Playbook>({
        ...emptyPlaybook(),
        team_id: props.currentTeam.id,
        member_ids: [currentUserId],
    });
    const [changesMade, setChangesMade] = useState(false);

    const urlParams = useParams<URLParams>();
    const location = useLocation();
    const currentTeam = useSelector<GlobalState, Team>(getCurrentTeam);

    const [fetchingState, setFetchingState] = useState(FetchingStateType.loading);

    const [currentTab, setCurrentTab] = useState<number>(0);

    useEffect(() => {
        const fetchData = async () => {
            // No need to fetch anything if we're adding a new playbook
            if (props.isNew) {
                // Use preset template if specified
                const searchParams = new URLSearchParams(location.search);
                const templateTitle = searchParams.get(TEMPLATE_TITLE_KEY);
                if (templateTitle) {
                    const template = PresetTemplates.find((t) => t.title === templateTitle);
                    if (!template) {
                        // eslint-disable-next-line no-console
                        console.error('Failed to find template using template key =', templateTitle);
                        return;
                    }

                    setPlaybook({
                        ...template.template,
                        team_id: props.currentTeam.id,
                        member_ids: [currentUserId],
                    });
                    setChangesMade(true);
                }
                return;
            }

            if (urlParams.playbookId) {
                try {
                    const fetchedPlaybook = await clientFetchPlaybook(urlParams.playbookId);
                    fetchedPlaybook.member_ids = fetchedPlaybook.member_ids || [currentUserId];
                    setPlaybook(fetchedPlaybook);
                    setFetchingState(FetchingStateType.fetched);
                } catch {
                    setFetchingState(FetchingStateType.notFound);
                }
            }
        };
        fetchData();
    }, [urlParams.playbookId, props.isNew]);

    const onSave = async () => {
        await savePlaybook(setPlaybookDefaults(playbook));
        setChangesMade(false);
        navigateToTeamPluginUrl(currentTeam.name, '/playbooks');
    };

    const updateChecklist = (newChecklist: Checklist[]) => {
        setPlaybook({
            ...playbook,
            checklists: newChecklist,
        });
        setChangesMade(true);
    };

    const handleTitleChange = (title: string) => {
        if (title.trim().length === 0) {
            // Keep the original title from the props.
            return;
        }

        setPlaybook({
            ...playbook,
            title,
        });
        setChangesMade(true);
    };

    const handlePublicChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setPlaybook({
            ...playbook,
            create_public_incident: e.target.value === 'public',
        });
        setChangesMade(true);
    };

    const handleUsersInput = (userId: string) => {
        setPlaybook({
            ...playbook,
            member_ids: [...playbook.member_ids, userId],
        });
        setChangesMade(true);
    };

    const handleRemoveUser = (userId: string) => {
        const idx = playbook.member_ids.indexOf(userId);
        setPlaybook({
            ...playbook,
            member_ids: [...playbook.member_ids.slice(0, idx), ...playbook.member_ids.slice(idx + 1)],
        });
        setChangesMade(true);
    };

    const handleClearUsers = () => {
        setPlaybook({
            ...playbook,
            member_ids: [],
        });
        setChangesMade(true);
    };

    const handleAddUserInvited = (userId: string) => {
        if (!playbook.invited_user_ids.includes(userId)) {
            setPlaybook({
                ...playbook,
                invited_user_ids: [...playbook.invited_user_ids, userId],
            });
            setChangesMade(true);
        }
    };

    const handleRemoveUserInvited = (userId: string) => {
        const idx = playbook.invited_user_ids.indexOf(userId);
        setPlaybook({
            ...playbook,
            invited_user_ids: [...playbook.invited_user_ids.slice(0, idx), ...playbook.invited_user_ids.slice(idx + 1)],
        });
        setChangesMade(true);
    };

    const handleAssignDefaultCommander = (userId: string | undefined) => {
        if (userId && playbook.default_commander_id !== userId) {
            setPlaybook({
                ...playbook,
                default_commander_id: userId,
            });
            setChangesMade(true);
        }
    };

    const handleAnnouncementChannelSelected = (channelId: string | undefined) => {
        if (channelId && playbook.announcement_channel_id !== channelId) {
            setPlaybook({
                ...playbook,
                announcement_channel_id: channelId,
            });
            setChangesMade(true);
        }
    };

    const handleWebhookOnCreationChange = (url: string) => {
        if (playbook.webhook_on_creation_url !== url) {
            setPlaybook({
                ...playbook,
                webhook_on_creation_url: url,
            });
            setChangesMade(true);
        }
    };

    const handleMessageOnJoinChange = (message: string) => {
        if (playbook.message_on_join !== message) {
            setPlaybook({
                ...playbook,
                message_on_join: message,
            });
            setChangesMade(true);
        }
    };

    const handleToggleMessageOnJoin = () => {
        setPlaybook({
            ...playbook,
            message_on_join_enabled: !playbook.message_on_join_enabled,
        });
        setChangesMade(true);
    };

    const handleToggleInviteUsers = () => {
        setPlaybook({
            ...playbook,
            invite_users_enabled: !playbook.invite_users_enabled,
        });
        setChangesMade(true);
    };

    const handleToggleDefaultCommander = () => {
        setPlaybook({
            ...playbook,
            default_commander_enabled: !playbook.default_commander_enabled,
        });
        setChangesMade(true);
    };

    const handleToggleAnnouncementChannel = () => {
        setPlaybook({
            ...playbook,
            announcement_channel_enabled: !playbook.announcement_channel_enabled,
        });
        setChangesMade(true);
    };

    const handleToggleWebhookOnCreation = () => {
        setPlaybook({
            ...playbook,
            webhook_on_creation_enabled: !playbook.webhook_on_creation_enabled,
        });
        setChangesMade(true);
    };

    const searchUsers = (term: string) => {
        return dispatch(searchProfiles(term, {team_id: props.currentTeam.id}));
    };

    const getUsers = () => {
        return dispatch(getProfilesInTeam(props.currentTeam.id, 0, PROFILE_CHUNK_SIZE, '', {active: true}));
    };

    const handleBroadcastInput = (channelId: string | undefined) => {
        setPlaybook({
            ...playbook,
            broadcast_channel_id: channelId || '',
        });
        setChangesMade(true);
    };

    if (!props.isNew) {
        switch (fetchingState) {
        case FetchingStateType.notFound:
            return <Redirect to={teamPluginErrorUrl(props.currentTeam.name, ErrorPageTypes.PLAYBOOKS)}/>;
        case FetchingStateType.loading:
            return null;
        }
    }

    return (
        <OuterContainer>
            <BackstageNavbar
                data-testid='backstage-nav-bar'
            >
                <BackstageNavbarIcon
                    data-testid='icon-arrow-left'
                    className='icon-arrow-left back-icon'
                    onClick={() => navigateToTeamPluginUrl(currentTeam.name, '/playbooks')}
                />
                <EditableTexts>
                    <EditableTitleContainer>
                        <EditableText
                            id='playbook-name'
                            text={playbook.title}
                            onChange={handleTitleChange}
                            placeholder={'Untitled Playbook'}
                        />
                    </EditableTitleContainer>
                </EditableTexts>
                <NavbarPadding/>
                <PrimaryButton
                    className='mr-4'
                    data-testid='save_playbook'
                    onClick={onSave}
                >
                    <span>
                        {'Save'}
                    </span>
                </PrimaryButton>
            </BackstageNavbar>
            <Container>
                <EditView>
                    <TabsHeader>
                        <Tabs
                            currentTab={currentTab}
                            setCurrentTab={setCurrentTab}
                        >
                            {'Tasks'}
                            {'Preferences'}
                            {'Automation'}
                            {'Permissions'}
                        </Tabs>
                    </TabsHeader>
                    <EditContent>
                        <TabsContent
                            currentTab={currentTab}
                        >
                            <StagesAndStepsEdit
                                checklists={playbook.checklists}
                                onChange={updateChecklist}
                            />
                            <TabContainer>
                                <SidebarBlock>
                                    <BackstageSubheader>
                                        {'Broadcast Channel'}
                                        <BackstageSubheaderDescription>
                                            {'Broadcast the incident status to an additional channel. All status posts will be shared automatically with both the incident and broadcast channel.'}
                                        </BackstageSubheaderDescription>
                                    </BackstageSubheader>
                                    <ChannelSelector
                                        id='playbook-preferences-broadcast-channel'
                                        onChannelSelected={handleBroadcastInput}
                                        channelId={playbook.broadcast_channel_id}
                                        isClearable={true}
                                        shouldRenderValue={true}
                                        isDisabled={false}
                                        captureMenuScroll={false}
                                    />
                                </SidebarBlock>
                                <SidebarBlock>
                                    <BackstageSubheader>
                                        {'Reminder Timer'}
                                        <BackstageSubheaderDescription>
                                            {'Prompts the commander at a specified interval to update the status of the Incident.'}
                                        </BackstageSubheaderDescription>
                                    </BackstageSubheader>
                                    <StyledSelect
                                        value={timerOptions.find((option) => option.value === playbook.reminder_timer_default_seconds)}
                                        onChange={(option: { label: string, value: number }) => {
                                            setPlaybook({
                                                ...playbook,
                                                reminder_timer_default_seconds: option ? option.value : option,
                                            });
                                            setChangesMade(true);
                                        }}
                                        classNamePrefix='channel-selector'
                                        options={timerOptions}
                                        isClearable={true}
                                    />
                                </SidebarBlock>
                                <SidebarBlock>
                                    <BackstageSubheader>
                                        {'Incident overview template'}
                                        <BackstageSubheaderDescription>
                                            {'This message is used to describe the incident when it\'s started. As the incident progresses, use Update Status to update the description. The message is displayed in the RHS and on the Overview page.'}
                                        </BackstageSubheaderDescription>
                                    </BackstageSubheader>
                                    <StyledTextarea
                                        placeholder={'Enter incident overview template.'}
                                        value={playbook.description}
                                        onChange={(e) => {
                                            setPlaybook({
                                                ...playbook,
                                                description: e.target.value,
                                            });
                                            setChangesMade(true);
                                        }}
                                    />
                                </SidebarBlock>
                                <SidebarBlock>
                                    <BackstageSubheader>
                                        {'Incident update template'}
                                        <BackstageSubheaderDescription>
                                            {'This message is used to describe changes made to an active incident since the last update. The message is displayed in the RHS and Overview page.'}
                                        </BackstageSubheaderDescription>
                                    </BackstageSubheader>
                                    <StyledTextarea
                                        placeholder={'Enter incident update template'}
                                        value={playbook.reminder_message_template}
                                        onChange={(e) => {
                                            setPlaybook({
                                                ...playbook,
                                                reminder_message_template: e.target.value,
                                            });
                                            setChangesMade(true);
                                        }}
                                    />
                                </SidebarBlock>
                            </TabContainer>
                            <TabContainer>
                                <AutomationSettings
                                    searchProfiles={searchUsers}
                                    getProfiles={getUsers}
                                    userIds={playbook.invited_user_ids}
                                    inviteUsersEnabled={playbook.invite_users_enabled}
                                    onToggleInviteUsers={handleToggleInviteUsers}
                                    onAddUser={handleAddUserInvited}
                                    onRemoveUser={handleRemoveUserInvited}
                                    defaultCommanderEnabled={playbook.default_commander_enabled}
                                    defaultCommanderID={playbook.default_commander_id}
                                    onToggleDefaultCommander={handleToggleDefaultCommander}
                                    onAssignCommander={handleAssignDefaultCommander}
                                    teamID={playbook.team_id}
                                    announcementChannelID={playbook.announcement_channel_id}
                                    announcementChannelEnabled={playbook.announcement_channel_enabled}
                                    onToggleAnnouncementChannel={handleToggleAnnouncementChannel}
                                    onAnnouncementChannelSelected={handleAnnouncementChannelSelected}
                                    webhookOnCreationEnabled={playbook.webhook_on_creation_enabled}
                                    onToggleWebhookOnCreation={handleToggleWebhookOnCreation}
                                    webhookOnCreationChange={handleWebhookOnCreationChange}
                                    webhookOnCreationURL={playbook.webhook_on_creation_url}
                                    messageOnJoinEnabled={playbook.message_on_join_enabled}
                                    onToggleMessageOnJoin={handleToggleMessageOnJoin}
                                    messageOnJoin={playbook.message_on_join || defaultMessageOnJoin}
                                    messageOnJoinChange={handleMessageOnJoinChange}
                                />
                            </TabContainer>
                            <TabContainer>
                                <SidebarBlock>
                                    <BackstageSubheader>
                                        {'Channel access'}
                                        <BackstageSubheaderDescription>
                                            {'Determine the type of incident channel this playbook creates when starting an incident.'}
                                        </BackstageSubheaderDescription>
                                    </BackstageSubheader>
                                    <RadioContainer>
                                        <RadioLabel>
                                            <RadioInput
                                                type='radio'
                                                name='public'
                                                value={'public'}
                                                checked={playbook.create_public_incident}
                                                onChange={handlePublicChange}
                                            />
                                            {'Public'}
                                        </RadioLabel>
                                        <RadioLabel>
                                            <RadioInput
                                                type='radio'
                                                name='public'
                                                value={'private'}
                                                checked={!playbook.create_public_incident}
                                                onChange={handlePublicChange}
                                            />
                                            {'Private'}
                                        </RadioLabel>
                                    </RadioContainer>
                                </SidebarBlock>
                                <SidebarBlock>
                                    <SharePlaybook
                                        currentUserId={currentUserId}
                                        onAddUser={handleUsersInput}
                                        onRemoveUser={handleRemoveUser}
                                        searchProfiles={searchUsers}
                                        getProfiles={getUsers}
                                        playbook={playbook}
                                        onClear={handleClearUsers}
                                    />
                                </SidebarBlock>
                            </TabContainer>
                        </TabsContent>
                    </EditContent>
                </EditView>
            </Container>
            <Prompt
                when={changesMade}
                message={'Are you sure you want to discard your changes?'}
            />
        </OuterContainer>
    );
};

export default PlaybookEdit;
