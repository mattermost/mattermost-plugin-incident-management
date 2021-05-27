// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

describe('incident rhs > footer', () => {
    const playbookName = 'Playbook (' + Date.now() + ')';
    let testTeam;
    let teamId;
    let testUser;
    let testIncident;

    before(() => {
        cy.apiInitSetup({createIncident: true}).then(({team, user, incident}) => {
            testTeam = team;
            teamId = team.id;
            testUser = user;
            testIncident = incident;
        });
    });

    beforeEach(() => {
        // # Size the viewport to show the RHS without covering posts.
        cy.viewport('macbook-13');

        // # Navigate directly to the application and the incident channel
        cy.visit(`/${testTeam.name}/channels/` + testIncident.name);

        // # Select the tasks tab
        cy.findByTestId('tasks').click();
        });

    it('should have RHS footer buttons', () => {

        // * Verify that the button contains Update Status
        cy.get('#incidentRHSFooter').within(() => {
            cy.findByText('Overview').should('be.visible');
            cy.findByText('Update Status').should('be.visible');
        });

        // // # Click on the End Incident button
        // cy.get('#incidentRHSFooter button').click({multiple: true});

        // // * Verify that the interactive dialog is visible
        // cy.get('#interactiveDialogModalLabel').contains('Confirm End Incident');
    });
});
