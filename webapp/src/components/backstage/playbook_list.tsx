// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useEffect} from 'react';
import {useSelector} from 'react-redux';
import styled from 'styled-components';
import qs from 'qs';

import {getCurrentTeam, getMyTeams} from 'mattermost-redux/selectors/entities/teams';
import {GlobalState} from 'mattermost-redux/types/store';
import {Team} from 'mattermost-redux/types/teams';

import NoContentPlaybookSvg from 'src/components/assets/no_content_playbooks_svg';

import {FetchPlaybooksNoChecklistReturn, PlaybookNoChecklist} from 'src/types/playbook';
import {navigateToTeamPluginUrl} from 'src/browser_routing';

import {deletePlaybook, clientFetchPlaybooks} from 'src/client';

import DotMenuIcon from 'src/components/assets/icons/dot_menu_icon';
import TextWithTooltip from 'src/components/widgets/text_with_tooltip';
import ConfirmModal from 'src/components/widgets/confirmation_modal';
import TemplateSelector, {PresetTemplate} from 'src/components/backstage/template_selector';

import BackstageListHeader from 'src/components/backstage/backstage_list_header';
import './playbook.scss';
import DotMenu, {DropdownMenuItem} from 'src/components/dot_menu';
import {SortableColHeader} from 'src/components/sortable_col_header';
import {PaginationRow} from 'src/components/pagination_row';
import {TEMPLATE_TITLE_KEY, BACKSTAGE_LIST_PER_PAGE, AdminNotificationType} from 'src/constants';
import {Banner} from 'src/components/backstage/styles';
import UpgradeModal from 'src/components/backstage/upgrade_modal';

import RightDots from 'src/components/assets/right_dots';
import RightFade from 'src/components/assets/right_fade';
import LeftDots from 'src/components/assets/left_dots';
import LeftFade from 'src/components/assets/left_fade';
import {PrimaryButton, UpgradeButtonProps} from 'src/components/assets/buttons';

import {useAllowPlaybookCreationInCurrentTeam, useCanCreatePlaybooks, useAllowPlaybookCreationInTeams} from 'src/hooks';

import CreatePlaybookTeamSelector from 'src/components/team/create_playbook_team_selector';

import {TeamName, getTeamName} from 'src/components/backstage/playbook_runs/playbook_run_list/playbook_run_list';

const DeleteBannerTimeout = 5000;

