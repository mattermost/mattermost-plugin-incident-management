// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useState} from 'react';
import {useDispatch, useSelector} from 'react-redux';
import Scrollbars from 'react-custom-scrollbars';
import styled, {css} from 'styled-components';

import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';

import Icon from '@mdi/react';
import {mdiArrowDown, mdiArrowRight, mdiPlus} from '@mdi/js';

import {Playbook, DraftPlaybookWithChecklist} from 'src/types/playbook';

import {
    renderThumbVertical,
    renderTrackHorizontal,
    renderView,
    RHSContainer,
    RHSContent,
} from 'src/components/rhs/rhs_shared';
import {setRHSViewingPlaybookRun} from 'src/actions';
import {currentPlaybookRun} from 'src/selectors';

import {AdminNotificationType} from 'src/constants';

import {
    usePlaybooksCrud,
    getPlaybookOrFetch,
    usePlaybooksRouting,
    useCanCreatePlaybooks,
    useAllowPlaybookCreationInCurrentTeam,
} from 'src/hooks';
import {navigateToUrl} from 'src/browser_routing';

import {RHSHomePlaybook, RHSHomeTemplate} from 'src/components/rhs/rhs_home_item';
import BoxOpenSvg from 'src/components/assets/box_open_svg';
import PageRunSvg from 'src/components/assets/page_run_svg';
import PageRunCollaborationSvg from 'src/components/assets/page_run_collaboration_svg';
import {PrimaryButton, TertiaryButton} from 'src/components/assets/buttons';

import {PresetTemplates} from 'src/components/backstage/template_selector';

import UpgradeModal from 'src/components/backstage/upgrade_modal';
import {UpgradeOrPrimaryButton, useUpgradeModalVisibility} from 'src/components/backstage/playbook_list';
import {PlaybookRunStatus} from 'src/types/playbook_run';

const Header = styled.div`
    min-height: 8rem;
    margin-bottom: 4rem;
    display: grid;
`;

const RunDetail = styled.div<{
    exists: boolean;
    active: boolean;
}>`
    display: flex;
    place-content: flex-start;
    place-items: center;
    padding: 2rem 2rem 2rem 4rem;
    background:
        linear-gradient(
            180deg,
            rgba(var(--center-channel-bg-rgb), 0.85) 0%,
            rgba(var(--center-channel-bg-rgb), 0.25) 100%
        ),
        rgba(var(${({exists}) => (exists ? '--button-bg-rgb' : '--center-channel-color-rgb')}), 0.08);

    > div {
        margin-left: 2rem;

        > span {
            font-family: Open Sans;
            font-weight: 400;
            margin-right: auto;
            display: inline-block;
            margin-right: 2rem;
            ${({exists}) => (exists ? css`
                font-size: 14px;
                line-height: 20px;
                color: var(--mention-color);
            ` : css`
                color: '#6F6F73';
                font-size: 16px;
                line-height: 24px;
            `)}
        }
    }

    button {
        margin-top: 1rem;
        margin-right: 2rem;
    }
`;

const RunDetailsButton = styled(PrimaryButton)`
    height: 3.25rem;
    font-size: 12px;
    padding: 0 1.6rem;

    svg {
        margin-left: 0.5rem;
    }
`;

const WelcomeBlock = styled.div`
    padding: 4rem 3rem 2rem;

    div {
        margin-top: 2rem;
        button {
            margin-right: 2rem;
            margin-bottom: 1rem;
            padding: 0 2rem;
            > svg {
                margin-right: 0.5rem;
            }
        }
        span {
            display: inline-flex;
            align-items: center;
            vertical-align: top;
            padding: 1rem 0;
            > svg {
                margin-left: 0.5em;
            }
        }
    }
`;

const Heading = styled.h4`
    font-size: 18px;
    line-height: 24px;
    font-weight: 700;
    color: rgba(var(--center-channel-color-rgb), 0.72);
`;

const ListHeading = styled(Heading)`
    padding-left: 2.75rem;
`;

const PaginationContainer = styled.div`
    position: relative;
    height: 0;
    top: -5rem;
    display: flex;
    justify-content: center;
    padding-top: 1rem;

    button {
        height: 3.25rem;
    }
`;

const ListSection = styled.div`
    margin-top: 1rem;
    margin-bottom: 5rem;
    box-shadow: 0px -1px 0px rgba(var(--center-channel-color-rgb), 0.08);
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
    grid-template-rows: repeat(auto-fill, minmax(100px, 1fr));
    position: relative;

    &::after{
        content: '';
        display: block;
        position: absolute;
        width: 100%;
        height: 1px;
        bottom: 0;
        box-shadow: 0px -1px 0px rgba(var(--center-channel-color-rgb), 0.08);
    }
`;

const Description = styled.p`
    font-size: 14px;
    line-height: 21px;
    font-weight: 400;
    color: rgba(var(--center-channel-color-rgb), 0.72);
`;

const DescriptionWarn = styled(Description)`
    color: rgba(var(--error-text-color-rgb), 0.72);
`;

