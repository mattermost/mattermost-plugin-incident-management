// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {FC, useState, useEffect} from 'react';
import {useSelector} from 'react-redux';
import styled from 'styled-components';

import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';
import {GlobalState} from 'mattermost-redux/types/store';
import {Team} from 'mattermost-redux/types/teams';

import {Playbook, FetchPlaybooksReturn} from 'src/types/playbook';
import {navigateToTeamPluginUrl} from 'src/browser_routing';

import {deletePlaybook, clientFetchPlaybooks} from 'src/client';

import Spinner from 'src/components/assets/icons/spinner';
import TextWithTooltip from 'src/components/widgets/text_with_tooltip';
import ConfirmModal from 'src/components/widgets/confirmation_modal';

import NoContentPlaybookSvg from '../../assets/no_content_playbooks_svg';

import BackstageListHeader from '../backstage_list_header';
import './playbook.scss';
import DotMenu, {DropdownMenuItem} from 'src/components/dot_menu';
import {SortableColHeader} from '../incidents/incident_list/sortable_col_header';

const DeleteBannerTimeout = 5000;

const PlaybookList: FC = () => {
    const [playbooks, setPlaybooks] = useState<Playbook[] | null>(null);
    const [selectedPlaybook, setSelectedPlaybook] = useState<Playbook | null>(null);
    const [showConfirmation, setShowConfirmation] = useState(false);
    const [showBanner, setShowBanner] = useState(false);

    const currentTeam = useSelector<GlobalState, Team>(getCurrentTeam);

    const [fetchParams, setFetchParams] = useState<{sort: string, direction: string}>(
        {
            sort: 'title',
            direction: 'asc',
        },
    );

    function colHeaderClicked(colName: string) {
        if (fetchParams.sort === colName) {
            // we're already sorting on this column; reverse the order
            const newSortDirection = fetchParams.direction === 'asc' ? 'desc' : 'asc';
            setFetchParams({...fetchParams, direction: newSortDirection});
            return;
        }

        setFetchParams({...fetchParams, sort: colName, direction: 'asc'});
    }

    useEffect(() => {
        const fetchPlaybooks = async () => {
            const result = await clientFetchPlaybooks(currentTeam.id, fetchParams) as FetchPlaybooksReturn;
            setPlaybooks(result.items);
        };
        fetchPlaybooks();
    }, [currentTeam.id, fetchParams]);

    const editPlaybook = (playbook: Playbook) => {
        setSelectedPlaybook(playbook);
        navigateToTeamPluginUrl(currentTeam.name, `/playbooks/${playbook.id}`);
    };

    const newPlaybook = () => {
        navigateToTeamPluginUrl(currentTeam.name, '/playbooks/new');
    };

    const hideConfirmModal = () => {
        setShowConfirmation(false);
    };

    const onConfirmDelete = (playbook: Playbook) => {
        setSelectedPlaybook(playbook);
        setShowConfirmation(true);
    };

    const onDelete = async () => {
        if (selectedPlaybook) {
            await deletePlaybook(selectedPlaybook);
            const result = await clientFetchPlaybooks(currentTeam.id, fetchParams) as FetchPlaybooksReturn;
            setPlaybooks(result.items);
            hideConfirmModal();
            setShowBanner(true);

            window.setTimeout(() => {
                setShowBanner(false);
                setSelectedPlaybook(null);
            }, DeleteBannerTimeout);
        }
    };

    const deleteSuccessfulBanner = showBanner && (
        <div className='banner'>
            <div className='banner__text'>
                <i className='icon icon-check mr-1'/>
                {`The playbook ${selectedPlaybook?.title} was successfully deleted.`}
            </div>
        </div>
    );

    let body;
    if (!playbooks) {
        body = (
            <Spinner/>
        );
    } else if (playbooks.length === 0) {
        body = (
            <div className='text-center pt-8'>
                {'There are no playbooks defined yet.'}
            </div>
        );
    } else {
        body = playbooks.map((p: Playbook) => (
            <div
                className='row playbook-item'
                key={p.id}
                onClick={() => editPlaybook(p)}
            >
                <a className='col-sm-4 title'>
                    <TextWithTooltip
                        id={p.title}
                        text={p.title}
                    />
                </a>
                <div
                    className='col-sm-2'
                >
                    {
                        p.checklists.length
                    }
                </div>
                <div
                    className='col-sm-2'
                >
                    {

                        /* Calculate all steps for this playbook */
                        p.checklists.reduce((acc, currValue) => (currValue.items.length + acc), 0)
                    }
                </div>
                <div className='col-sm-2'>
                    <PlaybookActionMenu
                        onEdit={() => {
                            editPlaybook(p);
                        }}
                        onDelete={() => {
                            onConfirmDelete(p);
                        }}
                    />
                </div>
            </div>
        ));
    }

    return (
        <div className='Playbook'>
            { deleteSuccessfulBanner }
            {
                (playbooks?.length === 0) &&
                <>
                    <NoContentPage onNewPlaybook={newPlaybook}/>
                    <NoContentPlaybookSvg/>
                </>
            }
            {
                (playbooks && playbooks.length !== 0) &&
                <>
                    <div className='playbook-list container-medium'>
                        <div className='Backstage__header'>
                            <div
                                data-testid='titlePlaybook'
                                className='title'
                            >
                                {'Playbooks'}
                                <div className='light'>
                                    {'(' + currentTeam.display_name + ')'}
                                </div>
                            </div>
                            <div className='header-button-div'>
                                <button
                                    className='btn btn-primary'
                                    onClick={() => newPlaybook()}
                                >
                                    <i className='icon-plus mr-2'/>
                                    {'New Playbook'}
                                </button>
                            </div>
                        </div>
                        <BackstageListHeader>
                            <div className='row'>
                                <div className='col-sm-4'>
                                    <SortableColHeader
                                        name={'Name'}
                                        order={fetchParams.direction}
                                        active={fetchParams.sort === 'title'}
                                        onClick={() => colHeaderClicked('title')}
                                    />
                                </div>
                                <div className='col-sm-2'>
                                    <SortableColHeader
                                        name={'Stages'}
                                        order={fetchParams.direction}
                                        active={fetchParams.sort === 'stages'}
                                        onClick={() => colHeaderClicked('stages')}
                                    />
                                </div>
                                <div className='col-sm-2'>
                                    <SortableColHeader
                                        name={'Steps'}
                                        order={fetchParams.direction}
                                        active={fetchParams.sort === 'steps'}
                                        onClick={() => colHeaderClicked('steps')}
                                    />
                                </div>
                                <div className='col-sm-2'>{'Actions'}</div>
                            </div>
                        </BackstageListHeader>
                        {body}
                    </div>
                    <ConfirmModal
                        show={showConfirmation}
                        title={'Confirm Playbook Deletion'}
                        message={`Are you sure you want to delete the playbook "${selectedPlaybook?.title}"?`}
                        confirmButtonText={'Delete Playbook'}
                        onConfirm={onDelete}
                        onCancel={hideConfirmModal}
                    />
                </>
            }
        </div>
    );
};

