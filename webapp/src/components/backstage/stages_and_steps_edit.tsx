// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';
import {
    DragDropContext,
    Droppable,
    DropResult,
    DroppableProvided,
    Draggable,
    DraggableProvided,
} from 'react-beautiful-dnd';

import styled from 'styled-components';

import {Checklist, emptyChecklist} from 'src/types/playbook';

import HorizontalBar from 'src/components/backstage/horizontal_bar';

import ConfirmModal from '../widgets/confirmation_modal';

import {StageEditor} from './stage_edit';
import DragHandle from './drag_handle';

const Header = styled.div`
    padding: 24px 0 0 14px;
`;

const HeaderTitle = styled.div`
    font-weight: 600;
    font-size: 16px;
    line-height: 24px;
    color: var(--center-channel-color);
`;

const HeaderHelpText = styled.div`
    font-weight: normal;
    font-size: 12px;
    line-height: 16px;
    color: rgba(var(--center-channel-color-rgb), 0.56);
`;

const NewStage = styled.button`
    border: none;
    background: none;
    color: rgba(var(--center-channel-color-rgb), 0.56);
    padding: 12px 20px;
    margin: 0 0 0 20px;

    &:hover {
        color: var(--center-channel-color);
    }
`;

const NewStageContainer = styled.div`
    margin: 12px 32px 0 0;
`;

interface Props {
    checklists: Checklist[];
    onChange: (checklist: Checklist[]) => void;
}

export const StagesAndStepsEdit = (props: Props): React.ReactElement => {
    const [confirmRemoveChecklistNum, setConfirmRemoveChecklistNum] = useState(-1);

    const onDragEnd = (result: DropResult) => {
        if (!result.destination) {
            return;
        }

        if (result.destination.droppableId === result.source.droppableId &&
            result.destination.index === result.source.index) {
            return;
        }

        if (result.type === 'checklist') {
            onReorderChecklist(result.source.index, result.destination.index);
            return;
        }

        if (result.type === 'checklist_item') {
            const sourceChecklistIndex = result.source.droppableId;
            const destinationChecklistIndex = result.destination.droppableId;
            onReorderChecklistItem(Number(sourceChecklistIndex), Number(destinationChecklistIndex), result.source.index, result.destination.index);
        }
    };

    const onReorderChecklist = (sourceIndex: number, destinationIndex: number) => {
        const newChecklist = [...props.checklists];
        const [removed] = newChecklist.splice(sourceIndex, 1);
        newChecklist.splice(destinationIndex, 0, removed);

        props.onChange(newChecklist);
    };

    const onReorderChecklistItem = (checklistIndex: number, newChecklistIndex: number, checklistItemIndex: number, newChecklistItemIndex: number): void => {
        const newChecklist = [...props.checklists];

        if (checklistIndex === newChecklistIndex) {
            // items moved within stage
            const changedChecklist = {...newChecklist[checklistIndex]} as Checklist;
            const changedChecklistItems = [...changedChecklist.items];
            const [removed] = changedChecklistItems.splice(checklistItemIndex, 1);
            changedChecklistItems.splice(newChecklistItemIndex, 0, removed);
            changedChecklist.items = changedChecklistItems;

            newChecklist[checklistIndex] = changedChecklist;
            props.onChange(newChecklist);
            return;
        }

        // items moved between stages
        const sourceChangedChecklist = {...newChecklist[checklistIndex]} as Checklist;
        const destinationChangedChecklist = {...newChecklist[newChecklistIndex]} as Checklist;
        const itemToMove = sourceChangedChecklist.items[checklistItemIndex];

        // Remove from current index
        const sourceChangedChecklistItems = Array.from(sourceChangedChecklist.items);
        sourceChangedChecklistItems.splice(checklistItemIndex, 1);

        // Add in new index
        const destinationChangedChecklistItems = Array.from(destinationChangedChecklist.items);
        destinationChangedChecklistItems.splice(newChecklistItemIndex, 0, itemToMove);

        sourceChangedChecklist.items = sourceChangedChecklistItems;
        destinationChangedChecklist.items = destinationChangedChecklistItems;

        newChecklist[checklistIndex] = sourceChangedChecklist;
        newChecklist[newChecklistIndex] = destinationChangedChecklist;

        props.onChange(newChecklist);
    };

    const onAddChecklist = () => {
        const checklist = emptyChecklist();
        checklist.title = 'New stage';
        const newChecklist = [...props.checklists, checklist];

        props.onChange(newChecklist);
    };

    const onChangeChecklist = (checklistIndex: number, checklist: Checklist) => {
        const newChecklist = [...props.checklists];
        newChecklist[checklistIndex] = checklist;

        props.onChange(newChecklist);
    };
    const onRemoveChecklist = (checklistIndex: number) => {
        const newChecklist = [...props.checklists];
        newChecklist.splice(checklistIndex, 1);

        props.onChange(newChecklist);
    };

    const handleDeletePressed = (checklistIndex: number) => {
        const filteredChecklistItems = props.checklists[checklistIndex].items.filter((item) => item.title || item.command);
        if (filteredChecklistItems.length === 0) {
            onRemoveChecklist(checklistIndex);
        } else {
            setConfirmRemoveChecklistNum(checklistIndex);
        }
    };

    return (
        <>
            <Header>
                <HeaderTitle>{'Tasks'}</HeaderTitle>
                <HeaderHelpText>{'Stages allow you to group your tasks. Tasks are meant to be completed by members of the incident channel.'}</HeaderHelpText>
            </Header>
            <DragDropContext onDragEnd={onDragEnd}>
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
                            {props.checklists?.map((checklist: Checklist, checklistIndex: number) => (
                                <Draggable
                                    key={checklist.title + checklistIndex}
                                    draggableId={checklist.title + checklistIndex}
                                    index={checklistIndex}
                                >
                                    {(draggableProvided: DraggableProvided) => (
                                        <DragHandle
                                            step={false}
                                            draggableProvided={draggableProvided}
                                            onDelete={() => handleDeletePressed(checklistIndex)}
                                        >
                                            <StageEditor
                                                checklist={checklist}
                                                checklistIndex={checklistIndex}
                                                onChange={(newChecklist: Checklist) => {
                                                    onChangeChecklist(checklistIndex, newChecklist);
                                                }}
                                            />
                                        </DragHandle>
                                    )}
                                </Draggable>
                            ))}
                            {droppableProvided.placeholder}
                        </div>
                    )}
                </Droppable>
                <NewStageContainer>
                    <HorizontalBar>
                        <NewStage
                            onClick={onAddChecklist}
                        >
                            <i className='icon-plus icon-16'/>
                            {'New Stage'}
                        </NewStage>
                    </HorizontalBar>
                </NewStageContainer>
                <ConfirmModal
                    show={confirmRemoveChecklistNum >= 0}
                    title={'Remove Stage'}
                    message={'Are you sure you want to remove the stage? All steps will be removed.'}
                    confirmButtonText={'Remove Stage'}
                    onConfirm={() => {
                        onRemoveChecklist(confirmRemoveChecklistNum);
                        setConfirmRemoveChecklistNum(-1);
                    }}
                    onCancel={() => setConfirmRemoveChecklistNum(-1)}
                />
            </DragDropContext>
        </>
    );
};
