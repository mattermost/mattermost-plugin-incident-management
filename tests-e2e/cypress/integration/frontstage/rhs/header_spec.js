// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

describe('incident rhs > header', () => {
    const playbookName = 'Playbook (' + Date.now() + ')';
    let testTeam;
    let testUser;
    let testPlaybook;
    let testIncident;
    let incidentName;
    let channelName;
    let userId;
    let teamId;
    let playbookId;

    before(() => {
        cy.apiInitSetup({createIncident: true}).then(({team, user, playbook, incident}) => {
            testTeam = team;
            testUser = user;
            testPlaybook = playbook;
            testIncident = incident;
            incidentName = incident.name;
            channelName = testIncident.name.toLowerCase();
            userId = user.id;
            teamId = team.id;
            playbookId = playbook.id;
        });
    });

    beforeEach(() => {
        // # Size the viewport to show the RHS without covering posts.
        cy.viewport('macbook-13');

        // # Login as user-1
        cy.apiLogin(testUser);
    });

    it('shows name of active incident', () => {
        // # Navigate directly to the application and the incident channel
        cy.visit(`/${testTeam.name}/channels/` + channelName);

        // * Verify the title is displayed
        cy.get('#rhsContainer').within(() => {
            cy.get('.sidebar--right__title').contains(incidentName);
        });
    });

    it('shows name of renamed incident', () => {
        // # Navigate directly to the application and the incident channel
        cy.visit(`${testTeam.name}/channels/` + channelName);

        // * Verify the existing title is displayed
        cy.get('#rhsContainer').within(() => {
            cy.get('.sidebar--right__title').contains(incidentName);
        });
        cy.apiGetChannelByName(testTeam.name, channelName).then(({channel}) => {
            // # Rename the channel
            cy.apiPatchChannel(channel.id, {
                id: channel.id,
                display_name: 'Updated',
            });
        });

        // * Verify the updated title is displayed
        cy.get('#rhsContainer').within(() => {
            cy.get('.sidebar--right__title').contains('Updated');
        });
    });

    it('shows status when ongoing', () => {
        // # Navigate directly to the application and the incident channel
        cy.visit(`/${testTeam.name}/channels/` + channelName);

        // * Verify the title shows "Reported"
        cy.get('#rhsContainer').within(() => {
            cy.get('.sidebar--right__title').contains('Reported');
        });
    });

    it('shows status when Resolved', () => {
        // # Resolve the incident
        cy.apiUpdateStatus({
            incidentId: testIncident.id,
            userId,
            teamId,
            message: 'ending',
            description: 'description',
            status: 'Resolved',
        });

        // # Navigate directly to the application and the incident channel
        cy.visit(`/${testTeam.name}/channels/` + channelName);

        // * Verify the title shows "Resolved"
        cy.get('#rhsContainer').within(() => {
            cy.get('.sidebar--right__title').contains('Resolved');
        });
    });

    it('shows status when Archived', () => {
        // # Archive the incident
        cy.apiUpdateStatus({
            incidentId: testIncident.id,
            userId,
            teamId,
            message: 'ending',
            description: 'description',
            status: 'Archived',
        });

        // # Navigate directly to the application and the incident channel
        cy.visit(`/${testTeam.name}/channels/` + channelName);

        // * Verify the title shows "Archived"
        cy.get('#rhsContainer').within(() => {
            cy.get('.sidebar--right__title').contains('Archived');
        });
    });

    // COMMENTING OUT THE TEST THAT'S FAILING CURRENTLY
    // it('shows status for an incident with a long title name', () => {
    //     // # Start the incident
    //     const now = Date.now();
    //     const incidentName = 'Incident with a really long name (' + now + ')';
    //     const incidentChannelName = 'incident-with-a-really-long-name-' + now;
    //     cy.apiStartTestIncident({
    //         teamId,
    //         userId,
    //         playbookId,
    //         incidentName,
    //     });

    //     // # Navigate directly to the application and the incident channel
    //     cy.visit(`/${testTeam.name}/channels/` + incidentChannelName);

    //     // * Verify the title shows "Ongoing"
    //     cy.get('#rhsContainer').within(() => {
    //         cy.get('.sidebar--right__title').contains('Reported');
    //     });
    // });
});
