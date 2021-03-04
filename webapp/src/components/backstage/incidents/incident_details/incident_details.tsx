// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {FC, useState, useEffect} from 'react';
import moment from 'moment';
import {Tooltip, OverlayTrigger} from 'react-bootstrap';
import {Redirect, useRouteMatch} from 'react-router-dom';
import {useSelector} from 'react-redux';
import styled from 'styled-components';

import {Team} from 'mattermost-redux/types/teams';
import {GlobalState} from 'mattermost-redux/types/store';
import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';

import {fetchIncident, fetchIncidentMetadata} from 'src/client';
import {Incident, Metadata as IncidentMetadata, incidentIsActive, incidentCurrentStatus} from 'src/types/incident';
import Profile from 'src/components/profile/profile';
import {OVERLAY_DELAY, ErrorPageTypes} from 'src/constants';
import {navigateToTeamPluginUrl, navigateToUrl, teamPluginErrorUrl} from 'src/browser_routing';
import {BackstageNavbar, BackstageNavbarIcon} from 'src/components/backstage/backstage';
import {renderDuration} from 'src/components/duration';
import RightDots from 'src/components/assets/right_dots';
import RightFade from 'src/components/assets/right_fade';
import LeftDots from 'src/components/assets/left_dots';
import LeftFade from 'src/components/assets/left_fade';

import StatusBadge from '../status_badge';

import ChecklistTimeline from './checklist_timeline';
import ExportLink from './export_link';

interface MatchParams {
    incidentId: string
}

const OuterContainer = styled.div`
    background: var(center-channel-bg);
    display: flex;
    flex-direction: column;
    min-height: 100vh;
`;

const Container = styled.div`
    margin: 0 160px;
    width: calc(100vw - 320px);
`;

const IncidentTitle = styled.div`
    padding: 0 15px;
    font-size: 20px;
    line-height: 28px;
    color: var(--center-channel-color);
`;

const CommanderContainer = styled.div`
    display: flex;
    align-items: center;
    margin-right: 15px;

    .label {
        margin-top: 1px;
        font-size: 12px;
        color: var(--center-channel-color-56);
    }

    .profile {
        font-size: 14px;
    }
`;

const NavbarPadding = styled.div`
    flex-grow: 1;
`;

const BackstageIncidentDetailsContainer = styled.div`
    padding-top: 2rem;
    font-family: $font-family;
    color: var(--center-channel-color-90);
    padding: 4rem 0 3.2rem;

    .details-header {
        display: flex;
        font-size: 2.8rem;
        font-style: normal;
        font-weight: normal;
        bottom: 0;
        left: 0;
        height: auto;

        .link-icon {
            border-radius: 4px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: var(--center-channel-color-56);
            font-size: 20px;
            width: 4rem;
            height: 4rem;

            &:hover {
                background: var(--center-channel-color-08);
                color: var(--center-channel-color-72);
            }

            &:active {
                background: var(--button-bg-08);
                color: var(--button-bg);
            }
        }
    }

    .subheader {
        padding: 1.2rem 0px 2.4rem;
        display: flex;
        justify-content: space-between;
        font-weight: 600;

        .summary-tab {
            color: var(--button-bg);
            width: 98px;
            text-align: center;
            padding: 8px;
            box-shadow: inset 0px -2px 0px var(--button-bg);
        }

        .disabled {
            color: var(--center-channel-color-56);
        }

        .export-link {
            display: flex;
            align-items: center;
            color: var(--button-bg);
        }

        .export-icon {
            font-size: 16px;
            padding-right: 8px;
        }
    }

    .statistics-row {
        display: flex;
        flex-wrap: wrap;
    }

    .chart-block {
        padding: 2rem;
        border: 1px solid var(--center-channel-color-08);
        background: var(--center-channel-bg);
        box-shadow: 0px 4px 20px rgba(0, 0, 0, 0.08);
        border-radius: 8px;
        margin: 2.4rem 0;
        height: 1%;
        overflow: hidden;
        flex: 0 0 26rem;

        .chart-title {
            color: var(--center-channel-color-56);
            font-size: 14px;
            font-weight: 600;
        }

        .chart-label{
            opacity: .72;
        }
    }

    .statistics-row__block {
        padding: 2rem;
        border: 1px solid var(--center-channel-color-08);
        background: var(--center-channel-bg);
        box-shadow: 0px 4px 20px rgba(0, 0, 0, 0.08);
        border-radius: 8px;
        margin: 0 0 0 3.2rem;
        height: 168px;
        flex: 0 0 26rem;

        &:first-child {
            margin: 0;
        }

        .title {
            color: var(--center-channel-color-56);
            font-size: 14px;
            font-weight: 600;
            padding: 0 0 16px;
        }

        .content {
            font-size: 24px;
            padding-top: 17px;
            padding-bottom: 22px;
            text-align: center;
        }

        .block-footer {
            color: var(--center-channel-color-56);
            font-size: 12px;
            padding-bottom: 20px;

            .icon {
                width: 1.2rem;
                height: 1.2rem;
                margin-left: .8rem;
                font-size: 14px;
            }
        }

        .box-icon {
            padding-right: 19px;
        }
    }

    .no-permission-div {
        padding: 15px;
        margin: 45px;
        border: 1px solid var(--center-channel-color-16);
        text-align: center;
        width: 100%;
    }
`;

