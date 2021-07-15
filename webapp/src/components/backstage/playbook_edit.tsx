// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useEffect} from 'react';
import {Redirect, useParams, useLocation} from 'react-router-dom';
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
import {Playbook, Checklist, emptyPlaybook} from 'src/types/playbook';
import {savePlaybook, clientFetchPlaybook} from 'src/client';
import {StagesAndStepsEdit} from 'src/components/backstage/stages_and_steps_edit';
import {ErrorPageTypes, TEMPLATE_TITLE_KEY, PROFILE_CHUNK_SIZE} from 'src/constants';
import {PrimaryButton} from 'src/components/assets/buttons';
import {BackstageNavbar} from 'src/components/backstage/backstage';
import {AutomationSettings} from 'src/components/backstage/automation/settings';
import RouteLeavingGuard from 'src/components/backstage/route_leaving_guard';
import {SecondaryButtonSmaller} from 'src/components/backstage/playbook_runs/shared';

import './playbook.scss';
import {useAllowRetrospectiveAccess, useExperimentalFeaturesEnabled} from 'src/hooks';

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

const SecondaryButtonLarger = styled(SecondaryButtonSmaller)`
    height: 40px;
    font-weight: 600;
    font-size: 14px;
    padding: 0 20px;
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
    tabId?: string;
}

const FetchingStateType = {
    loading: 'loading',
    fetched: 'fetched',
    notFound: 'notfound',
};

// setPlaybookDefaults fills in a playbook with defaults for any fields left empty.
const setPlaybookDefaults = (playbook: Playbook) => ({
    ...playbook,
    title: playbook.title.trim() || 'Untitled playbook',
    checklists: playbook.checklists.map((checklist) => ({
        ...checklist,
        title: checklist.title || 'Untitled checklist',
        items: checklist.items.map((item) => ({
            ...item,
            title: item.title || 'Untitled task',
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

const tabInfo = [
    {id: 'checklists', name: 'Checklists'},
    {id: 'templates', name: 'Templates'},
    {id: 'actions', name: 'Actions'},
    {id: 'permissions', name: 'Permissions'},
];

const retrospectiveReminderOptions = [
    {value: 0, label: 'Once'},
    {value: 3600, label: '1hr'},
    {value: 14400, label: '4hr'},
    {value: 86400, label: '24hr'},
    {value: 604800, label: '7days'},
];

// @ts-ignore
const WebappUtils = window.WebappUtils;

const PlaybookEdit = (props: Props) => {
    const dispatch = useDispatch();

    const currentTeam = useSelector<GlobalState, Team>(getCurrentTeam);
    const currentUserId = useSelector(getCurrentUserId);

    const [playbook, setPlaybook] = useState<Playbook>({
        ...emptyPlaybook(),
        team_id: props.currentTeam.id,
    });
    const [changesMade, setChangesMade] = useState(false);

    const urlParams = useParams<URLParams>();
    const location = useLocation();

    const [fetchingState, setFetchingState] = useState(FetchingStateType.loading);

    let tab = 0;
    if (urlParams.tabId) {
        for (let i = 0; i < tabInfo.length; i++) {
            if (urlParams.tabId === tabInfo[i].id) {
                tab = i;
            }
        }
    }

    const [currentTab, setCurrentTab] = useState<number>(tab);

    const experimentalFeaturesEnabled = useExperimentalFeaturesEnabled();

    const retrospectiveAccess = useAllowRetrospectiveAccess();

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

    const onSave = async () => {
        const data = await savePlaybook(setPlaybookDefaults(playbook));
        setChangesMade(false);
        onClose(data?.id);
    };

    const onClose = (id?: string) => {
        const playbookId = urlParams.playbookId || id;
        if (playbookId) {
            navigateToTeamPluginUrl(currentTeam.name, `/playbooks/${playbookId}`);
        } else {
            navigateToTeamPluginUrl(currentTeam.name, '/playbooks');
        }
    };

    const handlePublicChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setPlaybook({
            ...playbook,
            create_public_playbook_run: e.target.value === 'public',
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

    const handleAssignDefaultOwner = (userId: string | undefined) => {
        if ((userId || userId === '') && playbook.default_owner_id !== userId) {
            setPlaybook({
                ...playbook,
                default_owner_id: userId,
            });
            setChangesMade(true);
        }
    };

    const handleAnnouncementChannelSelected = (channelId: string | undefined) => {
        if ((channelId || channelId === '') && playbook.announcement_channel_id !== channelId) {
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

    const handleWebhookOnStatusUpdateChange = (url: string) => {
        if (playbook.webhook_on_status_update_url !== url) {
            setPlaybook({
                ...playbook,
                webhook_on_status_update_url: url,
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

    const handleToggleDefaultOwner = () => {
        setPlaybook({
            ...playbook,
            default_owner_enabled: !playbook.default_owner_enabled,
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

    const handleSignalAnyKeywordsChange = (keywords: string) => {
        setPlaybook({
            ...playbook,
            signal_any_keywords: keywords.split(','),
        });
        setChangesMade(true);
    };

    const handleToggleSignalAnyKeywords = () => {
        setPlaybook({
            ...playbook,
            signal_any_keywords_enabled: !playbook.signal_any_keywords_enabled,
        });
        setChangesMade(true);
    };

    const handleToggleWebhookOnStatusUpdate = () => {
        setPlaybook({
            ...playbook,
            webhook_on_status_update_enabled: !playbook.webhook_on_status_update_enabled,
        });
        setChangesMade(true);
    };

    const handleToggleExportChannelOnArchiveEnabled = () => {
        setPlaybook({
            ...playbook,
            export_channel_on_archive_enabled: !playbook.export_channel_on_archive_enabled,
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

    const handleOnAppendKeyword = (keyword: string) => {
        setPlaybook({
            ...playbook,
            signal_any_keywords: [...playbook.signal_any_keywords, keyword],
        });
        setChangesMade(true);
    };

    const handleOnRemoveKeyword = (i: number) => {
        const newKeywords = [...playbook.signal_any_keywords];
        newKeywords.splice(i, 1);
        setPlaybook({
            ...playbook,
            signal_any_keywords: newKeywords,
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
                <EditableTexts>
                    <EditableTitleContainer>
                        <EditableText
                            id='playbook-name'
                            text={playbook.title}
                            onChange={handleTitleChange}
                            placeholder={'Untitled playbook'}
                        />
                    </EditableTitleContainer>
                </EditableTexts>
                <NavbarPadding/>
                <SecondaryButtonLarger
                    className='mr-4'
                    onClick={() => onClose()}
                >
                    <span>
                        {'Cancel'}
                    </span>
                </SecondaryButtonLarger>
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
                            {tabInfo.map((item) => {
                                return (item.name);
                            })}
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
                                        {'Broadcast channel'}
                                        <BackstageSubheaderDescription>
                                            {'Updates will be automatically posted as a message to the configured channel below in addition to the primary channel.'}
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
                                        {'Reminder timer'}
                                        <BackstageSubheaderDescription>
                                            {'Prompts the owner at a specified interval to provide a status update.'}
                                        </BackstageSubheaderDescription>
                                    </BackstageSubheader>
                                    <StyledSelect
                                        value={timerOptions.find((option) => option.value === playbook.reminder_timer_default_seconds)}
                                        onChange={(option: {label: string, value: number}) => {
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
                                        {'Description'}
                                        <BackstageSubheaderDescription>
                                            {'This template helps to standardize the format for a concise description that explains each run to its stakeholders.'}
                                        </BackstageSubheaderDescription>
                                    </BackstageSubheader>
                                    <StyledTextarea
                                        placeholder={'Use Markdown to create a template.'}
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
                                        {'Status updates'}
                                        <BackstageSubheaderDescription>
                                            {'This template helps to standardize the format for recurring updates that take place throughout each run to keep.'}
                                        </BackstageSubheaderDescription>
                                    </BackstageSubheader>
                                    <StyledTextarea
                                        placeholder={'Use Markdown to create a template.'}
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
                                {retrospectiveAccess &&
                                    <>
                                        <SidebarBlock>
                                            <BackstageSubheader>
                                                {'Retrospective Reminder Interval'}
                                                <BackstageSubheaderDescription>
                                                    {'Reminds the channel at a specified interval to fill out the retrospective.'}
                                                </BackstageSubheaderDescription>
                                            </BackstageSubheader>
                                            <StyledSelect
                                                value={retrospectiveReminderOptions.find((option) => option.value === playbook.retrospective_reminder_interval_seconds)}
                                                onChange={(option: {label: string, value: number}) => {
                                                    setPlaybook({
                                                        ...playbook,
                                                        retrospective_reminder_interval_seconds: option ? option.value : option,
                                                    });
                                                    setChangesMade(true);
                                                }}
                                                classNamePrefix='channel-selector'
                                                options={retrospectiveReminderOptions}
                                                isClearable={false}
                                            />
                                        </SidebarBlock>
                                        <SidebarBlock>
                                            <BackstageSubheader>
                                                {'Retrospective Template'}
                                                <BackstageSubheaderDescription>
                                                    {'Default text for the retrospective.'}
                                                </BackstageSubheaderDescription>
                                            </BackstageSubheader>
                                            <StyledTextarea
                                                placeholder={'Enter retrospective template'}
                                                value={playbook.retrospective_template}
                                                onChange={(e) => {
                                                    setPlaybook({
                                                        ...playbook,
                                                        retrospective_template: e.target.value,
                                                    });
                                                    setChangesMade(true);
                                                }}
                                            />
                                        </SidebarBlock>
                                    </>
                                }
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
                                    defaultOwnerEnabled={playbook.default_owner_enabled}
                                    defaultOwnerID={playbook.default_owner_id}
                                    onToggleDefaultOwner={handleToggleDefaultOwner}
                                    onAssignOwner={handleAssignDefaultOwner}
                                    teamID={playbook.team_id}
                                    announcementChannelID={playbook.announcement_channel_id}
                                    announcementChannelEnabled={playbook.announcement_channel_enabled}
                                    onToggleAnnouncementChannel={handleToggleAnnouncementChannel}
                                    onAnnouncementChannelSelected={handleAnnouncementChannelSelected}
                                    webhookOnCreationEnabled={playbook.webhook_on_creation_enabled}
                                    onToggleWebhookOnCreation={handleToggleWebhookOnCreation}
                                    webhookOnCreationChange={handleWebhookOnCreationChange}
                                    webhookOnCreationURL={playbook.webhook_on_creation_url}
                                    webhookOnStatusUpdateEnabled={playbook.webhook_on_status_update_enabled}
                                    onToggleWebhookOnStatusUpdate={handleToggleWebhookOnStatusUpdate}
                                    webhookOnStatusUpdateURL={playbook.webhook_on_status_update_url}
                                    webhookOnStatusUpdateChange={handleWebhookOnStatusUpdateChange}
                                    messageOnJoinEnabled={playbook.message_on_join_enabled}
                                    onToggleMessageOnJoin={handleToggleMessageOnJoin}
                                    messageOnJoin={playbook.message_on_join}
                                    messageOnJoinChange={handleMessageOnJoinChange}
                                    onToggleExportChannelOnArchiveEnabled={handleToggleExportChannelOnArchiveEnabled}
                                    exportChannelOnArchiveEnabled={playbook.export_channel_on_archive_enabled}
                                    signalAnyKeywordsEnabled={playbook.signal_any_keywords_enabled}
                                    onToggleSignalAnyKeywords={handleToggleSignalAnyKeywords}
                                    signalAnyKeywordsChange={handleSignalAnyKeywordsChange}
                                    signalAnyKeywords={playbook.signal_any_keywords}
                                    onAppendKeyword={handleOnAppendKeyword}
                                    onRemoveKeyword={handleOnRemoveKeyword}
                                />
                            </TabContainer>
                            <TabContainer>
                                <SidebarBlock>
                                    <BackstageSubheader>
                                        {'Channel access'}
                                        <BackstageSubheaderDescription>
                                            {'Determine the type of channel this playbook creates.'}
                                        </BackstageSubheaderDescription>
                                    </BackstageSubheader>
                                    <RadioContainer>
                                        <RadioLabel>
                                            <RadioInput
                                                type='radio'
                                                name='public'
                                                value={'public'}
                                                checked={playbook.create_public_playbook_run}
                                                onChange={handlePublicChange}
                                            />
                                            {'Public'}
                                        </RadioLabel>
                                        <RadioLabel>
                                            <RadioInput
                                                type='radio'
                                                name='public'
                                                value={'private'}
                                                checked={!playbook.create_public_playbook_run}
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
            <RouteLeavingGuard
                navigate={(path) => WebappUtils.browserHistory.push(path)}
                shouldBlockNavigation={() => changesMade}
            />
        </OuterContainer>
    );
};

export default PlaybookEdit;
