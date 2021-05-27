// // Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// // See LICENSE.txt for license information.

// // ***************************************************************
// // - [#] indicates a test step (e.g. # Go to a page)
// // - [*] indicates an assertion (e.g. * Check the title)
// // ***************************************************************

// const BACKSTAGE_LIST_PER_PAGE = 15;

// describe('resets pagination when filtering', () => {
//     const incidentTimestamps = [];

//     before(() => {
//         // # Login as user-1
//         cy.apiLogin('user-1');

//         // # Start sufficient incidents to ensure pagination is possible.
//         for (let i = 0; i < BACKSTAGE_LIST_PER_PAGE + 1; i++) {
//             const now = Date.now();
//             cy.apiStartIncident({
//                 teamId,
//                 playbookId,
//                 incidentName: 'Incident (' + now + ')',
//                 commanderUserId: userId,
//             });
//             incidentTimestamps.push(now);
//         }
//     });

//     beforeEach(() => {
//         // # Login as user-1
//         cy.apiLogin('user-1');

//         // # Navigate to the application
//         cy.visit('/ad-1');

//         // # Open backstage
//         cy.openBackstage();

//         // # Switch to incidents backstage
//         cy.findByTestId('incidentsLHSButton').click();

//         // # Switch to page 2
//         cy.findByText('Next').click();

//         // * Verify "Previous" now shown
//         cy.findByText('Previous').should('exist');
//     });

//     it('by incident name', () => {
//         // # Search for an incident by name
//         cy.get('#incidentList input').type(incidentTimestamps[0]);

//         // # Wait for the incident list to update.
//         cy.wait(TINY);

//         // * Verify "Previous" no longer shown
//         cy.findByText('Previous').should('not.exist');
//     });

//     it('by commander', () => {
//         cy.get('.profile-dropdown')
//             .click()
//             .find('.IncidentProfile').first().parent().click({force: true});

//         // # Wait for the incident list to update.
//         cy.wait(TINY);

//         // * Verify "Previous" no longer shown
//         cy.findByText('Previous').should('not.exist');
//     });
// });