const FetchingStateType = {
    loading: 'loading',
    fetched: 'fetched',
    notFound: 'notfound',
};

const BackstageIncidentDetails: FC = () => {
    const [incident, setIncident] = useState<Incident | null>(null);
    const [incidentMetadata, setIncidentMetadata] = useState<IncidentMetadata | null>(null);
    const currentTeam = useSelector<GlobalState, Team>(getCurrentTeam);

    const match = useRouteMatch<MatchParams>();

    const [fetchingState, setFetchingState] = useState(FetchingStateType.loading);

    useEffect(() => {
        const incidentId = match.params.incidentId;

        Promise.all([fetchIncident(incidentId), fetchIncidentMetadata(incidentId)]).then(([incidentResult, incidentMetadataResult]) => {
            setIncident(incidentResult);
            setIncidentMetadata(incidentMetadataResult);
            setFetchingState(FetchingStateType.fetched);
        }).catch(() => {
            setFetchingState(FetchingStateType.notFound);
        });
    }, [match.params.incidentId]);

    if (fetchingState === FetchingStateType.loading) {
        return null;
    }

    if (fetchingState === FetchingStateType.notFound || incident === null || incidentMetadata === null) {
        return <Redirect to={teamPluginErrorUrl(currentTeam.name, ErrorPageTypes.INCIDENTS)}/>;
    }

    const goToChannel = () => {
        navigateToUrl(`/${incidentMetadata.team_name}/channels/${incidentMetadata.channel_name}`);
    };

    const closeIncidentDetails = () => {
        navigateToTeamPluginUrl(currentTeam.name, '/incidents');
    };

    return (
        <OuterContainer>
            <BackstageNavbar>
                <BackstageNavbarIcon
                    className='icon-arrow-left back-icon'
                    onClick={closeIncidentDetails}
                />
                <IncidentTitle data-testid='incident-title'>
                    {`Incident ${incident.name}`}
                </IncidentTitle>
                <StatusBadge status={incidentCurrentStatus(incident)}/>
                <NavbarPadding/>
                <CommanderContainer>
                    <span className='label'>{'Commander:'}</span>
                    <Profile
                        userId={incident.commander_user_id}
                        classNames={{ProfileButton: true, profile: true}}
                    />
                </CommanderContainer>
            </BackstageNavbar>
            <Container>
                <BackstageIncidentDetailsContainer>
                    <div className='subheader'>
                        { /*Summary will be a tab once Post Mortem is included */}
                        <div className='summary-tab'>
                            {'Summary'}
                        </div>
                        <ExportLink incident={incident}/>
                    </div>
                    <div className='statistics-row'>
                        <div className='statistics-row__block'>
                            <div className='title'>
                                {'Duration'}
                            </div>
                            <div className='content'>
                                <i className='icon icon-clock-outline box-icon'/>
                                {duration(incident)}
                            </div>
                            <div className='block-footer text-right'>
                                <span>{timeFrameText(incident)}</span>
                            </div>
                        </div>
                        <OverlayTrigger
                            placement='bottom'
                            delay={OVERLAY_DELAY}
                            overlay={<Tooltip id='goToChannel'>{'Number of users involved in the incident'}</Tooltip>}
                        >
                            <div className='statistics-row__block'>
                                <div className='title'>
                                    {'Members Involved'}
                                </div>
                                <div className='content'>
                                    <i className='icon icon-account-multiple-outline box-icon'/>
                                    {incidentMetadata.num_members}
                                </div>
                            </div>
                        </OverlayTrigger>
                        <div className='statistics-row__block'>
                            <div className='title'>
                                {'Messages'}
                            </div>
                            <div className='content'>
                                <i className='icon icon-send box-icon'/>
                                {incidentMetadata.total_posts}
                            </div>
                            <div className='block-footer text-right'>
                                <a
                                    className='link'
                                    onClick={goToChannel}
                                >
                                    {'Jump to Channel'}
                                    <i className='icon icon-arrow-right'/>
                                </a>
                            </div>
                        </div>
                    </div>
                    <div className='chart-block'>
                        <ChecklistTimeline
                            incident={incident}
                        />
                    </div>
                </BackstageIncidentDetailsContainer>
            </Container>
            <RightDots/>
            <RightFade/>
            <LeftDots/>
            <LeftFade/>
        </OuterContainer>
    );
};

const duration = (incident: Incident) => {
    const isActive = incidentIsActive(incident);
    if (!isActive && moment(incident.end_at).isSameOrBefore('2020-01-01')) {
        // No end datetime available to calculate duration
        return '--';
    }

    const endTime = isActive ? moment() : moment(incident.end_at);
    const timeSinceCreation = moment.duration(endTime.diff(moment(incident.create_at)));

    return renderDuration(timeSinceCreation);
};

const timeFrameText = (incident: Incident) => {
    const mom = moment(incident.end_at);

    let endedText = 'Ongoing';

    if (!incidentIsActive(incident)) {
        endedText = mom.isSameOrAfter('2020-01-01') ? mom.format('DD MMM h:mmA') : '--';
    }

    const startedText = moment(incident.create_at).format('DD MMM h:mmA');

    return (`${startedText} - ${endedText}`);
};

export default BackstageIncidentDetails;
