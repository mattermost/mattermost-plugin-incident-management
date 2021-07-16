// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

const BACKSTAGE_LIST_PER_PAGE = 15;

import {HALF_SEC} from '../../fixtures/timeouts';

describe('backstage playbook run list', () => {
    const playbookName = 'Playbook (' + Date.now() + ')';
    let teamId;
    let newTeam;
    let newTeamWithNoActivePlaybookRuns;
    let userId;
    let playbookId;

    before(() => {
        // # Login as the sysadmin
        cy.apiLogin('sysadmin');

        // # Create a new team for the welcome page test
        cy.apiCreateTeam('team', 'Team').then(({team}) => {
            newTeam = team;

            // # Add user-1 to team
            cy.apiGetUserByEmail('user-1@sample.mattermost.com').then(({user}) => {
                cy.apiAddUserToTeam(team.id, user.id);
            });
        });

        // # Create a new team for the welcome page test when filtering
        cy.apiCreateTeam('team', 'Team With No Active Playbook Runs').then(({team}) => {
            newTeamWithNoActivePlaybookRuns = team;

            // # Add user-1 to team
            cy.apiGetUserByEmail('user-1@sample.mattermost.com').then(({user}) => {
                cy.apiAddUserToTeam(team.id, user.id);
            });

            // # Create a playbook
            cy.apiGetCurrentUser().then((user) => {
                cy.apiCreateTestPlaybook({
                    teamId: team.id,
                    title: playbookName,
                    userId: user.id,
                });
            });
        });

        // # Login as user-1
        cy.apiLogin('user-1');

        // # Create a playbook
        cy.apiGetTeamByName('ad-1').then((team) => {
            teamId = team.id;
            cy.apiGetCurrentUser().then((user) => {
                userId = user.id;

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
        // # Size the viewport to show all of the backstage.
        cy.viewport('macbook-13');

        // # Login as user-1
        cy.apiLogin('user-1');
    });

    it('shows welcome page when no playbook runs', () => {
        // # Open backstage
        cy.visit(`/${newTeam.name}/com.mattermost.plugin-incident-management`);

        // # Switch to playbook runs backstage
        cy.findByTestId('playbookRunsLHSButton').click();

        // * Assert welcome page title text.
        cy.get('#root').findByText('What are playbook runs?').should('be.visible');
    });

    it('shows welcome page when no playbook runs, even when filtering', () => {
        // # Navigate to a filtered playbook run list on a team with no playbook runs.
        cy.visit(`/${newTeam.name}/com.mattermost.plugin-incident-management/runs?status=Active`);

        // * Assert welcome page title text.
        cy.get('#root').findByText('What are playbook runs?').should('be.visible');
    });

    it('does not show welcome page when filtering yields no playbook runs', () => {
        // # Run the playbook
        const now = Date.now();
        const playbookRunName = 'Playbook Run (' + now + ')';
        cy.apiRunPlaybook({
            teamId: newTeamWithNoActivePlaybookRuns.id,
            playbookId,
            playbookRunName,
            ownerUserId: userId,
        });

        // # Navigate to a filtered playbook run list on a team with no active playbook runs.
        cy.visit(`/${newTeamWithNoActivePlaybookRuns.name}/com.mattermost.plugin-incident-management/runs?status=Active`);

        // * Assert welcome page is not visible.
        cy.get('#root').findByText('What are playbook runs?').should('not.exist');

        // * Assert playbook run listing is visible.
        cy.findByTestId('titlePlaybookRun').should('exist').contains('Runs');
        cy.findByTestId('titlePlaybookRun').contains(newTeamWithNoActivePlaybookRuns.display_name);
    });

    it('New playbook run works when the backstage is the first page loaded', () => {
        // # Navigate to the playbook runs backstage of a team with no playbook runs.
        cy.visit(`/${newTeam.name}/com.mattermost.plugin-incident-management/runs`);

        // # Make sure that the Redux store is empty
        cy.reload();

        // # Click on button to run a playbook.
        cy.findByText('Run playbook').click();

        // * Verify that we are in the centre channel view, out of the backstage
        cy.url().should('include', `/${newTeam.name}/channels`);

        // * Verify that the interactive dialog modal to create a playbook run is visible
        cy.get('#interactiveDialogModal').should('exist');
    });

    it('has "Runs" and team name in heading', () => {
        // # Run the playbook
        const now = Date.now();
        const playbookRunName = 'Playbook Run (' + now + ')';
        cy.apiRunPlaybook({
            teamId,
            playbookId,
            playbookRunName,
            ownerUserId: userId,
        });

        // # Open backstage
        cy.visit('/ad-1/com.mattermost.plugin-incident-management');

        // # Switch to playbook runs backstage
        cy.findByTestId('playbookRunsLHSButton').click();

        // * Assert contents of heading.
        cy.findByTestId('titlePlaybookRun').should('exist').contains('Runs');
        cy.findByTestId('titlePlaybookRun').contains('eligendi');
    });

    it('loads playbook run details page when clicking on a playbook run', () => {
        // # Run the playbook
        const now = Date.now();
        const playbookRunName = 'Playbook Run (' + now + ')';
        cy.apiRunPlaybook({
            teamId,
            playbookId,
            playbookRunName,
            ownerUserId: userId,
        });

        // # Open backstage
        cy.visit('/ad-1/com.mattermost.plugin-incident-management');

        // # Switch to playbook runs backstage
        cy.findByTestId('playbookRunsLHSButton').click();

        // # Find the playbook run and click to open details view
        cy.get('#playbookRunList').within(() => {
            cy.findByText(playbookRunName).click();
        });

        // * Verify that the header contains the playbook run name
        cy.findByTestId('playbook-run-title').contains(playbookRunName);
    });

    describe('resets pagination when filtering', () => {
        const playbookRunTimestamps = [];

        before(() => {
            // # Login as user-1
            cy.apiLogin('user-1');

            // # Start sufficient playbook runs to ensure pagination is possible.
            for (let i = 0; i < BACKSTAGE_LIST_PER_PAGE + 1; i++) {
                const now = Date.now();
                cy.apiRunPlaybook({
                    teamId,
                    playbookId,
                    playbookRunName: 'Playbook Run (' + now + ')',
                    ownerUserId: userId,
                });
                playbookRunTimestamps.push(now);
            }
        });

        beforeEach(() => {
            // # Login as user-1
            cy.apiLogin('user-1');

            // # Open backstage
            cy.visit('/ad-1/com.mattermost.plugin-incident-management');

            // # Switch to playbook runs backstage
            cy.findByTestId('playbookRunsLHSButton').click();

            // # Switch to page 2
            cy.findByText('Next').click();

            // * Verify "Previous" now shown
            cy.findByText('Previous').should('exist');
        });

        it('by playbook run name', () => {
            // # Search for a playbook run by name
            cy.get('#playbookRunList input').type(playbookRunTimestamps[0]);

            // # Wait for the playbook run list to update.
            cy.wait(HALF_SEC);

            // * Verify "Previous" no longer shown
            cy.findByText('Previous').should('not.exist');
        });

        it('by owner', () => {
            // # Expose the owner list
            cy.findByTestId('owner-filter').click();

            // # Find the list and chose the first owner in the list
            cy.get('.playbook-run-user-select__container')
                .find('.PlaybookRunProfile').first().parent().click({force: true});

            // # Wait for the playbook run list to update.
            cy.wait(HALF_SEC);

            // * Verify "Previous" no longer shown
            cy.findByText('Previous').should('not.exist');
        });
    });
});
