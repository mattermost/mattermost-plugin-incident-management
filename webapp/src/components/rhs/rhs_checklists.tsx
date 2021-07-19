// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useDispatch} from 'react-redux';
import styled from 'styled-components';
import {
    DragDropContext,
    Droppable,
    DroppableProvided,
    Draggable,
    DraggableProvided,
    DropResult,
    DraggableStateSnapshot,
} from 'react-beautiful-dnd';

import {PlaybookRun} from 'src/types/playbook_run';
import {toggleRHS, playbookRunUpdated} from 'src/actions';
import {ChecklistItem, ChecklistItemState, Checklist} from 'src/types/playbook';
import {setChecklistItemState, clientReorderChecklist} from 'src/client';
import {ChecklistItemDetails} from 'src/components/checklist_item';
import {isMobile} from 'src/mobile';
import CollapsibleChecklist from 'src/components/rhs/collapsible_checklist';

interface Props {
    playbookRun: PlaybookRun;
}

const RHSChecklists = (props: Props) => {
    const dispatch = useDispatch();

    const checklists = props.playbookRun.checklists || [];

    return (
        <InnerContainer>
            <MainTitle>{'Checklists'}</MainTitle>
            {checklists.map((checklist: Checklist, checklistIndex: number) => (
                <CollapsibleChecklist
                    key={checklist.title + checklistIndex}
                    title={checklist.title}
                    items={checklist.items}
                    index={checklistIndex}
                >
                    <ChecklistContainer className='checklist'>
                        <DragDropContext
                            onDragEnd={(result: DropResult) => {
                                if (!result.destination) {
                                    return;
                                }

                                if (result.destination.droppableId === result.source.droppableId &&
                                    result.destination.index === result.source.index) {
                                    return;
                                }

                                const newChecklists = Array.from(checklists);
                                const newChecklistItems = Array.from(checklists[checklistIndex].items);
                                const [removed] = newChecklistItems.splice(result.source.index, 1);
                                newChecklistItems.splice(result.destination.index, 0, removed);
                                newChecklists[checklistIndex] = {
                                    ...newChecklists[checklistIndex],
                                    items: newChecklistItems,
                                };

                                dispatch(playbookRunUpdated({
                                    ...props.playbookRun,
                                    checklists: newChecklists,
                                }));

                                clientReorderChecklist(props.playbookRun.id, checklistIndex, result.source.index, result.destination.index);
                            }}
                        >
                            <Droppable
                                droppableId='columns'
                                direction='vertical'
                                type='checklist'
                            >
                                {(droppableProvided: DroppableProvided) => (
                                    <div
                                        ref={droppableProvided.innerRef}
                                        {...droppableProvided.droppableProps}
                                    >
                                        {checklist.items.map((checklistItem: ChecklistItem, index: number) => (
                                            <Draggable
                                                key={checklistItem.title + index}
                                                draggableId={checklistItem.title + index}
                                                index={index}
                                            >
                                                {(draggableProvided: DraggableProvided, snapshot: DraggableStateSnapshot) => (
                                                    <ChecklistItemDetails
                                                        checklistItem={checklistItem}
                                                        checklistNum={checklistIndex}
                                                        itemNum={index}
                                                        channelId={props.playbookRun.channel_id}
                                                        playbookRunId={props.playbookRun.id}
                                                        onChange={(newState: ChecklistItemState) => {
                                                            setChecklistItemState(props.playbookRun.id, checklistIndex, index, newState);
                                                        }}
                                                        onRedirect={() => {
                                                            if (isMobile()) {
                                                                dispatch(toggleRHS());
                                                            }
                                                        }}
                                                        draggableProvided={draggableProvided}
                                                        dragging={snapshot.isDragging}
                                                    />
                                                )}
                                            </Draggable>
                                        ))}
                                        {droppableProvided.placeholder}
                                    </div>
                                )}
                            </Droppable>
                        </DragDropContext>
                    </ChecklistContainer>
                </CollapsibleChecklist>
            ))}
        </InnerContainer>
    );
};

const InnerContainer = styled.div`
    display: flex;
    flex-direction: column;
    padding: 12px 12px 24px 12px;
`;

const MainTitle = styled.div`
    font-weight: 600;
    font-size: 16px;
    line-height: 24px;
    margin: 0 0 0 8px;
`;

const ChecklistContainer = styled.div`
    background-color: var(--center-channel-bg);
    padding: 16px 12px;
`;

export default RHSChecklists;
