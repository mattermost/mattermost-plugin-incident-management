// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useRef, useState} from 'react';
import ReactDOM from 'react-dom';
import {getChannelsNameMapInCurrentTeam} from 'mattermost-redux/selectors/entities/channels';
import {getCurrentRelativeTeamUrl, getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';
import {GlobalState} from 'mattermost-redux/types/store';
import {Team} from 'mattermost-redux/types/teams';
import {Overlay, Popover, PopoverProps} from 'react-bootstrap';
import Scrollbars from 'react-custom-scrollbars';
import {useDispatch, useSelector} from 'react-redux';
import {components, ControlProps} from 'react-select';
import styled from 'styled-components';
import {DraggableProvided} from 'react-beautiful-dnd';

import {handleFormattedTextClick} from 'src/browser_routing';
import {
    clientRemoveChecklistItem, clientRunChecklistItemSlashCommand,
    setAssignee,
    clientEditChecklistItem,
} from 'src/client';
import Spinner from 'src/components/assets/icons/spinner';
import {ChecklistItemButton} from 'src/components/checklist_item_input';
import Profile from 'src/components/profile/profile';
import ProfileSelector from 'src/components/profile/profile_selector';
import {HoverMenu, HoverMenuButton} from 'src/components/rhs/rhs_shared';
import {formatText, messageHtmlToComponent} from 'src/webapp_globals';
import ConfirmModal from 'src/components/widgets/confirmation_modal';
import {useClickOutsideRef, useProfilesInCurrentChannel, useTimeout} from 'src/hooks';
import {ChannelNamesMap} from 'src/types/backstage';
import {ChecklistItem, ChecklistItemState} from 'src/types/playbook';
import TextWithTooltipWhenEllipsis from 'src/components/widgets/text_with_tooltip_when_ellipsis';

import CommandInput from './command_input';
import GenericModal from './widgets/generic_modal';
import {BaseInput} from './assets/inputs';
import {StyledTextarea} from './backstage/styles';

interface ChecklistItemDetailsProps {
    checklistItem: ChecklistItem;
    checklistNum: number;
    itemNum: number;
    channelId: string;
    playbookRunId: string;
    onChange?: (item: ChecklistItemState) => void;
    onRedirect?: () => void;
    draggableProvided: DraggableProvided;
    dragging: boolean;
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

    > div {
        margin: 0 5px;
        border: 1px solid rgba(var(--center-channel-color-rgb), 0.08);
        border-radius: 13px;
        padding: 2px 8px;
        background: rgba(var(--center-channel-color-rgb), 0.08);
        display: flex;
        max-width: 100%;
    }
`;

const SmallProfile = styled(Profile)`
    > .image {
        width: 16px;
        height: 16px;
    }
`;

export const CheckboxContainer = styled.div`
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
                title={'Description'}
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
                className='PlaybookRunFilter-reset'
                onClick={ownProps.selectProps.onCustomReset}
            >
                {'No Assignee'}
            </a>
        )}
    </div>
);

const portal: HTMLElement = document.createElement('div');
document.body.appendChild(portal);

