// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

describe('backstage incident creation button', () => {
    let playbookName;
    let testTeam;

    before(() => {
        cy.apiInitSetup().then(({team, playbook}) => {
            testTeam = team;
            playbookName = playbook.name;
        });
    });

    beforeEach(() => {
        // // # Login as user-1
        // cy.apiLogin(testUser);
        cy.visit(`/${testTeam.name}/channels/town-square`);
        // cy.visit('/ad-1/com.mattermost.plugin-incident-management/incidents');
    });

    it('opens incident creation modal', () => {
        // # Go to the backstage
        cy.openBackstage();

        // # Go to the "Incidents" backstage
        cy.findByTestId('incidentsLHSButton').click();

        // Click the "New Incident" button
        cy.findByText('New Incident').click();

        // * Verify the incident creation modal opens
        cy.get('#interactiveDialogModal').should('exist');
    });
});