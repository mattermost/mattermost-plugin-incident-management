// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

import {TINY} from '../../fixtures/timeouts';

describe('incident rhs checklist', () => {
    const playbookName = 'Playbook (' + Date.now() + ')';
    let teamId;
    let userId;
    let playbookId;

    before(() => {
        // # Login as user-1
        cy.apiLogin('user-1');

        // # Switch to clean display mode
        cy.apiSaveMessageDisplayPreference('clean');

        cy.apiGetTeamByName('ad-1').then((team) => {
            teamId = team.id;
            cy.apiGetCurrentUser().then((user) => {
                userId = user.id;

                // # Create a playbook
                cy.apiCreatePlaybook({
                    teamId: team.id,
                    title: playbookName,
                    checklists: [{
                        title: 'Stage 1',
                        items: [
                            {title: 'Step 1', command: '/invalid'},
                            {title: 'Step 2', command: '/echo VALID'},
                            {title: 'Step 3'},
                            {title: 'Step 4'},
                            {title: 'Step 5'},
                            {title: 'Step 6'},
                            {title: 'Step 7'},
                            {title: 'Step 8'},
                            {title: 'Step 9'},
                            {title: 'Step 10'},
                            {title: 'Step 11'},
                            {title: 'Step 12'},
                        ],
                    }],
                    memberIDs: [
                        user.id,
                    ],
                }).then((playbook) => {
                    playbookId = playbook.id;
                });
            });
        });
    });

    beforeEach(() => {
        // # Size the viewport to task list without scrolling issues
        cy.viewport('macbook-13');

        // # Login as user-1
        cy.apiLogin('user-1');
    });

    describe('rhs stuff', () => {
        let incidentName;
        let incidentChannelName;

        before(() => {
            // # Start the incident
            const now = Date.now();
            incidentName = 'Incident (' + now + ')';
            incidentChannelName = 'incident-' + now;
            cy.apiStartIncident({
                teamId,
                playbookId,
                incidentName,
                commanderUserId: userId,
            });

            cy.apiGetChannelByName('ad-1', incidentChannelName).then(({channel}) => {
                // # Add @aaron.peterson
                cy.apiGetUserByEmail('user-7@sample.mattermost.com').then(({user}) => {
                    cy.apiAddUserToChannel(channel.id, user.id);
                });

                // # Add @christina.wilson
                cy.apiGetUserByEmail('user-6@sample.mattermost.com').then(({user}) => {
                    cy.apiAddUserToChannel(channel.id, user.id);
                });

                // # Add @diana.wells
                cy.apiGetUserByEmail('user-8@sample.mattermost.com').then(({user}) => {
                    cy.apiAddUserToChannel(channel.id, user.id);
                });

                // # Add @emily.meyer
                cy.apiGetUserByEmail('user-14@sample.mattermost.com').then(({user}) => {
                    cy.apiAddUserToChannel(channel.id, user.id);
                });

                // # Add @frances.elliot
                cy.apiGetUserByEmail('user-24@sample.mattermost.com').then(({user}) => {
                    cy.apiAddUserToChannel(channel.id, user.id);
                });

                // # Add @jack.wheeler
                cy.apiGetUserByEmail('user-3@sample.mattermost.com').then(({user}) => {
                    cy.apiAddUserToChannel(channel.id, user.id);
                });
            });
        });

        beforeEach(() => {
            // # Navigate directly to the application and the incident channel
            cy.visit('/ad-1/channels/' + incidentChannelName);

            // * Verify the incident RHS is open.
            cy.get('#rhsContainer').should('exist').within(() => {
                cy.findByText(incidentName).should('exist');

                // # Select the tasks tab
                cy.findByTestId('tasks').click();
            });
        });

        it('shows an ephemeral error when running an invalid slash command', () => {
            cy.get('#rhsContainer').should('exist').within(() => {
                // * Verify the command has not yet been run.
                cy.findAllByTestId('run').eq(0).should('have.text', 'Run');

                // * Run the /invalid slash command
                cy.findAllByTestId('run').eq(0).click();

                // * Verify the command still has not yet been run.
                cy.findAllByTestId('run').eq(0).should('have.text', 'Run');
            });

            // * Verify the expected error message.
            cy.verifyEphemeralMessage('Failed to execute slash command /invalid');
        });

        it('successfully runs a valid slash command', () => {
            cy.get('#rhsContainer').should('exist').within(() => {
                // * Verify the command has not yet been run.
                cy.findAllByTestId('run').eq(1).should('have.text', 'Run');

                // * Run the /invalid slash command
                cy.findAllByTestId('run').eq(1).click();

                // * Verify the command has now been run.
                cy.findAllByTestId('run').eq(1).should('have.text', 'Rerun');
            });

            // # Verify the expected output.
            cy.verifyPostedMessage('VALID');
        });

        it('still shows slash commands as having been run after reload', () => {
            // # Navigate directly to the application and the incident channel
            cy.visit('/ad-1/channels/' + incidentChannelName);

            cy.get('#rhsContainer').should('exist').within(() => {
                // # Select the tasks tab
                cy.findByTestId('tasks').click();

                // * Verify the invalid command still has not yet been run.
                cy.findAllByTestId('run').eq(0).should('have.text', 'Run');

                // * Verify the valid command has been run.
                cy.findAllByTestId('run').eq(1).should('have.text', 'Rerun');
            });
        });

        it('delete task', () => {
            // Hover over the checklist item
            cy.findAllByTestId('checkbox-item-container').eq(0).trigger('mouseover');

            // Click the trash
            cy.get('.icon-trash-can-outline').click();

            // Press the delete task button
            cy.findByText('Delete Task').click();

            // Verify the first task is gone
            cy.findByText('Step 1').should('not.exist');
        });

        it('assignee selector is shifted up if it falls below window', () => {
            // Hover over a checklist item at the end
            cy.findAllByTestId('checkbox-item-container').eq(10).trigger('mouseover');

            // Click the profile icon
            cy.get('.icon-account-plus-outline').click().wait(TINY);

            cy.isInViewport('.incident-user-select');
        });
    });
});
