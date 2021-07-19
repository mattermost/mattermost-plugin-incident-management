// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

describe('playbook run rhs > welcome', () => {
    const playbookName = 'Playbook (' + Date.now() + ')';
    let teamId;
    let newTeamName;

    before(() => {
        // # Login as the sysadmin
        cy.apiLogin('sysadmin');

        // # Create a new team for the welcome page test
        cy.apiCreateTeam('team', 'Team').then(({team}) => {
            teamId = team.id;
            newTeamName = team.name;

            // # Add user-1 to team
            cy.apiGetUserByEmail('user-1@sample.mattermost.com').then(({user}) => {
                cy.apiAddUserToTeam(team.id, user.id);
            });

            // # Add user-2 to team
            cy.apiGetUserByEmail('user-2@sample.mattermost.com').then(({user}) => {
                cy.apiAddUserToTeam(team.id, user.id);
            });
        });

        // # Login as user-2
        cy.apiLogin('user-2');

        // # Create a playbook as user-2
        cy.apiGetCurrentUser().then((user) => {
            cy.apiCreateTestPlaybook({
                teamId,
                title: playbookName,
                userId: user.id,
            });

            // # Set all steps to true to turn off the welcome to mattermost tutorial messages
            const preference = {
                user_id: user.id,
                category: 'recommended_next_steps',
                value: 'true',
            };
            const adminSteps = [
                'complete_profile',
                'notification_setup',
                'team_setup',
                'invite_members',
                'enter_support_email',
                'hide',
                'skip',
            ];

            cy.apiSaveUserPreference(adminSteps.map((step) => ({...preference, name: step})));
        });
    });

    describe('prompts to create playbook when not a member of a playbook', () => {
        ['sysadmin', 'user-1'].forEach((username) => it(`as ${username}`, () => {
            // # Login as the user
            cy.apiLogin(username);

            // # Size the viewport to show plugin icons even when RHS is open
            cy.viewport('macbook-13');

            // # Navigate to the team with no playbook runs.
            cy.visit(`/${newTeamName}/channels/town-square`);

            // # Click the playbook run icon
            cy.get('#channel-header').within(() => {
                cy.get('#incidentIcon').should('exist').click();
            });

            // * Verify the playbook run RHS is open.
            cy.get('#rhsContainer').should('exist').within(() => {
                cy.findByText('Runs in progress').should('exist');
            });

            // # Wait for background request fetching playbooks to finish.
            cy.wait(1500);

            // * Verify there is no prompt to create a playbook run.
            cy.get('#rhsContainer').findByText('Run playbook').should('not.exist');

            // # Click the prompt to create a playbook.
            cy.get('#rhsContainer').findByText('Create playbook').click();

            // * Verify we reached the playbook backstage
            cy.url().should('include', `/${newTeamName}/com.mattermost.plugin-incident-management/playbooks`);
        }));
    });

    describe('prompts to run playbook when a member of a playbook', () => {
        it('as user-2', () => {
            // # Login as user-2
            cy.apiLogin('user-2');

            // # Size the viewport to show plugin icons even when RHS is open
            cy.viewport('macbook-13');

            // # Navigate to the team with no playbook runs.
            cy.visit(`/${newTeamName}/channels/town-square`);

            // # Click the playbook run icon
            cy.get('#channel-header').within(() => {
                cy.get('#incidentIcon').should('exist').click();
            });

            // * Verify the playbook run RHS is open.
            cy.get('#rhsContainer').should('exist').within(() => {
                cy.findByText('Runs in progress').should('exist');
            });

            // # Click the prompt to create a playbook run.
            cy.get('#rhsContainer').findByText('Run playbook').click({force: true});

            // * Verify the playbook run creation dialog has opened
            cy.get('#interactiveDialogModal').should('exist').within(() => {
                cy.findByText('Start run').should('exist');
            });

            // # Cancel the interactive dialog
            cy.get('#interactiveDialogCancel').click();

            // * Verify the modal is no longer displayed
            cy.get('#interactiveDialogModal').should('not.exist');

            // # Click the prompt to create a playbook.
            cy.get('#rhsContainer').findByText('Create playbook').click();

            // * Verify we reached the playbook backstage
            cy.url().should('include', `/${newTeamName}/com.mattermost.plugin-incident-management/playbooks`);
        });
    });
});
