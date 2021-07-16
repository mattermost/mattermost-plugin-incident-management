// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

import * as TIMEOUTS from '../../../fixtures/timeouts';

describe('playbook run rhs', () => {
    const playbookName = 'Playbook (' + Date.now() + ')';
    let teamId;
    let userId;
    let playbookId;

    before(() => {
        // # Login as user-1
        cy.apiLogin('user-1');

        cy.apiGetTeamByName('ad-1').then((team) => {
            teamId = team.id;
            cy.apiGetCurrentUser().then((user) => {
                userId = user.id;

                // # Create a playbook
                cy.apiCreateTestPlaybook({
                    teamId: team.id,
                    title: playbookName,
                    userId: user.id,
                }).then((playbook) => {
                    playbookId = playbook.id;
                });
            });
        });
    });

    beforeEach(() => {
        // # Login as user-1
        cy.apiLogin('user-1');
    });

    describe('does not open', () => {
        it('when navigating to a non-playbook run channel', () => {
            // # Navigate to the application
            cy.visit('/ad-1/');

            // # Select a channel without a playbook run.
            cy.get('#sidebarItem_off-topic').click({force: true});

            // # Wait until the channel loads enough to show the post textbox.
            cy.get('#post-create').should('exist');

            // # Wait a bit longer to be confident.
            cy.wait(TIMEOUTS.TWO_SEC);

            // * Verify the playbook run RHS is not open.
            cy.get('#rhsContainer').should('not.exist');
        });

        it('when navigating to an playbook run channel with the RHS already open', () => {
            // # Navigate to the application.
            cy.visit('/ad-1/');

            // # Select a channel without a playbook run.
            cy.get('#sidebarItem_off-topic').click({force: true});

            // # Run the playbook after loading the application
            const now = Date.now();
            const playbookRunName = 'Playbook Run (' + now + ')';
            const playbookRunChannelName = 'playbook-run-' + now;
            cy.apiRunPlaybook({
                teamId,
                playbookId,
                playbookRunName,
                ownerUserId: userId,
            });

            // # Open the flagged posts RHS
            cy.get('#channelHeaderFlagButton').click({force: true});

            // # Open the playbook run channel from the LHS.
            cy.get(`#sidebarItem_${playbookRunChannelName}`).click({force: true});

            // # Wait until the channel loads enough to show the post textbox.
            cy.get('#post-create').should('exist');

            // # Wait a bit longer to be confident.
            cy.wait(TIMEOUTS.TWO_SEC);

            // * Verify the playbook run RHS is not open.
            cy.get('#rhsContainer').should('not.exist');
        });
    });

    describe('opens', () => {
        it('when navigating directly to an ongoing playbook run channel', () => {
            // # Run the playbook
            const now = Date.now();
            const playbookRunName = 'Playbook Run (' + now + ')';
            const playbookRunChannelName = 'playbook-run-' + now;
            cy.apiRunPlaybook({
                teamId,
                playbookId,
                playbookRunName,
                ownerUserId: userId,
            });

            // # Navigate directly to the application and the playbook run channel
            cy.visit('/ad-1/channels/' + playbookRunChannelName);

            // * Verify the playbook run RHS is open.
            cy.get('#rhsContainer').should('exist').within(() => {
                cy.findByText(playbookRunName).should('exist');
            });
        });

        it('when navigating directly to a resolved playbook run channel', () => {
            // # Run the playbook
            const now = Date.now();
            const playbookRunName = 'Playbook Run (' + now + ')';
            const playbookRunChannelName = 'playbook-run-' + now;
            cy.apiRunPlaybook({
                teamId,
                playbookId,
                playbookRunName,
                ownerUserId: userId,
            }).then((playbookRun) => {
                // # End the playbook run
                cy.apiUpdateStatus({
                    playbookRunId: playbookRun.id,
                    userId,
                    teamId,
                    message: 'resolved',
                    description: 'description',
                    status: 'Resolved',
                });
            });

            // # Navigate directly to the application and the playbook run channel
            cy.visit('/ad-1/channels/' + playbookRunChannelName);

            // * Verify the playbook run RHS is open.
            cy.get('#rhsContainer').should('exist').within(() => {
                cy.findByText(playbookRunName).should('exist');
            });
        });

        it('when navigating directly to an archived playbook run channel', () => {
            // # Run the playbook
            const now = Date.now();
            const playbookRunName = 'Playbook Run (' + now + ')';
            const playbookRunChannelName = 'playbook-run-' + now;
            cy.apiRunPlaybook({
                teamId,
                playbookId,
                playbookRunName,
                ownerUserId: userId,
            }).then((playbookRun) => {
                // # End the playbook run
                cy.apiUpdateStatus({
                    playbookRunId: playbookRun.id,
                    userId,
                    teamId,
                    message: 'ending',
                    description: 'description',
                    status: 'Archived',
                });
            });

            // # Navigate directly to the application and the playbook run channel
            cy.visit('/ad-1/channels/' + playbookRunChannelName);

            // * Verify the playbook run RHS is open.
            cy.get('#rhsContainer').should('exist').within(() => {
                cy.findByText(playbookRunName).should('exist');
            });
        });

        it('for a new, ongoing playbook run channel opened from the lhs', () => {
            // # Navigate to the application.
            cy.visit('/ad-1/');

            // # Ensure the channel is loaded before continuing (allows redux to sync).
            cy.get('#centerChannelFooter').findByTestId('post_textbox').should('exist');

            // # Select a channel without a playbook run.
            cy.get('#sidebarItem_off-topic').click({force: true});

            // # Run the playbook after loading the application
            const now = Date.now();
            const playbookRunName = 'Playbook Run (' + now + ')';
            const playbookRunChannelName = 'playbook-run-' + now;
            cy.apiRunPlaybook({
                teamId,
                playbookId,
                playbookRunName,
                ownerUserId: userId,
            });

            // # Open the playbook run channel from the LHS.
            cy.get(`#sidebarItem_${playbookRunChannelName}`).click({force: true});

            // * Verify the playbook run RHS is open.
            cy.get('#rhsContainer').should('exist').within(() => {
                cy.findByText(playbookRunName).should('exist');
            });
        });

        it('for a new, resolved playbook run channel opened from the lhs', () => {
            // # Navigate to the application.
            cy.visit('/ad-1/');

            // # Ensure the channel is loaded before continuing (allows redux to sync).
            cy.get('#centerChannelFooter').findByTestId('post_textbox').should('exist');

            // # Select a channel without a playbook run.
            cy.get('#sidebarItem_off-topic').click({force: true});

            // # Run the playbook after loading the application
            const now = Date.now();
            const playbookRunName = 'Playbook Run (' + now + ')';
            const playbookRunChannelName = 'playbook-run-' + now;
            cy.apiRunPlaybook({
                teamId,
                playbookId,
                playbookRunName,
                ownerUserId: userId,
            }).then((playbookRun) => {
                // # End the playbook run
                cy.apiUpdateStatus({
                    playbookRunId: playbookRun.id,
                    userId,
                    teamId,
                    message: 'resolving',
                    description: 'description',
                    status: 'Resolved',
                });
            });

            // # Open the playbook run channel from the LHS.
            cy.get(`#sidebarItem_${playbookRunChannelName}`).click({force: true});

            // * Verify the playbook run RHS is open.
            cy.get('#rhsContainer').should('exist').within(() => {
                cy.findByText(playbookRunName).should('exist');
            });
        });

        it('for a new, archived playbook run channel opened from the lhs', () => {
            // # Navigate to the application.
            cy.visit('/ad-1/');

            // # Ensure the channel is loaded before continuing (allows redux to sync).
            cy.get('#centerChannelFooter').findByTestId('post_textbox').should('exist');

            // # Select a channel without a playbook run.
            cy.get('#sidebarItem_off-topic').click({force: true});

            // # Run the playbook after loading the application
            const now = Date.now();
            const playbookRunName = 'Playbook Run (' + now + ')';
            const playbookRunChannelName = 'playbook-run-' + now;
            cy.apiRunPlaybook({
                teamId,
                playbookId,
                playbookRunName,
                ownerUserId: userId,
            }).then((playbookRun) => {
                // # End the playbook run
                cy.apiUpdateStatus({
                    playbookRunId: playbookRun.id,
                    userId,
                    teamId,
                    message: 'ending',
                    description: 'description',
                    status: 'Archived',
                });
            });

            // # Open the playbook run channel from the LHS.
            cy.get(`#sidebarItem_${playbookRunChannelName}`).click({force: true});

            // * Verify the playbook run RHS is open.
            cy.get('#rhsContainer').should('exist').within(() => {
                cy.findByText(playbookRunName).should('exist');
            });
        });

        it('for an existing, ongoing playbook run channel opened from the lhs', () => {
            // # Run the playbook before loading the application
            const now = Date.now();
            const playbookRunName = 'Playbook Run (' + now + ')';
            const playbookRunChannelName = 'playbook-run-' + now;
            cy.apiRunPlaybook({
                teamId,
                playbookId,
                playbookRunName,
                ownerUserId: userId,
            });

            // # Navigate to a channel without a playbook run.
            cy.visit('/ad-1/channels/off-topic');

            // # Ensure the channel is loaded before continuing (allows redux to sync).
            cy.get('#centerChannelFooter').findByTestId('post_textbox').should('exist');

            // # Open the playbook run channel from the LHS.
            cy.get(`#sidebarItem_${playbookRunChannelName}`).click({force: true});

            // * Verify the playbook run RHS is open.
            cy.get('#rhsContainer').should('exist').within(() => {
                cy.findByText(playbookRunName).should('exist');
            });
        });

        it('for an existing, resolved playbook run channel opened from the lhs', () => {
            // # Run the playbook before loading the application
            const now = Date.now();
            const playbookRunName = 'Playbook Run (' + now + ')';
            const playbookRunChannelName = 'playbook-run-' + now;

            cy.apiRunPlaybook({
                teamId,
                playbookId,
                playbookRunName,
                ownerUserId: userId,
            }).then((playbookRun) => {
                // # End the playbook run
                cy.apiUpdateStatus({
                    playbookRunId: playbookRun.id,
                    userId,
                    teamId,
                    message: 'resolving',
                    description: 'description',
                    status: 'Resolved',
                });
            });

            // # Navigate to a channel without a playbook run.
            cy.visit('/ad-1/channels/off-topic');

            // # Ensure the channel is loaded before continuing (allows redux to sync).
            cy.get('#centerChannelFooter').findByTestId('post_textbox').should('exist');

            // # Open the playbook run channel from the LHS.
            cy.get(`#sidebarItem_${playbookRunChannelName}`).click({force: true});

            // * Verify the playbook run RHS is open.
            cy.get('#rhsContainer').should('exist').within(() => {
                cy.findByText(playbookRunName).should('exist');
            });
        });

        it('for an existing, archived playbook run channel opened from the lhs', () => {
            // # Run the playbook before loading the application
            const now = Date.now();
            const playbookRunName = 'Playbook Run (' + now + ')';
            const playbookRunChannelName = 'playbook-run-' + now;

            cy.apiRunPlaybook({
                teamId,
                playbookId,
                playbookRunName,
                ownerUserId: userId,
            }).then((playbookRun) => {
                // # End the playbook run
                cy.apiUpdateStatus({
                    playbookRunId: playbookRun.id,
                    userId,
                    teamId,
                    message: 'ending',
                    description: 'description',
                    status: 'Archived',
                });
            });

            // # Navigate to a channel without a playbook run.
            cy.visit('/ad-1/channels/off-topic');

            // # Ensure the channel is loaded before continuing (allows redux to sync).
            cy.get('#centerChannelFooter').findByTestId('post_textbox').should('exist');

            // # Open the playbook run channel from the LHS.
            cy.get(`#sidebarItem_${playbookRunChannelName}`).click({force: true});

            // * Verify the playbook run RHS is open.
            cy.get('#rhsContainer').should('exist').within(() => {
                cy.findByText(playbookRunName).should('exist');
            });
        });

        it('when starting a playbook run', () => {
            // # Navigate to the application and a channel without a playbook run
            cy.visit('/ad-1/channels/off-topic');

            // # Start a playbook run with a slash command
            const now = Date.now();
            const playbookRunName = 'Playbook Run (' + now + ')';

            // const playbookRunChannelName = 'playbook-run-' + now;
            cy.startPlaybookRunWithSlashCommand(playbookName, playbookRunName);

            // * Verify the playbook run RHS is open.
            cy.get('#rhsContainer').should('exist').within(() => {
                cy.findByText(playbookRunName).should('exist');
            });
        });
    });

    describe('is toggled', () => {
        it('by icon in channel header', () => {
            // # Size the viewport to show plugin icons even when RHS is open
            cy.viewport('macbook-13');

            // # Navigate to the application and a channel without a playbook run
            cy.visit('/ad-1/channels/off-topic');

            // # Click the icon
            cy.get('#channel-header').within(() => {
                cy.get('#incidentIcon').should('exist').click({force: true});
            });

            // * Verify the playbook run RHS is open.
            cy.get('#rhsContainer').should('exist').within(() => {
                cy.findByText('Runs in progress').should('exist');
            });

            // # Click the icon again
            cy.get('#channel-header').within(() => {
                cy.get('#incidentIcon').should('exist').click({force: true});
            });

            // * Verify the playbook run RHS is no longer open.
            cy.get('#rhsContainer').should('not.exist');
        });
    });
});
