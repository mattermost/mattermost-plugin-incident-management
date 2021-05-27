// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

import * as TIMEOUTS from '../../fixtures/timeouts';

describe('playbook creation button', () => {
    let testTeam;
    let testUser;
    let otherUser;
    before(() => {
        // # Create test team and test user
        cy.apiInitSetup().then(({team, user}) => {
            testTeam = team;
            testUser = user;

            cy.apiCreateUser({prefix: 'other'}).then(({user: newUser}) => {
                otherUser = newUser;
                cy.apiAddUserToTeam(team.id, newUser.id);
            });
        });
    });

    beforeEach(() => {
        // # Size the viewport to show playbooks without weird scrolling issues
        cy.viewport('macbook-13');

        // # Login as user-1
        cy.apiLogin(testUser);

        // # Navigate to the application
        // cy.visit('/');

        cy.visit(`/${testTeam.name}`);
    });

    it('opens playbook creation page with New Playbook button', () => {
        const url = 'com.mattermost.plugin-incident-management/playbooks/new';
        const playbookName = 'Untitled Playbook';

        // # Open backstage
        cy.visit(`/${testTeam.name}/com.mattermost.plugin-incident-management`);

        // # Switch to playbooks backstage
        cy.findByTestId('playbooksLHSButton').click();

        // # Click 'New Playbook' button
        cy.findByText('New Playbook').should('be.visible').click().wait(TIMEOUTS.TINY);

        // * Verify a new playbook creation page opened
        verifyPlaybookCreationPageOpened(url, playbookName);
    });

    it('opens playbook creation page with "Blank Playbook" template option', () => {
        const url = 'com.mattermost.plugin-incident-management/playbooks/new';
        const playbookName = 'Untitled Playbook';

        // # Open backstage
        cy.visit(`/${testTeam.name}/com.mattermost.plugin-incident-management`);

        // # Switch to playbooks backstage
        cy.findByTestId('playbooksLHSButton').click();

        // # Click 'Blank Playbook'
        cy.findByText('Blank Playbook').should('be.visible').click().wait(TIMEOUTS.TINY);

        // * Verify a new playbook creation page opened
        verifyPlaybookCreationPageOpened(url, playbookName);
    });

    it('opens Incident Collaboration Playbook page from its template option', () => {
        const url = 'playbooks/new?template_title=Incident%20Collaboration%20Playbook';
        const playbookName = 'Incident Collaboration Playbook';

        // # Open backstage
        cy.visit(`/${testTeam.name}/com.mattermost.plugin-incident-management`);

        // # Switch to playbooks backstage
        cy.findByTestId('playbooksLHSButton').click();

        // # Click 'Incident Collaboration Playbook'
        cy.findByText('Incident Collaboration Playbook')
            .should('be.visible')
            .click()
            .wait(TIMEOUTS.TINY);

        // * Verify a new 'Incident Response Playbook' creation page is opened
        verifyPlaybookCreationPageOpened(url, playbookName);
    });

    it('shows "Remove" beside members when > 1 member', () => {
        // # Open backstage
        cy.visit(`/${testTeam.name}/com.mattermost.plugin-incident-management`);

        // # Switch to playbooks backstage
        cy.findByTestId('playbooksLHSButton').click();

        // # Click 'New Playbook' button
        cy.findByText('New Playbook').should('be.visible').click().wait(TIMEOUTS.TINY);

        // # Click 'Permissions' tab
        cy.findByText('Permissions').should('be.visible').click().wait(TIMEOUTS.TINY);

        // # Click 'only selected users can access'
        cy.get('input[name="enabled"][value="enabled"]').should('be.visible').click().wait(TIMEOUTS.TINY);

        // * Verify that there is no Remove link when there is one member
        cy.findAllByTestId('user-line').should('have.length', 1);
        cy.findAllByTestId('user-line').eq(0).within(() => {
            cy.get('a').should('not.exist');
        });

        // # Add a new user
        cy.get('.profile-autocomplete__input > input')
            .type('anne stone', {force: true, delay: 100}).wait(100)
            .type('{enter}');

        // * Verify that there is a Remove link when there is more than one member
        cy.findAllByTestId('user-line').should('have.length', 2);
        cy.findAllByTestId('user-line').eq(0).within(() => {
            cy.get('a').contains('Remove').should('exist');
        });
        cy.findAllByTestId('user-line').eq(1).within(() => {
            cy.get('a').contains('Remove').should('exist');
        });
    });
});

function verifyPlaybookCreationPageOpened(url, playbookName) {
    // * Verify the page url contains 'com.mattermost.plugin-incident-management/playbooks/new'
    cy.url().should('include', url);

    // * Verify the playbook name matches the one provided
    cy.get('#playbook-name').scrollIntoView().should('be.visible').within(() => {
        cy.findByText(playbookName).should('be.visible');
    });

    // * Verify there is 'Save' button
    cy.findByTestId('save_playbook').should('be.visible');
}
