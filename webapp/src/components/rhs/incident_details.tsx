// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {FC, useState} from 'react';
import {useDispatch} from 'react-redux';
import Scrollbars from 'react-custom-scrollbars';
import styled, {css} from 'styled-components';

import {
    fetchUsersInChannel,
    setCommander,
    setActiveStage,
    setChecklistItemState,
} from 'src/client';
import {ChecklistItemDetails} from 'src/components/checklist_item';
import {Incident} from 'src/types/incident';
import {Checklist, ChecklistItem, ChecklistItemState} from 'src/types/playbook';

import ProfileSelector from 'src/components/profile/profile_selector';

import {isMobile} from 'src/mobile';
import {toggleRHS, endIncident, restartIncident, nextStage, prevStage} from 'src/actions';

import Duration from '../duration';

import 'src/components/checklist.scss';
import './incident_details.scss';
import ThreeDotsIcon from '../assets/icons/three_dots_icon';
import DotMenu, {DropdownMenuItem} from '../dot_menu';

interface Props {
    incident: Incident;
}

function renderView(props: any): JSX.Element {
    return (
        <div
            {...props}
            className='scrollbar--view'
        />);
}

function renderThumbHorizontal(props: any): JSX.Element {
    return (
        <div
            {...props}
            className='scrollbar--horizontal'
        />);
}

function renderThumbVertical(props: any): JSX.Element {
    return (
        <div
            {...props}
            className='scrollbar--vertical'
        />);
}

interface StageProps {
    stages: Checklist[];
    activeStage: number;
}

const StageWrapper = styled.span`
    display: flex;
    justify-content: space-between;
`;

const StageCounter = styled.span`
    font-size: 14px;
    line-height: 20px;
    text-align: right;
    color: rgba(var(--center-channel-color-rgb), 0.64);
`;

const Stage: FC<StageProps> = (props: StageProps) => {
    if (props.stages.length <= 1) {
        return null;
    }

    return (
        <React.Fragment>
            <div className='title'>
                {'Current Stage:'}
            </div>
            <div>
                <StageWrapper>
                    {props.stages[props.activeStage].title}
                    <StageCounter>
                        {`(${props.activeStage + 1}/${props.stages.length})`}
                    </StageCounter>
                </StageWrapper>
            </div>
        </React.Fragment>
    );
};

interface NextStageButtonProps {
    stages: Checklist[];
    activeStage: number;
    isActive: boolean;
    endIncident: () => void;
    restartIncident: () => void;
    nextStage: () => void;
}

const HamburgerButton = styled(ThreeDotsIcon)`
    font-size: 24px;
    color: rgba(var(--center-channel-color-rgb), 0.56);
    position: relative;
    top: calc(50% - 12px);
`;

const BasicButton = styled.button`
    display: block;
    border: 1px solid var(--button-bg);
    border-radius: 4px;
    background: transparent;
    font-size: 12px;
    font-weight: 600;
    line-height: 9.5px;
    color: var(--button-bg);
    text-align: center;
    padding: 10px 0;
`;

interface BasicButtonProps {
    primary: boolean;
}

const StyledButton = styled(BasicButton)<BasicButtonProps>`
    min-width: 114px;
    height: 40px;

    ${(props: BasicButtonProps) => props.primary && css`
        background: var(--button-bg);
        color: var(--button-color);
    `}
}
`;

const NextStageButton: FC<NextStageButtonProps> = (props: NextStageButtonProps) => {
    let text = 'Next Stage';
    let action = props.nextStage;

    if (!props.isActive) {
        text = 'Restart Incident';
        action = props.restartIncident;
    }

    if (props.activeStage === props.stages.length - 1) {
        text = 'End Incident';
        action = props.endIncident;
    }

    const allItemsChecked = props.stages[props.activeStage].items.every((item: ChecklistItem) => (
        item.state === ChecklistItemState.Closed
    ));

    return (
        <StyledButton
            primary={!props.isActive || allItemsChecked}
            onClick={action}
        >
            {text}
        </StyledButton>
    );
};

