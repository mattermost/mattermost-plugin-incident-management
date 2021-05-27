// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

describe('backstage', () => {
    let testTeam;
    let testUser;
    
    before(() => {
        cy.apiInitSetup().then(({team, user}) => {
            testTeam = team;
            testUser = user;
        });
    });

    beforeEach(() => {
        cy.apiLogin(testUser);
        cy.visit(`/${testTeam.name}`);
    });

    // it('opens statistics view by default', () => {
    //     // # Open the backstage
    //     cy.visit('/ad-1/com.mattermost.plugin-incident-management/stats');

    //     // * Verify that when backstage loads, the heading is visible and contains "Statistics"
    //     cy.findByTestId('titleStats').should('exist').contains('Statistics');
    // });

    it('switches to playbooks list view via header button', () => {
        // # Open backstage
        cy.visit(`/${testTeam.name}/com.mattermost.plugin-incident-management`);

        // # Switch to playbooks backstage
        cy.findByTestId('playbooksLHSButton').click();

        // * Verify that playbooks are shown
        cy.findByTestId('titlePlaybook').should('exist').contains('Playbooks');
    });

    it('switches to incidents list view via header button', () => {
        // # Open backstage
        cy.visit(`/${testTeam.name}/com.mattermost.plugin-incident-management`);

        // # Switch to playbooks backstage
        cy.findByTestId('playbooksLHSButton').click();

        // # Switch to incidents backstage
        cy.findByTestId('incidentsLHSButton').click();

        // * Verify that incidents are shown
        cy.findByText('What are Incidents?').should('exist').contains('Incidents');
    });
});
