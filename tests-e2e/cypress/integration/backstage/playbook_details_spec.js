// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

describe('backstage playbook details', () => {
    let testTeam;
    let testUser;

    before(() => {
        cy.apiInitSetup().then(({team, user}) => {
            testTeam = team;
            testUser = user;
        });
    });
    beforeEach(() => {
        // # Login as user-1
        cy.apiLogin(testUser);
    });

    it('redirects to not found error if the playbook is unknown', () => {
        // # Visit the URL of a non-existing playbook
        cy.visit(`/${testTeam.name}/com.mattermost.plugin-incident-management/playbooks/an_unknown_id`);

        // * Verify that the user has been redirected to the playbooks not found error page
        cy.url().should('include', `/${testTeam.name}/com.mattermost.plugin-incident-management/error?type=playbooks`);
    });
});