const PlaybookList = () => {
    const [playbooks, setPlaybooks] = useState<PlaybookNoChecklist[] | null>(null);
    const [totalCount, setTotalCount] = useState(0);
    const [selectedPlaybook, setSelectedPlaybook] = useState<PlaybookNoChecklist | null>(null);
    const [showConfirmation, setShowConfirmation] = useState(false);
    const [showBanner, setShowBanner] = useState(false);
    const canCreatePlaybooks = useCanCreatePlaybooks();
    const [isUpgradeModalShown, showUpgradeModal, hideUpgradeModal] = useUpgradeModalVisibility(false);
    const allowPlaybookCreationInTeams = useAllowPlaybookCreationInTeams();
    const teams = useSelector<GlobalState, Team[]>(getMyTeams);
    const currentTeam = useSelector<GlobalState, Team>(getCurrentTeam);

    const [fetchParams, setFetchParams] = useState<{ sort: string, direction: string, page: number, per_page: number }>(
        {
            sort: 'title',
            direction: 'asc',
            page: 0,
            per_page: BACKSTAGE_LIST_PER_PAGE,
        },
    );

    function colHeaderClicked(colName: string) {
        if (fetchParams.sort === colName) {
            // we're already sorting on this column; reverse the direction
            const newSortDirection = fetchParams.direction === 'asc' ? 'desc' : 'asc';
            setFetchParams({...fetchParams, direction: newSortDirection});
            return;
        }

        setFetchParams({...fetchParams, sort: colName, direction: 'asc'});
    }

    function setPage(page: number) {
        setFetchParams({...fetchParams, page});
    }

    const fetchPlaybooks = async () => {
        const result = await clientFetchPlaybooks('', fetchParams) as FetchPlaybooksNoChecklistReturn;
        setPlaybooks(result.items);
        setTotalCount(result.total_count);
    };
    useEffect(() => {
        fetchPlaybooks();
    }, [currentTeam.id, fetchParams]);

    const viewPlaybook = (playbook: PlaybookNoChecklist) => {
        setSelectedPlaybook(playbook);
        navigateToTeamPluginUrl(currentTeam.name, `/playbooks/${playbook.id}`);
    };

    const editPlaybook = (playbook: PlaybookNoChecklist) => {
        setSelectedPlaybook(playbook);
        navigateToTeamPluginUrl(currentTeam.name, `/playbooks/${playbook.id}/edit`);
    };

    const newPlaybook = (team: Team, templateTitle?: string | undefined) => {
        if (allowPlaybookCreationInTeams.get(team.id)) {
            const queryParams = qs.stringify({team_id: team.id, [TEMPLATE_TITLE_KEY]: templateTitle}, {addQueryPrefix: true});
            navigateToTeamPluginUrl(team.name, `/playbooks/new${queryParams}`);
        } else {
            showUpgradeModal();
        }
    };

    const hideConfirmModal = () => {
        setShowConfirmation(false);
    };

    const onConfirmDelete = (playbook: PlaybookNoChecklist) => {
        setSelectedPlaybook(playbook);
        setShowConfirmation(true);
    };

    const onDelete = async () => {
        if (selectedPlaybook) {
            await deletePlaybook(selectedPlaybook);
            let page = fetchParams.page;

            // Fetch latest count
            const result = await clientFetchPlaybooks('', fetchParams) as FetchPlaybooksNoChecklistReturn;

            // Go back to previous page if the last item on this page was just deleted
            page = Math.max(Math.min(result.page_count - 1, page), 0);

            // Setting the page here results in fetching playbooks through the fetchParams dependency of the effect above
            setPage(page);

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
        body = playbooks.map((p: PlaybookNoChecklist) => (
            <div
                className='row playbook-item'
                key={p.id}
                onClick={() => viewPlaybook(p)}
            >
                <a className='col-sm-4 title'>
                    <TextWithTooltip
                        id={p.title}
                        text={p.title}
                    />
                    <TeamName>{teams.length > 1 ? ' (' + getTeamName(teams, p.team_id) + ')' : ''}</TeamName>
                </a>
                <div
                    className='col-sm-2'
                >
                    {
                        p.num_stages
                    }
                </div>
                <div
                    className='col-sm-2'
                >
                    {

                        /* Calculate all steps for this playbook */
                        p.num_steps
                    }
                </div>
                <div className='col-sm-2 action-col'>
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
            <UpgradeModal
                messageType={AdminNotificationType.PLAYBOOK}
                show={isUpgradeModalShown}
                onHide={hideUpgradeModal}
            />
            {deleteSuccessfulBanner}
            {canCreatePlaybooks &&
                <TemplateSelector
                    onSelect={(team: Team, template: PresetTemplate) => {
                        newPlaybook(team, template.title);
                    }}
                    teams={teams}
                    allowPlaybookCreationInTeams={allowPlaybookCreationInTeams}
                />
            }
            {
                (playbooks?.length === 0) &&
                <>
                    <NoContentPage
                        onNewPlaybook={(team: Team) => newPlaybook(team)}
                        canCreatePlaybooks={canCreatePlaybooks}
                        teams={teams}
                        allowPlaybookCreationInTeams={allowPlaybookCreationInTeams}
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
                            </div>
                            {canCreatePlaybooks &&
                                <div className='header-button-div'>
                                    <TeamSelectorButton
                                        onClick={(team: Team) => newPlaybook(team)}
                                        teams={teams}
                                        allowPlaybookCreationInTeams={allowPlaybookCreationInTeams}
                                    />
                                </div>
                            }
                        </div>
                        <BackstageListHeader>
                            <div className='row'>
                                <div className='col-sm-4'>
                                    <SortableColHeader
                                        name={'Name'}
                                        direction={fetchParams.direction}
                                        active={fetchParams.sort === 'title'}
                                        onClick={() => colHeaderClicked('title')}
                                    />
                                </div>
                                <div className='col-sm-2'>
                                    <SortableColHeader
                                        name={'Checklists'}
                                        direction={fetchParams.direction}
                                        active={fetchParams.sort === 'stages'}
                                        onClick={() => colHeaderClicked('stages')}
                                    />
                                </div>
                                <div className='col-sm-2'>
                                    <SortableColHeader
                                        name={'Tasks'}
                                        direction={fetchParams.direction}
                                        active={fetchParams.sort === 'steps'}
                                        onClick={() => colHeaderClicked('steps')}
                                    />
                                </div>
                                <div className='col-sm-2'>{'Actions'}</div>
                            </div>
                        </BackstageListHeader>
                        {body}
                        <PaginationRow
                            page={fetchParams.page}
                            perPage={fetchParams.per_page}
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

type CreatePlaybookButtonProps = UpgradeButtonProps & {teams: Team[], allowPlaybookCreationInTeams:Map<string, boolean>};

const TeamSelectorButton = (props: CreatePlaybookButtonProps) => {
    const {teams, allowPlaybookCreationInTeams, ...rest} = props;

    return (
        <CreatePlaybookTeamSelector
            testId={'create-playbook-team-selector'}
            enableEdit={true}
            teams={teams}
            allowPlaybookCreationInTeams={allowPlaybookCreationInTeams}
            onSelectedChange={props.onClick}
            withButton={true}
            {...rest}
        >
            <CreatePlaybookButton>
                <i className='icon-plus mr-2'/>
                {'Create playbook'}
            </CreatePlaybookButton>
        </CreatePlaybookTeamSelector>
    );
};

const CreatePlaybookButton = styled(PrimaryButton)`
    display: flex;
    align-items: center;
`;

const useUpgradeModalVisibility = (initialState: boolean): [boolean, () => void, () => void] => {
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

const NoContentPage = (props: { onNewPlaybook: (team: Team) => void, canCreatePlaybooks: boolean, teams: Team[], allowPlaybookCreationInTeams: Map<string, boolean>}) => {
    return (
        <Container>
            <Title>{'What is a playbook?'}</Title>
            <Description>{'A playbook is a workflow that your teams and tools should follow, including everything from checklists, actions, templates, and retrospectives.'}</Description>
            { props.canCreatePlaybooks &&
                <TeamSelectorButton
                    className='mt-6'
                    onClick={(team: Team) => props.onNewPlaybook(team)}
                    teams={props.teams}
                    allowPlaybookCreationInTeams={props.allowPlaybookCreationInTeams}
                />
            }
            { !props.canCreatePlaybooks &&
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
