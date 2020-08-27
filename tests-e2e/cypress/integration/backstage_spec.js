// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

/*
 * This test spec includes tests for the Playbooks & Incidents backstage
 */

describe('Backstage', () => {
    const dummyPlaybookName = 'Dummy playbook' + Date.now();

    beforeEach(() => {
        // # Login as non-admin user
        cy.apiLogin('user-1');
        cy.visit('/');

        // # Create a dummy playbook as non-admin user
        cy.apiGetTeamByName('ad-1').then((team) => {
            cy.apiGetCurrentUser().then((user) => {
                cy.apiCreateTestPlaybook({
                    teamId: team.id,
                    title: dummyPlaybookName,
                    userId: user.id,
                });
            });
        });

        cy.openIncidentBackstage();
    });

    it('Opens playbook backstage by default with "Playbooks & Incidents" button in main menu', () => {
        // * Verify that when backstage loads, the heading is visible and contains "Incident"
        cy.findByTestId('titlePlaybook').should('be.visible').contains('Playbooks');
    });

    it('Opens playbooks backstage with "Playbooks" LHS button', () => {
        // # Switch to playbooks backstage
        cy.findByTestId('playbooksLHSButton').click();

        // * Verify that the heading is visible and contains "Playbooks"
        cy.findByTestId('titlePlaybook').should('be.visible').contains('Playbooks');
    });

    it('Opens incidents backstage with "Incidents" LHS button', () => {
        // # Switch to incidents backstage
        cy.findByTestId('incidentsLHSButton').click();

        // * Verify again that the switch was successful by verifying the heading is visible and has "Incidents"
        cy.findByTestId('titleIncident').should('be.visible').contains('Incidents');
    });
});
