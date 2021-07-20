// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';
import {useSelector} from 'react-redux';
import styled from 'styled-components';

import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';
import {GlobalState} from 'mattermost-redux/types/store';
import {Team} from 'mattermost-redux/types/teams';

import NoContentPlaybookSvg from 'src/components/assets/no_content_playbooks_svg';

import DotMenuIcon from 'src/components/assets/icons/dot_menu_icon';
import TextWithTooltip from 'src/components/widgets/text_with_tooltip';
import ConfirmModal from 'src/components/widgets/confirmation_modal';
import TemplateSelector, {PresetTemplate} from 'src/components/backstage/template_selector';

import BackstageListHeader from 'src/components/backstage/backstage_list_header';
import './playbook.scss';
import DotMenu, {DropdownMenuItem} from 'src/components/dot_menu';
import {SortableColHeader} from 'src/components/sortable_col_header';
import {PaginationRow} from 'src/components/pagination_row';
import {BACKSTAGE_LIST_PER_PAGE, AdminNotificationType} from 'src/constants';
import {Banner} from 'src/components/backstage/styles';
import UpgradeModal from 'src/components/backstage/upgrade_modal';

import RightDots from 'src/components/assets/right_dots';
import RightFade from 'src/components/assets/right_fade';
import LeftDots from 'src/components/assets/left_dots';
import LeftFade from 'src/components/assets/left_fade';
import {PrimaryButton, UpgradeButton, UpgradeButtonProps} from 'src/components/assets/buttons';

import {
    useAllowPlaybookCreationInCurrentTeam,
    useCanCreatePlaybooks,
    usePlaybooksCrud,
    usePlaybooksRouting,
} from 'src/hooks';

import {Playbook} from 'src/types/playbook';

const DeleteBannerTimeout = 5000;

