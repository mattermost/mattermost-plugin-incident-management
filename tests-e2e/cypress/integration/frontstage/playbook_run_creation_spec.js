// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

/*
 * This test spec includes tests for the playbook run creation using all 3 methods:
 * - Slash command
 * - RHS
 * - Post action menu
 *
 * This spec also includes tests for starting a playbook run in all types of channels:
 * - Public
 * - Private
 * - Group message
 * - Direct message
 * - Direct message with self
 */
describe('playbook runs can be started', () => {
    const playbookName = 'Playbook (' + Date.now() + ')';
    let teamId;

    before(() => {
        // # Login as user-1
        cy.apiLogin('user-1');

        // # Create a playbook
        cy.apiGetTeamByName('ad-1').then((team) => {
            teamId = team.id;

            cy.apiGetCurrentUser().then((user) => {
                cy.apiCreateTestPlaybook({
                    teamId: team.id,
                    title: playbookName,
                    userId: user.id,
                });

                cy.verifyPlaybookCreated(team.id, playbookName);
            });
        });
    });

    beforeEach(() => {
        // # Size the viewport to show plugin icons even when RHS is open
        cy.viewport('macbook-13');

        // # Login as user-1
        cy.apiLogin('user-1');

        // # Verify the playbook is there
        cy.verifyPlaybookCreated(teamId, playbookName);
    });

    describe('via slash command', () => {
        it('while viewing a public channel', () => {
            // # Visit a public channel: off-topic
            cy.visit('/ad-1/channels/off-topic');

            // * Verify that playbook run can be started with slash command
            const playbookRunName = 'Public ' + Date.now();
            cy.startPlaybookRunWithSlashCommand(playbookName, playbookRunName);
            cy.verifyPlaybookRunActive(teamId, playbookRunName);
        });

        it('while viewing a private channel', () => {
            // # Visit a private channel: autem-2
            cy.visit('/ad-1/channels/autem-2');

            // * Verify that playbook run can be started with slash command
            const playbookRunName = 'Private ' + Date.now();
            cy.startPlaybookRunWithSlashCommand(playbookName, playbookRunName);
            cy.verifyPlaybookRunActive(teamId, playbookRunName);
        });
    });

    /* describe('via RHS', () => {
        it('while viewing a public channel', () => {
            // # Visit a public channel: off-topic
            cy.visit('/ad-1/channels/off-topic');

            // * Verify that playbook run can be started from playbook run RHS
            const playbookRunName = 'Public - ' + Date.now();
            cy.startPlaybookRunFromRHS(playbookName, playbookRunName);
            cy.verifyPlaybookRunActive(teamId, playbookRunName);
        });

        it('while viewing a private channel', () => {
            // # Visit a private channel: autem-2
            cy.visit('/ad-1/channels/autem-2');

            // * Verify that playbook run can be started from playbook run RHS
            const playbookRunName = 'Private - ' + Date.now();
            cy.startPlaybookRunFromRHS(playbookName, playbookRunName);
            cy.verifyPlaybookRunActive(teamId, playbookRunName);
        });
    }); */

    describe('via post menu', () => {
        it('while viewing a public channel', () => {
            // # Visit a public channel: off-topic
            cy.visit('/ad-1/channels/off-topic');

            // * Verify that playbook run can be started from post menu
            const playbookRunName = 'Public - ' + Date.now();
            cy.startPlaybookRunFromPostMenu(playbookName, playbookRunName);
            cy.verifyPlaybookRunActive(teamId, playbookRunName);
        });

        it('while viewing a private channel', () => {
            // # Visit a private channel: autem-2
            cy.visit('/ad-1/channels/autem-2');

            // * Verify that playbook run can be started from post menu
            const playbookRunName = 'Private - ' + Date.now();
            cy.startPlaybookRunFromPostMenu(playbookName, playbookRunName);
            cy.verifyPlaybookRunActive(teamId, playbookRunName);
        });
    });

    it('always as channel admin', () => {
        // # Visit a public channel: off-topic
        cy.visit('/ad-1/channels/off-topic');

        // # Start a playbook run with a slash command
        const playbookRunName = 'Public ' + Date.now();
        cy.startPlaybookRunWithSlashCommand(playbookName, playbookRunName);
        cy.verifyPlaybookRunActive(teamId, playbookRunName);

        // # Open the channel header
        cy.get('#channelHeaderTitle').click();

        // * Verify the ability to edit the channel header exists
        cy.get('#channelEditHeader').should('exist');
    });
});