const Container = styled.div`
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 0 20px;
`;

const Title = styled.h2`
    padding-top: 110px;
    font-family: Open Sans;
    font-style: normal;
    font-weight: normal;
    font-size: 28px;
    color: var(--center-channel-color);
    text-align: center;
`;

const Description = styled.h5`
    font-family: Open Sans;
    font-style: normal;
    font-weight: normal;
    font-size: 16px;
    line-height: 24px;
    color: rgba(var(--center-channel-color-rgb), 0.72);
    text-align: center;
    max-width: 800px;
`;

const Button = styled.button`
    display: inline-flex;
    background: var(--button-bg);
    color: var(--button-color);
    border-radius: 4px;
    border: 0px;
    font-family: Open Sans;
    font-style: normal;
    font-weight: 600;
    font-size: 16px;
    line-height: 18px;
    align-items: center;
    padding: 14px 24px;
    transition: all 0.15s ease-out;

    &:hover {
        opacity: 0.8;
    }

    &:active  {
        background: rgba(var(--button-bg-rgb), 0.8);
    }

    i {
        font-size: 24px;
    }
`;

const NoContentPage = (props: {onNewPlaybook: () => void}) => {
    return (
        <Container>
            <Title>{'What are Playbooks?'}</Title>
            <Description>{'A playbook is a workflow template. It is created ahead of time during planning and defines the stages and steps a workflow will have, along with who can start a workflow with the playbook.'}</Description>
            <Button
                className='mt-6'
                onClick={() => props.onNewPlaybook()}
            >
                <i className='icon-plus mr-2'/>
                {'New Playbook'}
            </Button>
        </Container>
    );
};

interface PlaybookActionMenuProps {
    onEdit: () => void;
    onDelete: () => void;
}

const PlaybookActionMenu = (props: PlaybookActionMenuProps) => {
    return (
        <DotMenu>
            <DropdownMenuItem
                text='Edit'
                onClick={props.onEdit}
            />
            <DropdownMenuItem
                text='Delete'
                onClick={props.onDelete}
            />
        </DotMenu>
    );
};

export default PlaybookList;
