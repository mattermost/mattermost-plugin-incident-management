// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

describe('tasks', () => {
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
    
    describe('slash command', () => {
        it('autocompletes after clicking Add a Slash Command', () => {
            // # Visit the playbook backstage
            cy.visit(`/${testTeam.name}/com.mattermost.plugin-incident-management/playbooks`);

            // # Start a blank playbook
            cy.get('#root').findByText('Blank Playbook').click();

            // # Add a slash command to a step
            cy.get('#root').findByText('Add a Slash Command').click();

            // * Verify the slash command input field now has focus
            cy.get('#root').findByPlaceholderText('Slash Command').should('have.focus');

            // * Verify the slash command input field is pre-populated with a leading slash
            cy.get('#root').findByPlaceholderText('Slash Command').should('have.value', '/');

            // * Verify the autocomplete prompt is open
            cy.get('#suggestionList').should('exist');
        });

        it('removes the input prompt when blurring with an empty slash command', () => {
            // # Visit the playbook backstage
            cy.visit(`/${testTeam.name}/com.mattermost.plugin-incident-management/playbooks`);

            // # Start a blank playbook
            cy.get('#root').findByText('Blank Playbook').click();

            // # Add a slash command to a step
            cy.get('#root').findByText('Add a Slash Command').click();

            // * Verify only the leading slash is in the input field.
            cy.get('#root').findByPlaceholderText('Slash Command').should('have.value', '/');

            // # Backspace even the slash in the input.
            cy.get('#root').findByPlaceholderText('Slash Command').type('{backspace}');

            // # Blur the slash command input field
            cy.get('#root').findByPlaceholderText('Slash Command').blur();

            // # Verify the Add a Slash Command button returns
            cy.get('#root').findByText('Add a Slash Command').should('exist');
        });

        it('removes the input prompt when blurring with an invalid slash command', () => {
            // # Visit the playbook backstage
            cy.visit(`/${testTeam.name}/com.mattermost.plugin-incident-management/playbooks`);

            // # Start a blank playbook
            cy.get('#root').findByText('Blank Playbook').click();

            // # Add a slash command to a step
            cy.get('#root').findByText('Add a Slash Command').click();

            // * Verify only the leading slash is in the input field.
            cy.get('#root').findByPlaceholderText('Slash Command').should('have.value', '/');

            // # Blur the slash command without having typed anything more
            cy.get('#root').findByPlaceholderText('Slash Command').blur();

            // * Verify the Add a Slash Command button returns
            cy.get('#root').findByText('Add a Slash Command').should('exist');
        });
    });
});