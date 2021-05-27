// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

/*
 * This test spec includes tests for the incident creation using all 3 methods:
 * - Slash command
 * - RHS
 * - Post action menu
 *
 * This spec also includes tests for starting an incident in all types of channels:
 * - Public
 * - Private
 * - Group message
 * - Direct message
 * - Direct message with self
 */
describe('incidents can be started', () => {
    const playbookName = 'Playbook (' + Date.now() + ')';
    let teamId;
    let testTeam;
    let testUser;
    let userId;
    let testPlaybook;
    let playbookId;

    before(() => {
        cy.apiInitSetup().then(({team, user, playbook}) => {
            testTeam = team;
            teamId = testTeam.id;
            testUser = user;
            userId = testUser.id;
            testPlaybook = playbook;
            playbookId = playbook.id;
        })
        // // # Login as user-1
        // cy.apiLogin('user-1');

        // // # Create a playbook
        // cy.apiGetTeamByName('ad-1').then((team) => {
        //     teamId = team.id;

        //     cy.apiGetCurrentUser().then((user) => {
        //         cy.apiCreateTestPlaybook({
        //             teamId: team.id,
        //             title: playbookName,
        //             userId: user.id,
        //         });

        //         cy.verifyPlaybookCreated(team.id, playbookName);
        //     });
        // });
    });

    beforeEach(() => {
        // # Size the viewport to show plugin icons even when RHS is open
        cy.viewport('macbook-13');

        // # Login as user-1
        cy.apiLogin(testUser);
    });

    it('while viewing a public channel', () => {
        // # Visit a public channel: off-topic
        cy.visit(`/${testTeam.name}/channels/off-topic`);

        cy.log("TEST PLAYBOOK: ", testPlaybook.name);

        // // * Verify that incident can be started with slash command
        // const incidentName = 'Public ' + Date.now();
        // cy.startIncidentWithSlashCommand(playbookName, incidentName);
        // cy.verifyIncidentActive(teamId, incidentName);
    });

    // describe('via slash command', () => {
    //     it('while viewing a public channel', () => {
    //         // # Visit a public channel: off-topic
    //         cy.visit(`/${testTeam.name}/channels/off-topic`);

    //         // * Verify that incident can be started with slash command
    //         const incidentName = 'Public ' + Date.now();
    //         cy.startIncidentWithSlashCommand(playbookName, incidentName);
    //         cy.verifyIncidentActive(teamId, incidentName);
    //     });

    //     it('while viewing a private channel', () => {
    //         // # Visit a private channel: autem-2
    //         cy.visit('/ad-1/channels/autem-2');

    //         // * Verify that incident can be started with slash command
    //         const incidentName = 'Private ' + Date.now();
    //         cy.startIncidentWithSlashCommand(playbookName, incidentName);
    //         cy.verifyIncidentActive(teamId, incidentName);
    //     });
    // });

    // describe('via RHS', () => {
    //     it('while viewing a public channel', () => {
    //         // # Visit a public channel: off-topic
    //         cy.visit('/ad-1/channels/off-topic');

    //         // * Verify that incident can be started from incident RHS
    //         const incidentName = 'Public - ' + Date.now();
    //         cy.startIncidentFromRHS(playbookName, incidentName);
    //         cy.verifyIncidentActive(teamId, incidentName);
    //     });

    //     it('while viewing a private channel', () => {
    //         // # Visit a private channel: autem-2
    //         cy.visit('/ad-1/channels/autem-2');

    //         // * Verify that incident can be started from incident RHS
    //         const incidentName = 'Private - ' + Date.now();
    //         cy.startIncidentFromRHS(playbookName, incidentName);
    //         cy.verifyIncidentActive(teamId, incidentName);
    //     });
    // });

    // describe('via post menu', () => {
    //     it('while viewing a public channel', () => {
    //         // # Visit a public channel: off-topic
    //         cy.visit('/ad-1/channels/off-topic');

    //         // * Verify that incident can be started from post menu
    //         const incidentName = 'Public - ' + Date.now();
    //         cy.startIncidentFromPostMenu(playbookName, incidentName);
    //         cy.verifyIncidentActive(teamId, incidentName);
    //     });

    //     it('while viewing a private channel', () => {
    //         // # Visit a private channel: autem-2
    //         cy.visit('/ad-1/channels/autem-2');

    //         // * Verify that incident can be started from post menu
    //         const incidentName = 'Private - ' + Date.now();
    //         cy.startIncidentFromPostMenu(playbookName, incidentName);
    //         cy.verifyIncidentActive(teamId, incidentName);
    //     });
    // });

    // it('always as channel admin', () => {
    //     // # Visit a public channel: off-topic
    //     cy.visit('/ad-1/channels/off-topic');

    //     // # Start an incident with a slash command
    //     const incidentName = 'Public ' + Date.now();
    //     cy.startIncidentWithSlashCommand(playbookName, incidentName);
    //     cy.verifyIncidentActive(teamId, incidentName);

    //     // # Open the channel header
    //     cy.get('#channelHeaderTitle').click();

    //     // * Verify the ability to edit the channel header exists
    //     cy.get('#channelEditHeader').should('exist');
    // });
});
