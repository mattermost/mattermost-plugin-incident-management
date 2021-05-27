// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {getRandomId} from '../../utils';
import endpoints from '../endpoints.json';

const incidentsEndpoint = endpoints.incidents;
const randomSuffix = getRandomId();

function startIncidentPatch({
    incidentPrefix = 'Incident',
    userId = '',
    teamId = '',
    playbookId = '',
    incidentDescription = '',
    incidentName = `${incidentPrefix}-${randomSuffix}`}) {
        // const randomSuffix = getRandomId();
        // const incidentName = `${incidentPrefix}-${randomSuffix}`;
        const request_payload = {
            name: incidentName,
            commander_user_id: userId,
            team_id: teamId,
            playbook_id: playbookId,
            description: incidentDescription,
        }
        return request_payload;
    }

/**
 * Start an incident directly via API.
 */
 Cypress.Commands.add('apiStartIncident', (...args) => {
    return cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        url: incidentsEndpoint,
        method: 'POST',
        body: startIncidentPatch(...args),
    }).then((response) => {
        expect(response.status).to.equal(201);
        return cy.wrap({incident: response.body});
    });
});

/**
 * Create a test incident.
 */
Cypress.Commands.add('apiCreateIncident', (
    teamId,
    userId,
    playbookId,
    incidentDesc,
    incidentName,
) => (
    cy.apiStartIncident({
        teamId,
        userId,
        playbookId,
        incidentDesc,
        incidentName,
    })
));

// Update an incident's status programmatically.
Cypress.Commands.add('apiUpdateStatus', ({
    incidentId,
    userId,
    channelId,
    teamId,
    message,
    description,
    status
}) => {
    return cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        url: `${incidentsEndpoint}/${incidentId}/update-status-dialog`,
        method: 'POST',
        body: {
            type: 'dialog_submission',
            callback_id: '',
            state: '',
            user_id: userId,
            channel_id: channelId,
            team_id: teamId,
            submission: {message, description, reminder: '15', status},
            cancelled: false,
        },
    }).then((response) => {
        expect(response.status).to.equal(200);
        cy.wrap(response.body);
    });
});
    