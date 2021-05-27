// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

describe('backstage incident details', () => {
    let testTeam;
    let testUser;
    
    before(() => {
        // # Create test team and test user
        cy.apiInitSetup().then(({team, user}) => {
            testTeam = team;
            testUser = user;

            // # Login as test user
            cy.apiLogin(testUser);
        });
    });

    it('redirects to not found error if the incident is unknown', () => {
        // # Visit the URL of a non-existing incident
        cy.visit(`/${testTeam.name}/com.mattermost.plugin-incident-management/incidents/an_unknown_id`);

        // * Verify that the user has been redirected to the incidents not found error page
        cy.url().should('include', `/${testTeam.name}/com.mattermost.plugin-incident-management/error?type=incidents`);
    });
});
