// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

describe('backstage playbook list', () => {
    let testTeam;
    let testUser;

    before(() => {
        cy.apiInitSetup().then(({team, user}) => {
            testTeam = team;
            testUser = user;
        });
    });

    beforeEach(() => {
        // # Login as test user
        cy.apiLogin(testUser);

        // # Navigate to the application
        cy.visit(`${testTeam.name}/`);
    });

    it('has "Playbooks" and team name in heading', () => {
        // # Open backstage
        cy.visit(`/${testTeam.name}/com.mattermost.plugin-incident-management`);

        // # Switch to Playbooks backstage
        cy.findByTestId('playbooksLHSButton').click();

        // * Assert contents of heading.
        cy.findByTestId('titlePlaybook').should('exist').contains('Playbooks');
        cy.findByTestId('titlePlaybook').contains(testTeam.display_name);
    });
});
