// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {FC, useEffect, useState, ReactNode} from 'react';
import {Link, useRouteMatch} from 'react-router-dom';

import {Line} from 'react-chartjs-2';

import styled from 'styled-components';
import moment from 'moment';

import {useSelector} from 'react-redux';

import {GlobalState} from 'mattermost-redux/types/store';

import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';

import {Team} from 'mattermost-redux/types/teams';

import {Stats} from 'src/types/stats';
import {fetchStats} from 'src/client';
import {renderDuration} from 'src/components/duration';

type SatisticCountProps = {
    title: ReactNode;
    icon: string;
    count?: ReactNode;
    id?: string;
    to?: string;
}

type URLParams = {
    team: string
    plugin: string
}

const StyledLink = styled(Link)`
    && {
        color: inherit;
    }
`;

const StatisticCount: FC<SatisticCountProps> = (props: SatisticCountProps) => {
    const match = useRouteMatch<URLParams>('/:team/:plugin');
    const inner = (
        <div className='col-lg-3 col-md-4 col-sm-6'>
            <div className='total-count'>
                <div
                    data-testid={`${props.id}Title`}
                    className='title'
                >
                    {props.title}
                    <i className={'fa ' + props.icon}/>
                </div>
                <div
                    data-testid={props.id}
                    className='content'
                >
                    {props.count}
                </div>
            </div>
        </div>
    );

    if (props.to) {
        return (
            <StyledLink
                to={`/${match?.params.team}/${match?.params.plugin}/` + props.to}
            >
                {inner}
            </StyledLink>
        );
    }

    return inner;
};

type GraphBoxProps = {
    title: string
    xlabel: string
    labels?: string[]
    data?: number[]
}

const GraphBoxContainer = styled.div`
    padding: 10px;
    width: 50%;
    float: left;
`;

const GraphBox: FC<GraphBoxProps> = (props: GraphBoxProps) => {
    return (
        <GraphBoxContainer>
            <Line
                legend={{display: false}}
                options={{
                    title: {
                        display: true,
                        text: props.title,
                    },
                    scales: {
                        yAxes: [{
                            ticks: {
                                beginAtZero: true,
                                callback: (value: number) => (Number.isInteger(value) ? value : null),
                            },
                        }],
                        xAxes: [{
                            scaleLabel: {
                                display: true,
                                labelString: props.xlabel,
                            },
                        }],
                    },
                }}
                data={{
                    labels: props.labels,
                    datasets: [{
                        fill: true,
                        backgroundColor: 'rgba(151,187,205,0.2)',
                        borderColor: 'rgba(151,187,205,1)',
                        pointBackgroundColor: 'rgba(151,187,205,1)',
                        pointBorderColor: '#fff',
                        pointHoverBackgroundColor: '#fff',
                        pointHoverBorderColor: 'rgba(151,187,205,1)',
                        data: props.data,
                    }],
                }}
            />
        </GraphBoxContainer>
    );
};

const StatsView: FC = () => {
    const [stats, setStats] = useState<Stats|null>(null);
    const currentTeam = useSelector<GlobalState, Team>(getCurrentTeam);

    useEffect(() => {
        async function fetchStatsAsync() {
            const ret = await fetchStats(currentTeam.id);
            setStats(ret);
        }
        fetchStatsAsync();
    }, [currentTeam.id]);

    return (
        <div className='IncidentList container-medium'>
            <div className='Backstage__header'>
                <div
                    className='title'
                    data-testid='titleStats'
                >
                    {'Statistics'}
                    <div className='light'>
                        {`(${currentTeam.name})`}
                    </div>
                </div>
            </div>
            <div className='wrapper--fixed team_statistics'>
                <div className='admin-console__wrapper'>
                    <div className='admin-console__content'/>
                    <div>
                        <StatisticCount
                            id={'TotalReportedIncidents'}
                            title={'Total Reported Incidents'}
                            icon={'fa-exclamation-triangle'}
                            count={stats?.total_reported_incidents}
                            to={'incidents?status=Reported'}
                        />
                        <StatisticCount
                            id={'TotalActiveIncidents'}
                            title={'Total Active Incidents'}
                            icon={'fa-exclamation-circle'}
                            count={stats?.total_active_incidents}
                            to={'incidents?status=Active'}
                        />
                        <StatisticCount
                            id={'TotalActiveParticipants'}
                            title={'Total Active Participants'}
                            icon={'fa-users'}
                            count={stats?.total_active_participants}
                        />
                        <StatisticCount
                            id={'AverageDuration'}
                            title={'Average Duration'}
                            icon={'fa-clock-o'}
                            count={renderDuration(moment.duration(stats?.average_duration_active_incidents_minutes, 'minutes'))}
                        />
                    </div>
                    <div>
                        <GraphBox
                            title={'Total incidents by day'}
                            xlabel={'Days ago'}
                            labels={stats?.active_incidents.map((value: number, index: number) => String(index + 1)).reverse()}
                            data={stats?.active_incidents.slice().reverse()}
                        />
                        <GraphBox
                            title={'Total participants by day'}
                            xlabel={'Days ago'}
                            labels={stats?.people_in_incidents.map((value: number, index: number) => String(index + 1)).reverse()}
                            data={stats?.people_in_incidents.slice().reverse()}
                        />
                    </div>
                    <div>
                        <GraphBox
                            title={'Mean-time-to-acknowledge by day (hours)'}
                            xlabel={'Days ago'}
                            labels={stats?.average_start_to_active.map((value: number, index: number) => String(index + 1)).reverse()}
                            data={stats?.average_start_to_active.map((value: number) => Math.floor(value / 3600000)).reverse()}
                        />
                        <GraphBox
                            title={'Mean-time-to-resolve by day (hours)'}
                            xlabel={'Days ago'}
                            labels={stats?.average_start_to_resolved.map((value: number, index: number) => String(index + 1)).reverse()}
                            data={stats?.average_start_to_resolved.map((value: number) => Math.floor(value / 3600000)).reverse()}
                        />
                        <div/>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default StatsView;