const RHSHome = () => {
    const dispatch = useDispatch();
    const currentTeam = useSelector(getCurrentTeam);
    const currentRun = useSelector(currentPlaybookRun);
    const hasCurrentRun = Boolean(currentRun);
    const currentRunActive =
        currentRun &&
        currentRun.current_status !== PlaybookRunStatus.Archived &&
        currentRun.current_status !== PlaybookRunStatus.Old;
    const [currentPlaybook, setCurrentPlaybook] = useState<Playbook | null>();

    const [playbooks, {hasMore, isLoading}, {setPage}] = usePlaybooksCrud({team_id: currentTeam.id}, {infinitePaging: true});
    const {create} = usePlaybooksRouting<Playbook>(currentTeam.name);
    const shouldWelcome = playbooks?.length === 0 && !currentPlaybook;

    const canCreatePlaybooks = useCanCreatePlaybooks();
    const allowPlaybookCreation = useAllowPlaybookCreationInCurrentTeam();
    const [isUpgradeModalShown, showUpgradeModal, hideUpgradeModal] = useUpgradeModalVisibility(false);

    const newPlaybook = (template?: DraftPlaybookWithChecklist) => {
        if (allowPlaybookCreation) {
            create(template?.title);
        } else {
            showUpgradeModal();
        }
    };

    useEffect(() => {
        (async () => {
            setCurrentPlaybook((currentRun && playbooks && await getPlaybookOrFetch(currentRun.playbook_id, playbooks)) || null);
        })();
    }, [currentRun, playbooks]);

    const viewCurrentPlaybookRun = () => {
        dispatch(setRHSViewingPlaybookRun());
        navigateToUrl(`/${currentTeam.name}/channels/${currentRun.channel_id}`);
    };

    const headerContent = shouldWelcome ? (
        <WelcomeBlock>
            <PageRunCollaborationSvg/>
            <Heading>
                {'Welcome to Playbooks!'}
            </Heading>
            <Description>
                {'A playbook prescribes the checklists, automations, and templates for any repeatable procedures.'}
                {'It helps teams reduce errors, earn trust with stakeholders, and become more effective with every iteration.'}
            </Description>
            {canCreatePlaybooks ? (
                <div>
                    <UpgradeOrPrimaryButton
                        onClick={() => newPlaybook()}
                        allowPlaybookCreation={allowPlaybookCreation}
                    >
                        <Icon
                            path={mdiPlus}
                            size={1}
                        />
                        {'Create playbook'}
                    </UpgradeOrPrimaryButton>
                    <span>
                        {'...or start with a template'}
                        <Icon
                            path={mdiArrowDown}
                            size={1}
                        />
                    </span>
                </div>
            ) : (
                <DescriptionWarn>{"There are no playbooks to view. You don't have permission to create playbooks in this workspace."}</DescriptionWarn>
            )}
        </WelcomeBlock>
    ) : (
        <RunDetail
            exists={hasCurrentRun}
            active={currentRunActive}
        >
            {hasCurrentRun ? <PageRunSvg/> : <BoxOpenSvg/>}
            <div>
                <span>
                    {
                        hasCurrentRun ? (
                            <>
                                <span>{'Currently running the '}</span>
                                <strong>{currentPlaybook?.title}</strong>
                                <span>{' playbook'}</span>
                            </>
                        ) : (
                            <span>
                                {'This channel is not running any playbook.'}
                            </span>
                        )
                    }
                </span>
                {
                    hasCurrentRun &&
                    <RunDetailsButton onClick={viewCurrentPlaybookRun}>
                        <span>
                            {'View run details '}
                        </span>
                        <Icon
                            path={mdiArrowRight}
                            size={1}
                        />
                    </RunDetailsButton>
                }
            </div>
        </RunDetail>
    );

    return (
        <RHSContainer>
            <UpgradeModal
                messageType={AdminNotificationType.PLAYBOOK}
                show={isUpgradeModalShown}
                onHide={hideUpgradeModal}
            />
            <RHSContent>
                <Scrollbars
                    autoHide={true}
                    autoHideTimeout={500}
                    autoHideDuration={500}
                    renderThumbVertical={renderThumbVertical}
                    renderView={renderView}
                    renderTrackHorizontal={renderTrackHorizontal}
                    style={{position: 'absolute'}}
                >
                    {!isLoading && <Header>{headerContent}</Header>}

                    {playbooks && playbooks.length !== 0 && (
                        <>
                            <ListHeading>{'Your Playbooks'}</ListHeading>
                            <ListSection>
                                {playbooks?.map((p) => (
                                    <RHSHomePlaybook
                                        key={p.id}
                                        playbook={p}
                                    />
                                ))}
                            </ListSection>
                            {hasMore && (
                                <PaginationContainer>
                                    <TertiaryButton
                                        disabled={!hasMore}
                                        onClick={() => setPage()}
                                    >
                                        {'Show more'}
                                    </TertiaryButton>
                                </PaginationContainer>
                            )}
                        </>
                    )}

                    {canCreatePlaybooks && (
                        <>
                            <ListHeading>{'Playbook Templates'}</ListHeading>
                            <ListSection>
                                {PresetTemplates.map(({title, template}) => (
                                    <RHSHomeTemplate
                                        key={title}
                                        title={title}
                                        template={template}
                                        onUse={newPlaybook}
                                    />
                                ))}
                            </ListSection>
                        </>
                    )}
                </Scrollbars>
            </RHSContent>
        </RHSContainer>
    );
};

export default RHSHome;
