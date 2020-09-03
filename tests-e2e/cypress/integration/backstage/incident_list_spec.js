// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

describe('backstage incident list', () => {
    const playbookName = 'Playbook (' + Date.now() + ')';
    let teamId;
    let userId;
    let playbookId;

    before(() => {
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
        // # Login as user-1
        cy.apiLogin('user-1');

        // # Navigate to the application
        cy.visit('/');
    });

    it('has "Incidents" and team name in heading', () => {
        // # Open backstage
        cy.openBackstage();

        // # Switch to incidents backstage
        cy.findByTestId('incidentsLHSButton').click();

        // * Assert contents of heading.
        cy.findByTestId('titleIncident').should('be.visible').contains('Incidents');
        cy.findByTestId('titleIncident').contains('eligendi');
    });

    it('loads incident details page when clicking on an incident', () => {
        // # Start the incident
        const now = Date.now();
        const incidentName = 'Incident (' + now + ')';
        cy.apiStartIncident({
            teamId,
            playbookId,
            incidentName,
            commanderUserId: userId,
        });

        // # Open backstage
        cy.openBackstage();

        // # Switch to incidents backstage
        cy.findByTestId('incidentsLHSButton').click();

        // # Find the incident `incident_backstage_1` and click to open details view
        cy.get('#incidentList').within(() => {
            cy.findByText(incidentName).click();
        });

        // * Verify that the header contains the incident name
        cy.get('.details-header').contains(incidentName);
    });
});