export const ChecklistItemDetails = (props: ChecklistItemDetailsProps): React.ReactElement => {
    const commandRef = useRef(null);
    const dispatch = useDispatch();
    const channelNamesMap = useSelector<GlobalState, ChannelNamesMap>(getChannelsNameMapInCurrentTeam);
    const team = useSelector<GlobalState, Team>(getCurrentTeam);
    const relativeTeamUrl = useSelector<GlobalState, string>(getCurrentRelativeTeamUrl);
    const profilesInChannel = useProfilesInCurrentChannel();

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
    const [showEditDialog, setShowEditDialog] = useState(false);

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
        if (!props.playbookRunId) {
            return;
        }
        const response = await setAssignee(props.playbookRunId, props.checklistNum, props.itemNum, userId);
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

    const content = (
        <>
            <ItemContainer
                ref={props.draggableProvided.innerRef}
                {...props.draggableProvided.draggableProps}
                onMouseEnter={() => setShowMenu(true)}
                onMouseLeave={() => setShowMenu(false)}
                data-testid='checkbox-item-container'
            >
                <CheckboxContainer>
                    {showMenu &&
                    <HoverMenu>
                        <HoverMenuButton
                            title={'Drag me to reorder'}
                            className={'icon icon-menu'}
                            {...props.draggableProvided.dragHandleProps}
                        />
                        {props.checklistItem.description !== '' &&
                        <StepDescription
                            text={props.checklistItem.description}
                            channelNames={channelNamesMap}
                            team={team}
                        />
                        }
                        <ProfileSelector
                            selectedUserId={props.checklistItem.assignee_id}
                            onlyPlaceholder={true}
                            placeholder={
                                <HoverMenuButton
                                    title={'Assign'}
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
                        <HoverMenuButton
                            title={'Edit'}
                            className={'icon-pencil-outline icon-16 btn-icon'}
                            onClick={() => {
                                setShowEditDialog(true);
                            }}
                        />
                        <HoverMenuButton
                            title={'Delete'}
                            className={'icon-trash-can-outline icon-16 btn-icon'}
                            onClick={() => {
                                setShowDeleteConfirm(true);
                            }}
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
                        <div ref={commandRef}>
                            <Run
                                data-testid={'run'}
                                running={running}
                                onClick={() => {
                                    if (!running) {
                                        setRunning(true);
                                        clientRunChecklistItemSlashCommand(dispatch, props.playbookRunId, props.checklistNum, props.itemNum);
                                    }
                                }}
                            >
                                {props.checklistItem.command_last_run ? 'Rerun' : 'Run'}
                            </Run>
                            <Command>
                                <TextWithTooltipWhenEllipsis
                                    id={props.checklistNum.toString(10)}
                                    text={props.checklistItem.command}
                                    parentRef={commandRef}
                                />
                            </Command>
                            {running && <StyledSpinner/>}
                        </div>
                    }
                </ExtrasRow>
            </ItemContainer>
            <ConfirmModal
                show={showDeleteConfirm}
                title={'Delete task'}
                message={'Are you sure you want to delete this task? This will be removed from this run but will not affect the playbook.'}
                confirmButtonText={'Delete'}
                onConfirm={() =>
                    clientRemoveChecklistItem(props.playbookRunId, props.checklistNum, props.itemNum)
                }
                onCancel={() => setShowDeleteConfirm(false)}
            />
            <ChecklistItemEditModal
                show={showEditDialog}
                playbookRunId={props.playbookRunId}
                checklistNum={props.checklistNum}
                itemNum={props.itemNum}
                onDone={() => setShowEditDialog(false)}
                taskTitle={props.checklistItem.title}
                taskDescription={props.checklistItem.description}
                taskCommand={props.checklistItem.command}
            />
        </>
    );

    if (props.dragging) {
        return ReactDOM.createPortal(content, portal);
    }

    return content;
};

interface ChecklistItemEditModalProps {
    show: boolean
    onDone: () => void
    checklistNum: number
    playbookRunId: string
    itemNum: number
    taskTitle: string
    taskDescription: string
    taskCommand: string
}

const ModalField = styled(BaseInput)`
    width: 100%;
`;

const FormContainer = styled.div`
    display: flex;
    flex-direction: column;
    color: var(--center-channel-color);

    > * {
        margin-bottom: 10px;
    }
`;

const ChecklistItemEditModal = (props: ChecklistItemEditModalProps) => {
    const [title, setTitle] = useState(props.taskTitle);
    const [description, setDescription] = useState<string>(props.taskDescription);
    const [command, setCommand] = useState(props.taskCommand);

    const submit = () => {
        clientEditChecklistItem(props.playbookRunId, props.checklistNum, props.itemNum, {
            title,
            command,
            description,
        });
        props.onDone();
    };

    return (
        <GenericModal
            id={'taskEditModalc' + props.checklistNum + 'i' + props.itemNum}
            show={props.show}
            modalHeaderText={'Edit task'}
            onHide={props.onDone}
            confirmButtonText={'Edit task'}
            cancelButtonText={'Cancel'}
            handleCancel={props.onDone}
            handleConfirm={submit}
        >
            <FormContainer>
                <ModalField
                    placeholder={'Task name'}
                    type='text'
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    autoFocus={true}
                />
                <CommandInput
                    command={command}
                    setCommand={setCommand}
                    autocompleteOnBottom={true}
                />
                <StyledTextarea
                    value={description}
                    placeholder={'Description'}
                    onChange={(e) => setDescription(e.target.value)}
                />
            </FormContainer>
        </GenericModal>
    );
};