const PlaybookList = () => {
    const [showConfirmation, setShowConfirmation] = useState(false);
    const [showBanner, setShowBanner] = useState(false);
    const canCreatePlaybooks = useCanCreatePlaybooks();
    const [isUpgradeModalShown, showUpgradeModal, hideUpgradeModal] = useUpgradeModalVisibility(false);
    const allowPlaybookCreation = useAllowPlaybookCreationInCurrentTeam();

    const currentTeam = useSelector<GlobalState, Team>(getCurrentTeam);

    const [
        playbooks,
        {totalCount, params, selectedPlaybook},
        {setPage, sortBy, setSelectedPlaybook, deletePlaybook},
    ] = usePlaybooksCrud({team_id: currentTeam.id, per_page: BACKSTAGE_LIST_PER_PAGE});

    const {view, edit, create} = usePlaybooksRouting<Playbook>(currentTeam.name, {onGo: setSelectedPlaybook});

    const newPlaybook = (templateTitle?: string | undefined) => {
        if (allowPlaybookCreation) {
            create(templateTitle);
        } else {
            showUpgradeModal();
        }
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
            await deletePlaybook(selectedPlaybook.id);

            hideConfirmModal();
            setShowBanner(true);

            window.setTimeout(() => {
                setShowBanner(false);
                setSelectedPlaybook(null);
            }, DeleteBannerTimeout);
        }
    };

    const deleteSuccessfulBanner = showBanner && (
        <Banner>
            <i className='icon icon-check mr-1'/>
            {`The playbook ${selectedPlaybook?.title} was successfully deleted.`}
        </Banner>
    );

    let body;
    if (!playbooks) {
        body = null;
    } else if (playbooks?.length === 0) {
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
                onClick={() => view(p)}
            >
                <a className='col-sm-4 title'>
                    <TextWithTooltip
                        id={p.title}
                        text={p.title}
                    />
                </a>
                <div className='col-sm-2'>{p.num_stages}</div>
                <div className='col-sm-2'>{p.num_steps}</div>
                <div className='col-sm-2'>{p.num_runs}</div>
                <div className='col-sm-2 action-col'>
                    <PlaybookActionMenu
                        onEdit={() => {
                            edit(p);
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
            <UpgradeModal
                messageType={AdminNotificationType.PLAYBOOK}
                show={isUpgradeModalShown}
                onHide={hideUpgradeModal}
            />
            {deleteSuccessfulBanner}
            {canCreatePlaybooks &&
                <TemplateSelector
                    onSelect={(template: PresetTemplate) => {
                        create(template.title);
                    }}
                />
            }
            {
                (playbooks?.length === 0) &&
                <>
                    <NoContentPage
                        onNewPlaybook={newPlaybook}
                        canCreatePlaybooks={canCreatePlaybooks}
                        allowPlaybookCreation={allowPlaybookCreation}
                    />
                    <NoContentPlaybookSvg/>
                </>
            }
            {
                (playbooks && playbooks.length !== 0) &&
                <>
                    <RightDots/>
                    <RightFade/>
                    <LeftDots/>
                    <LeftFade/>
                    <div className='playbook-list container-medium'>
                        <div className='Backstage__header'>
                            <div
                                data-testid='titlePlaybook'
                                className='title list-title'
                            >
                                {'Playbooks'}
                                <div className='light'>
                                    {'(' + currentTeam.display_name + ')'}
                                </div>
                            </div>
                            {canCreatePlaybooks &&
                                <div className='header-button-div'>
                                    <UpgradeOrPrimaryButton
                                        onClick={() => newPlaybook()}
                                        allowPlaybookCreation={allowPlaybookCreation}
                                    >
                                        <i className='icon-plus mr-2'/>
                                        {'Create playbook'}
                                    </UpgradeOrPrimaryButton>
                                </div>
                            }
                        </div>
                        <BackstageListHeader>
                            <div className='row'>
                                <div className='col-sm-4'>
                                    <SortableColHeader
                                        name={'Name'}
                                        direction={params.direction}
                                        active={params.sort === 'title'}
                                        onClick={() => sortBy('title')}
                                    />
                                </div>
                                <div className='col-sm-2'>
                                    <SortableColHeader
                                        name={'Checklists'}
                                        direction={params.direction}
                                        active={params.sort === 'stages'}
                                        onClick={() => sortBy('stages')}
                                    />
                                </div>
                                <div className='col-sm-2'>
                                    <SortableColHeader
                                        name={'Tasks'}
                                        direction={params.direction}
                                        active={params.sort === 'steps'}
                                        onClick={() => sortBy('steps')}
                                    />
                                </div>
                                <div className='col-sm-2'>
                                    <SortableColHeader
                                        name={'Runs'}
                                        direction={params.direction}
                                        active={params.sort === 'runs'}
                                        onClick={() => sortBy('runs')}
                                    />
                                </div>
                                <div className='col-sm-2'>{'Actions'}</div>
                            </div>
                        </BackstageListHeader>
                        {body}
                        <PaginationRow
                            page={params.page}
                            perPage={params.per_page}
                            totalCount={totalCount}
                            setPage={setPage}
                        />
                    </div>
                    <ConfirmModal
                        show={showConfirmation}
                        title={'Delete playbook'}
                        message={`Are you sure you want to delete the playbook "${selectedPlaybook?.title}"?`}
                        confirmButtonText={'Delete'}
                        onConfirm={onDelete}
                        onCancel={hideConfirmModal}
                    />
                </>
            }
        </div>
    );
};

type CreatePlaybookButtonProps = UpgradeButtonProps & {allowPlaybookCreation: boolean};

export const UpgradeOrPrimaryButton = (props: CreatePlaybookButtonProps) => {
    const {children, allowPlaybookCreation, ...rest} = props;

    if (allowPlaybookCreation) {
        return <PrimaryButton {...rest}>{children}</PrimaryButton>;
    }

    return <UpgradeButton {...rest}>{children}</UpgradeButton>;
};

export const useUpgradeModalVisibility = (initialState: boolean): [boolean, () => void, () => void] => {
    const [isModalShown, setShowModal] = useState(initialState);

    const showUpgradeModal = () => {
        setShowModal(true);
    };
    const hideUpgradeModal = () => {
        setShowModal(false);
    };

    return [isModalShown, showUpgradeModal, hideUpgradeModal];
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

const DescriptionWarn = styled(Description)`
    color: rgba(var(--error-text-color-rgb), 0.72);
`;

const NoContentPage = (props: { onNewPlaybook: () => void, canCreatePlaybooks: boolean, allowPlaybookCreation: boolean }) => {
    return (
        <Container>
            <Title>{'What is a playbook?'}</Title>
            <Description>{'A playbook is a workflow that your teams and tools should follow, including everything from checklists, actions, templates, and retrospectives.'}</Description>
            {props.canCreatePlaybooks &&
                <UpgradeOrPrimaryButton
                    className='mt-6'
                    onClick={() => props.onNewPlaybook()}
                    allowPlaybookCreation={props.allowPlaybookCreation}
                >
                    <i className='icon-plus mr-2'/>
                    {'Create playbook'}
                </UpgradeOrPrimaryButton>
            }
            {!props.canCreatePlaybooks &&
                <DescriptionWarn>{"There are no playbooks to view. You don't have permission to create playbooks in this workspace."}</DescriptionWarn>
            }
        </Container>
    );
};

interface PlaybookActionMenuProps {
    onEdit: () => void;
    onDelete: () => void;
}

const IconWrapper = styled.div`
    display: inline-flex;
    padding: 10px 5px;
`;

const PlaybookActionMenu = (props: PlaybookActionMenuProps) => {
    return (
        <DotMenu
            icon={
                <IconWrapper>
                    <DotMenuIcon/>
                </IconWrapper>
            }
        >
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
