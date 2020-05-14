// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useState} from 'react';

import moment from 'moment';

import {Incident} from 'src/types/incident';
import {fetchIncidents} from 'src/client';

import Profile from 'src/components/profile';
import BackstageIncidentDetails from '../incidents/incident_details';
import StatusBadge from '../incidents/status_badge';

import './incident_list.scss';

interface Props {
    currentTeamId: string;
    currentTeamName: string;
}

export default function IncidentList(props: Props) {
    const [incidents, setIncidents] = useState<Incident[]>([]);
    const [selectedIncident, setSelectedIncident] = useState<Incident|null>(null);

    useEffect(() => {
        async function fetchAllIncidents() {
            const data = await fetchIncidents(props.currentTeamId);
            setIncidents(data);
        }

        fetchAllIncidents();
    }, []);

    const openIncidentDetails = (incident: Incident) => {
        setSelectedIncident(incident);
    };

    const closeIncidentDetails = () => {
        setSelectedIncident(null);
    };

    return (
        <>
            {!selectedIncident && (
                <div className='IncidentList'>
                    <div className='Backstage__header'>
                        <div className='title'>
                            {'Incidents'}
                            <div className='light'>
                                {'(' + props.currentTeamName + ')'}
                            </div>
                        </div>
                    </div>
                    <div className='list'>
                        {
                            <div className='Backstage-list-header'>
                                <div className='row'>
                                    <div className='col-sm-3'> {'Name'} </div>
                                    <div className='col-sm-2'> {'Status'} </div>
                                    <div className='col-sm-2'> {'Start Date'} </div>
                                    <div className='col-sm-2'> {'End Date'} </div>
                                    <div className='col-sm-3'> {'Commander'} </div>
                                </div>
                            </div>
                        }

                        {
                            !incidents.length &&
                            <div className='text-center pt-8'>
                                {'There are no incidents for team.'}
                            </div>
                        }

                        {
                            incidents.map((incident) => (
                                <div
                                    className='row incident-item'
                                    key={incident.id}
                                >
                                    <div className='col-sm-3'>
                                        <a
                                            className='incident-item__title'
                                            onClick={() => openIncidentDetails(incident)}
                                        >
                                            {incident.name}
                                        </a>
                                    </div>
                                    <div className='col-sm-2'> {
                                        <StatusBadge isActive={incident.is_active}/>
                                    }
                                    </div>
                                    <div
                                        className='col-sm-2'
                                    > {moment.unix(incident.created_at).format('DD MMM h:mmA')} </div>
                                    <div
                                        className='col-sm-2'
                                    > {incident.is_active ? 'Ongoing' : moment.unix(incident.ended_at).format('DD MMM h:mmA')} </div>
                                    <div className='col-sm-3'>
                                        <Profile userId={incident.commander_user_id}/>
                                    </div>
                                </div>
                            ))
                        }
                    </div>
                </div>
            )}
            {
                selectedIncident &&
                <BackstageIncidentDetails
                    incident={selectedIncident}
                    onClose={closeIncidentDetails}
                />
            }
        </>
    );
}