const RHSFooter = styled.div`
    display: flex;
    justify-content: space-between;

    button:only-child {
        margin-left: auto;
    }

    background: var(--center-channel-bg);
    border-top: 1px solid var(--center-channel-color-16);
    position: absolute;
    bottom: 0;
    left: 0;
    width: 100%;
    height: auto;
    text-align: right;
    padding: 2rem;

    a {
        opacity: unset;
    }
`;

const RHSIncidentDetails: FC<Props> = (props: Props) => {
    const dispatch = useDispatch();

    const fetchUsers = async () => {
        return fetchUsersInChannel(props.incident.channel_id);
    };

    const onSelectedProfileChange = async (userId?: string) => {
        if (!userId) {
            return;
        }
        const response = await setCommander(props.incident.id, userId);
        if (response.error) {
            // TODO: Should be presented to the user? https://mattermost.atlassian.net/browse/MM-24271
            console.log(response.error); // eslint-disable-line no-console
        }
    };

    const checklists = props.incident.checklists || [];
    const activeChecklistIdx = props.incident.active_stage;
    const activeChecklist = checklists[activeChecklistIdx] || {title: '', items: []};

    const dotMenuChildren = [];
    if (props.incident.active_stage > 0) {
        dotMenuChildren.push(
            <DropdownMenuItem
                text='Previous Stage'
                onClick={() => dispatch(prevStage())}
            />,
        );
    }

    if (props.incident.active_stage < props.incident.checklists.length - 1) {
        dotMenuChildren.push(
            <DropdownMenuItem
                text='End Incident'
                onClick={() => dispatch(endIncident())}
            />,
        );
    }

    const dotMenu = (
        <DotMenu
            icon={<HamburgerButton/>}
            top={true}
        >
            {dotMenuChildren}
        </DotMenu>
    );

    return (
        <React.Fragment>
            <Scrollbars
                autoHide={true}
                autoHideTimeout={500}
                autoHideDuration={500}
                renderThumbHorizontal={renderThumbHorizontal}
                renderThumbVertical={renderThumbVertical}
                renderView={renderView}
                style={{position: 'absolute'}}
            >
                <div className='IncidentDetails'>
                    <div className='side-by-side'>
                        <div className='inner-container first-container'>
                            <div className='first-title'>{'Commander'}</div>
                            <ProfileSelector
                                selectedUserId={props.incident.commander_user_id}
                                placeholder={'Assign Commander'}
                                placeholderButtonClass={'NoAssignee-button'}
                                profileButtonClass={'Assigned-button'}
                                enableEdit={true}
                                getUsers={fetchUsers}
                                onSelectedChange={onSelectedProfileChange}
                                selfIsFirstOption={true}
                            />
                        </div>
                        <Duration
                            created_at={props.incident.create_at}
                            ended_at={props.incident.end_at}
                        />
                    </div>
                    <div className='inner-container'>
                        <Stage
                            stages={checklists}
                            activeStage={activeChecklistIdx}
                        />
                    </div>
                    <div
                        className='checklist-inner-container'
                    >
                        <div className='title'>
                            {'Checklist'}
                        </div>
                        <div className='checklist'>
                            {activeChecklist.items.map((checklistItem: ChecklistItem, index: number) => (
                                <ChecklistItemDetails
                                    key={checklistItem.title + index}
                                    checklistItem={checklistItem}
                                    checklistNum={activeChecklistIdx}
                                    itemNum={index}
                                    channelId={props.incident.channel_id}
                                    incidentId={props.incident.id}
                                    onChange={(newState: ChecklistItemState) => {
                                        setChecklistItemState(props.incident.id, activeChecklistIdx, index, newState);
                                    }}
                                    onRedirect={() => {
                                        if (isMobile()) {
                                            dispatch(toggleRHS());
                                        }
                                    }}
                                />
                            ))}
                        </div>
                    </div>
                </div>
            </Scrollbars>
            <RHSFooter>
                {props.incident.checklists.length > 1 && dotMenu}
                <NextStageButton
                    stages={checklists}
                    activeStage={activeChecklistIdx}
                    isActive={props.incident.is_active}
                    endIncident={() => dispatch(endIncident())}
                    restartIncident={() => dispatch(restartIncident())}
                    nextStage={() => dispatch(nextStage())}
                />
            </RHSFooter>
        </React.Fragment>
    );
};

export default RHSIncidentDetails;
