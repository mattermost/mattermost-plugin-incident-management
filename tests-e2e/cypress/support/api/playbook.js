// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {getRandomId} from '../../utils';
import endpoints from '../endpoints.json';

const playbooksEndpoint = endpoints.playbooks;

function createPlaybookPatch({
    teamId = '', 
    titlePrefix = 'Playbook', 
    descriptn = '', 
    createPublicIncident = false, 
    checkLists = [], 
    memberIDs = [], 
    broadcastChannelId = '', 
    reminderMessageTemplate = '', 
    reminderTimerDefaultSeconds = 0, 
    invitedUserIds = [], 
    inviteUsersEnabled = false}) {
        const randomSuffix = getRandomId();
        const request_payload = {
            team_id: teamId,
            title: `${titlePrefix}-${randomSuffix}`,
            description: descriptn,
            create_public_incident: createPublicIncident,
            checklists: checkLists,
            member_ids: memberIDs,
            broadcast_channel_id: broadcastChannelId,
            reminder_message_template: reminderMessageTemplate,
            reminder_timer_default_seconds: reminderTimerDefaultSeconds,
            invited_user_ids: invitedUserIds,
            invite_users_enabled: inviteUsersEnabled,
        }
        return request_payload;
}

// Create a playbook programmatically.
Cypress.Commands.add('apiCreatePlaybook', (...args) => {
    return cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        url: playbooksEndpoint,
        method: 'POST',
        body: createPlaybookPatch(...args),
    }).then((response) => {
        expect(response.status).to.equal(201);
        return cy.wrap({playbook: response.body});
    });
});

Cypress.Commands.add('apiCreateTestPlaybook', (
    teamId,
    userId,
    title,
    broadcastChannelId,
    reminderMessageTemplate,
    reminderTimerDefaultSeconds,
) => (
    cy.apiCreatePlaybook({
        teamId,
        userId,
        title,
        checkLists: [{
            title: 'Stage 1',
            items: [
                {title: 'Step 1'},
                {title: 'Step 2'},
            ],
        }],
        memberIDs: [
            userId,
        ],
        broadcastChannelId,
        reminderMessageTemplate,
        reminderTimerDefaultSeconds,
    })
));
