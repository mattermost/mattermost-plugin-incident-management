// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {FC, useRef, useState} from 'react';
import {useDispatch, useSelector} from 'react-redux';
import {components, ControlProps} from 'react-select';
import styled from 'styled-components';
import {Overlay, Popover, PopoverProps} from 'react-bootstrap';
import Scrollbars from 'react-custom-scrollbars';

import {GlobalState} from 'mattermost-redux/types/store';
import {Team} from 'mattermost-redux/types/teams';
import {getChannelsNameMapInCurrentTeam} from 'mattermost-redux/selectors/entities/channels';
import {getCurrentRelativeTeamUrl, getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';

import {
    clientRunChecklistItemSlashCommand,
    setAssignee,
    clientRemoveChecklistItem,
} from 'src/client';
import Spinner from 'src/components/assets/icons/spinner';
import ProfileSelector from 'src/components/profile/profile_selector';
import {useTimeout, useClickOutsideRef, useProfilesInChannel} from 'src/hooks';
import {handleFormattedTextClick} from 'src/browser_routing';
import {ChannelNamesMap} from 'src/types/backstage';
import {ChecklistItem, ChecklistItemState} from 'src/types/playbook';
import {messageHtmlToComponent, formatText} from 'src/components/shared';
import {HoverMenu, HoverMenuButton} from 'src/components/rhs/rhs_shared';
import Profile from 'src/components/profile/profile';
import ConfirmModal from 'src/components/widgets/confirmation_modal';

interface ChecklistItemDetailsProps {
    checklistItem: ChecklistItem;
    checklistNum: number;
    itemNum: number;
    channelId: string;
    incidentId: string;
    onChange?: (item: ChecklistItemState) => void;
    onRedirect?: () => void;
}

const RunningTimeout = 1000;

const StyledPopover = styled(Popover) <PopoverProps>`
    min-width: 180px;
    border-radius: 8px;

    .popover-content {
        padding: 16px 0px 15px 20px;
    }

    && .arrow {
        display: block;
    }
`;

const PaddedDiv = styled.div`
    padding-right: 15px;
`;

const DescriptionTitle = styled.span`
    font-family: Open Sans;
    font-style: normal;
    font-weight: 600;
    font-size: 14px;
    line-height: 20px;
    color: var(--center-channel-color);
`;

const StyledSpinner = styled(Spinner)`
    margin-left: 4px;
    padding-top: 3px;
`;

const ItemContainer = styled.div`
    padding-top: 1.3rem;
    :first-child {
        padding-top: 0.4rem;
    }
`;

const ExtrasRow = styled.div`
    display: flex;
    margin: 4px 0 0 32px;
    line-height: 16px;
    >div {
        margin: 0 5px;
        border: 1px solid rgba(var(--center-channel-color-rgb), 0.08);
        border-radius: 13px;
        padding: 2px 8px;
        background: rgba(var(--center-channel-color-rgb), 0.08);
        display: flex;
    }
`;

const SmallProfile = styled(Profile)`
    >.image {
        width: 16px;
        height: 16px;
    }
`;

const CheckboxContainer = styled.div`
    align-items: flex-start;
    display: flex;
    position: relative;

    button {
        width: 53px;
        height: 29px;
        border: 1px solid #166DE0;
        box-sizing: border-box;
        border-radius: 4px;
        font-family: Open Sans;
        font-style: normal;
        font-weight: 600;
        font-size: 12px;
        line-height: 17px;
        text-align: center;
        background: #ffffff;
        color: #166DE0;
        cursor: pointer;
        margin-right: 13px;
    }

    button:disabled {
        border: 0px;
        color: var(--button-color);
        background: var(--center-channel-color-56);
        cursor: default;
    }

    &:hover {
        .checkbox-container__close {
            opacity: 1;
        }
    }

    .icon-bars {
        padding: 0 0.8rem 0 0;
    }

    input[type="checkbox"] {
        -webkit-appearance: none;
        -moz-appearance: none;
        appearance: none;
        width: 20px;
        min-width: 20px;
        height: 20px;
        background: #ffffff;
        border: 2px solid var(--center-channel-color-24);
        border-radius: 4px;
        margin: 0;
        cursor: pointer;
        margin-right: 12px;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    input[type="checkbox"]:checked {
        background: var(--button-bg);
        border: 1px solid var(--button-bg);
        box-sizing: border-box;
    }

    input[type="checkbox"]::before {
        font-family: 'compass-icons', mattermosticons;
        text-rendering: auto;
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
        content: "\f12c";
        font-size: 12px;
        font-weight: bold;
        color: #ffffff;
        transition: transform 0.15s;
        transform: scale(0) rotate(90deg);
        position: relative;
    }

    input[type="checkbox"]:checked::before {
        transform: scale(1) rotate(0deg);
    }

    label {
        font-weight: normal;
        word-break: break-word;
        display: inline;
        margin: 0;
        margin-right: 8px;
        flex-grow: 1;
    }
`;

const Command = styled.div`
    word-break: break-word;
    display: inline;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    padding: 2px 4px;
    border-radius: 4px;
    font-size: 11px;
`;

interface RunProps {
    running: boolean;
}

const Run = styled.div<RunProps>`
    font-size: 12px;
    font-weight: bold;
    display: inline;
    color: var(--link-color);
    cursor: pointer;
    margin: 2px 4px 0 0;

    &:hover {
        text-decoration: underline;
    }

    ${({running}) => running && `
        color: var(--center-channel-color-64);
        cursor: default;

        &:hover {
            text-decoration: none;
        }
    `}
`;

interface StepDescriptionProps {
    text: string;
    channelNames: ChannelNamesMap;
    team: Team;
}

const StepDescription = (props: StepDescriptionProps): React.ReactElement<StepDescriptionProps> => {
    const [showTooltip, setShowTooltip] = useState(false);
    const target = useRef(null);
    const popoverRef = useRef(null);
    useClickOutsideRef(popoverRef, () => {
        setShowTooltip(false);
    });
    const markdownOptions = {
        atMentions: true,
        team: props.team,
        channelNamesMap: props.channelNames,
    };

    return (
        <>
            <HoverMenuButton
                tabIndex={0}
                className={'icon-information-outline icon-16 btn-icon'}
                ref={target}
                onClick={() => setShowTooltip(!showTooltip)}
            />
            <Overlay
                show={showTooltip}
                placement={'top'}
                target={target.current}
            >
                <StyledPopover id='info-icon'>
                    <div
                        ref={popoverRef}
                    >
                        <DescriptionTitle>{'Step Description'}</DescriptionTitle>
                        <Scrollbars
                            autoHeight={true}
                            autoHeightMax={200}
                            renderThumbVertical={(thumbProps) => (
                                <div
                                    {...thumbProps}
                                    className='scrollbar--vertical'
                                />
                            )}
                        >
                            <PaddedDiv>
                                {messageHtmlToComponent(formatText(props.text, markdownOptions), true, {})}
                            </PaddedDiv>
                        </Scrollbars>
                    </div>
                </StyledPopover>
            </Overlay>
        </>
    );
};

const ControlComponent = (ownProps: ControlProps<any>) => (
    <div>
        <components.Control {...ownProps}/>
        {ownProps.selectProps.showCustomReset && (
            <a
                className='IncidentFilter-reset'
                onClick={ownProps.selectProps.onCustomReset}
            >
                {'No Assignee'}
            </a>
        )}
    </div>
);

export const ChecklistItemDetails = (props: ChecklistItemDetailsProps): React.ReactElement => {
    const dispatch = useDispatch();
    const channelNamesMap = useSelector<GlobalState, ChannelNamesMap>(getChannelsNameMapInCurrentTeam);
    const team = useSelector<GlobalState, Team>(getCurrentTeam);
    const relativeTeamUrl = useSelector<GlobalState, string>(getCurrentRelativeTeamUrl);
    const profilesInChannel = useProfilesInChannel();

    const markdownOptions = {
        singleline: true,
        mentionHighlight: false,
        atMentions: true,
        team,
        channelNamesMap,
    };

    const [running, setRunning] = useState(false);
    const [lastRun, setLastRun] = useState(props.checklistItem.command_last_run);
    const [showMenu, setShowMenu] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    // Immediately stop the running indicator when we get notified of a more recent execution.
    if (props.checklistItem.command_last_run > lastRun) {
        setRunning(false);
        setLastRun(props.checklistItem.command_last_run);
    }

    // Setting running to true triggers the timeout by setting the delay to RunningTimeout
    useTimeout(() => setRunning(false), running ? RunningTimeout : null);

    const fetchUsers = async () => {
        return profilesInChannel;
    };

    const onAssigneeChange = async (userId?: string) => {
        if (!props.incidentId) {
            return;
        }
        const response = await setAssignee(props.incidentId, props.checklistNum, props.itemNum, userId);
        if (response.error) {
            // TODO: Should be presented to the user? https://mattermost.atlassian.net/browse/MM-24271
            console.log(response.error); // eslint-disable-line no-console
        }
    };

    const [profileSelectorToggle, setProfileSelectorToggle] = useState(false);
    const assignee_id = props.checklistItem.assignee_id; // to make typescript happy

    const title = props.checklistItem.title;

    const resetAssignee = () => {
        onAssigneeChange();
        setProfileSelectorToggle(!profileSelectorToggle);
    };

    return (
        <ItemContainer
            onMouseEnter={() => setShowMenu(true)}
            onMouseLeave={() => setShowMenu(false)}
            data-testid='checkbox-item-container'
        >
            <CheckboxContainer>
                {showMenu &&
                    <HoverMenu>
                        {props.checklistItem.description !== '' &&
                            <StepDescription
                                text={props.checklistItem.description}
                                channelNames={channelNamesMap}
                                team={team}
                            />
                        }
                        <HoverMenuButton
                            className={'icon-trash-can-outline icon-16 btn-icon'}
                            onClick={() => {
                                setShowDeleteConfirm(true);
                            }}
                        />
                        <ProfileSelector
                            selectedUserId={props.checklistItem.assignee_id}
                            onlyPlaceholder={true}
                            placeholder={
                                <HoverMenuButton
                                    className={'icon-account-plus-outline icon-16 btn-icon'}
                                />
                            }
                            enableEdit={true}
                            getUsers={fetchUsers}
                            onSelectedChange={onAssigneeChange}
                            selfIsFirstOption={true}
                            customControl={ControlComponent}
                            customControlProps={{
                                showCustomReset: Boolean(assignee_id),
                                onCustomReset: resetAssignee,
                            }}
                            controlledOpenToggle={profileSelectorToggle}
                            showOnRight={true}
                        />
                    </HoverMenu>
                }
                <ChecklistItemButton
                    item={props.checklistItem}
                    onChange={(item: ChecklistItemState) => {
                        if (props.onChange) {
                            props.onChange(item);
                        }
                    }}
                />
                <label title={title}>
                    <div
                        onClick={((e) => handleFormattedTextClick(e, relativeTeamUrl))}
                    >
                        {messageHtmlToComponent(formatText(title, markdownOptions), true, {})}
                    </div>
                </label>
            </CheckboxContainer>
            <ExtrasRow>
                {props.checklistItem.assignee_id &&
                    <SmallProfile
                        userId={props.checklistItem.assignee_id}
                    />
                }
                {
                    props.checklistItem.command !== '' &&
                    <div>
                        <Run
                            data-testid={'run'}
                            running={running}
                            onClick={() => {
                                if (!running) {
                                    setRunning(true);
                                    clientRunChecklistItemSlashCommand(dispatch, props.incidentId, props.checklistNum, props.itemNum);
                                }
                            }}
                        >
                            {props.checklistItem.command_last_run ? 'Rerun' : 'Run'}
                        </Run>
                        <Command>
                            {props.checklistItem.command}
                        </Command>
                        {running && <StyledSpinner/>}
                    </div>
                }
            </ExtrasRow>
            <ConfirmModal
                show={showDeleteConfirm}
                title={'Confirm Task Delete'}
                message={`Are you sure you want to delete this task? "${title}"?`}
                confirmButtonText={'Delete Task'}
                onConfirm={() =>
                    clientRemoveChecklistItem(props.incidentId, props.checklistNum, props.itemNum)
                }
                onCancel={() => setShowDeleteConfirm(false)}
            />
        </ItemContainer>
    );
};

interface ChecklistItemButtonProps {
    onChange: (item: ChecklistItemState) => void;
    item: ChecklistItem;
}

const ChecklistItemButton: FC<ChecklistItemButtonProps> = (props: ChecklistItemButtonProps) => {
    const isChecked = props.item.state === ChecklistItemState.Closed;

    return (
        <input
            className='checkbox'
            type='checkbox'
            checked={isChecked}
            onChange={() => {
                if (isChecked) {
                    props.onChange(ChecklistItemState.Open);
                } else {
                    props.onChange(ChecklistItemState.Closed);
                }
            }}
        />);
};

