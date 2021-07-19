// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useRef, useState} from 'react';
import {useDispatch} from 'react-redux';
import styled from 'styled-components';

import {addNewTask} from 'src/actions';
import {ChecklistItem, ChecklistItemState} from 'src/types/playbook';
import TextWithTooltipWhenEllipsis from 'src/components/widgets/text_with_tooltip_when_ellipsis';

export interface Props {
    title: string;
    index: number;
    items: ChecklistItem[];
    children: React.ReactNode;
}

const CollapsibleChecklist = ({title, index, items, children}: Props) => {
    const dispatch = useDispatch();
    const titleRef = useRef(null);

    // TODO: per-user state in redux
    const [expanded, setExpanded] = useState(true);
    const [hover, setHover] = useState(false);

    let icon = 'icon-chevron-down';
    if (!expanded) {
        icon = 'icon-chevron-right';
    }
    const [completed, total] = tasksCompleted(items);
    const percentage = total === 0 ? 0 : (completed / total) * 100;

    return (
        <Border>
            <Horizontal
                data-testid={'checklistHeader'}
                onClick={() => setExpanded(!expanded)}
                onMouseEnter={() => setHover(true)}
                onMouseLeave={() => setHover(false)}
            >
                <Icon className={icon}/>
                <Title ref={titleRef}>
                    <TextWithTooltipWhenEllipsis
                        id={index.toString(10)}
                        text={title}
                        parentRef={titleRef}
                    />
                </Title>
                <TasksCompleted>{`${completed} / ${total} done`}</TasksCompleted>
                {
                    hover &&
                    <AddNewTask
                        data-testid={'addNewTask'}
                        onClick={(e) => {
                            e.stopPropagation();
                            dispatch(addNewTask(index));
                        }}
                    >
                        <i className='icon-18 icon-plus'/>
                        {'Task'}
                    </AddNewTask>
                }
            </Horizontal>
            <ProgressBackground>
                <ProgressLine width={percentage}/>
            </ProgressBackground>
            {expanded && children}
        </Border>
    );
};

const Border = styled.div`
    margin-top: 12px;
    border-radius: 4px;
    border: 1px solid var(--center-channel-color-08);
    background-color: var(--center-channel-color-04);
`;

const ProgressBackground = styled.div`
    position: relative;

    &:after {
        border-bottom: 2px solid var(--center-channel-color-08);
        content: '';
        display: block;
        width: 100%;
    }
`;

const ProgressLine = styled.div<{width: number}>`
    position: absolute;
    width: 100%;

    &:after {
        border-bottom: 2px solid var(--online-indicator);
        content: '';
        display: block;
        width: ${(props) => props.width}%;
    }
`;

const Horizontal = styled.div`
    display: flex;
    flex-direction: row;
    align-items: baseline;
    cursor: pointer;
`;

const Icon = styled.i`
    position: relative;
    top: 2px;
    margin: 0 0 0 6px;

    font-size: 18px;
    color: var(--center-channel-color-56);

    ${Horizontal}:hover & {
        color: var(--center-channel-color-64);
    }
`;

const Title = styled.div`
    margin: 0 6px 0 0;

    font-weight: 600;
    font-size: 14px;
    line-height: 44px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--center-channel-color-72);

    ${Horizontal}:hover & {
        color: var(--center-channel-color-80);
    }
`;

const TasksCompleted = styled.div`
    margin-right: 16px;

    font-weight: 600;
    font-size: 12px;
    white-space: nowrap;
    color: var(--center-channel-color-48);

    ${Horizontal}:hover & {
        color: var(--center-channel-color-56);
    }
`;

const AddNewTask = styled.button`
    margin: 0 8px 0 auto;
    padding: 0 8px 0 0;
    border-radius: 4px;
    border: 0;

    font-weight: 600;
    font-size: 14px;
    line-height: 32px;
    white-space: nowrap;
    color: var(--center-channel-color-56);
    background: transparent;

    transition: all 0.15s ease-out;

    &:hover {
        background: var(--center-channel-color-08)
    }

    &:active {
        background: var(--center-channel-color-16);
    }
`;

const tasksCompleted = (items: ChecklistItem[]) => {
    let completed = 0;
    let total = 0;

    for (const item of items) {
        total++;
        if (item.state === ChecklistItemState.Closed) {
            completed++;
        }
    }

    return [completed, total];
};

export default CollapsibleChecklist;

