// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as TIMEOUTS from '../fixtures/timeouts';

const playbookRunStartCommand = '/playbook start';

// function startPlaybookRun(playbookRunName) {
Cypress.Commands.add('startPlaybookRun', (playbookName, playbookRunName) => {
    cy.get('#interactiveDialogModal').should('exist').within(() => {
        // # Select playbook
        cy.selectPlaybookFromDropdown(playbookName);

        // # Type playbook run name
        cy.findByTestId('playbookRunNameinput').type(playbookRunName, {force: true});

        // # Submit
        cy.get('#interactiveDialogSubmit').click();
    });

    cy.get('#interactiveDialogModal').should('not.exist');
});

// Runs the given slash command
Cypress.Commands.add('executeSlashCommand', (command) => {
    cy.findByTestId('post_textbox').clear().type(command);

    // Using esc to make sure we exit out of slash command autocomplete
    cy.findByTestId('post_textbox').type('{esc}{esc}{esc}{esc}', {delay: 200}).type('{enter}');
});

// Opens playbook run dialog using the `/playbook start` slash command
Cypress.Commands.add('openPlaybookRunDialogFromSlashCommand', () => {
    cy.executeSlashCommand(playbookRunStartCommand);
});

// Starts playbook run with the `/playbook start` slash command
// function startPlaybookRunWithSlashCommand(playbookRunName) {
Cypress.Commands.add('startPlaybookRunWithSlashCommand', (playbookName, playbookRunName) => {
    cy.openPlaybookRunDialogFromSlashCommand();

    cy.startPlaybookRun(playbookName, playbookRunName);
});

// Starts playbook run from the playbook run RHS
// function startPlaybookRunFromRHS(playbookName, playbookRunName) {
Cypress.Commands.add('startPlaybookRunFromRHS', (playbookName, playbookRunName) => {
    cy.get('#channel-header').within(() => {
        // open flagged posts to ensure playbook run RHS is closed
        cy.get('#channelHeaderFlagButton').click();

        // open the playbook run RHS
        cy.get('#incidentIcon').click();
    });

    cy.get('#rhsContainer').should('exist').within(() => {
        cy.findByText('Run playbook').click();
    });

    cy.startPlaybookRun(playbookName, playbookRunName);
});

// Create a new task from the RHS
Cypress.Commands.add('addNewTaskFromRHS', (taskname) => {
    // Hover over the header to reveal the add task
    cy.findByTestId('checklistHeader').trigger('mouseover').within(() => {
        cy.findByTestId('addNewTask').click();
    });

    // Type a name
    cy.findByTestId('nameinput').type(taskname);

    // Submit the dialog
    cy.findByText('Add task').click();
});

// Starts playbook run from the post menu
// function startPlaybookRunFromPostMenu(playbookRunName) {
Cypress.Commands.add('startPlaybookRunFromPostMenu', (playbookName, playbookRunName) => {
    // post a message as user to avoid system message
    cy.findByTestId('post_textbox').clear().type('new message here{enter}');

    // post a second message because cypress has trouble finding latest post when there's only one message
    cy.findByTestId('post_textbox').clear().type('another new message here{enter}');
    cy.clickPostDotMenu();
    cy.findByTestId('playbookRunPostMenuIcon').click();
    cy.startPlaybookRun(playbookName, playbookRunName);
});

Cypress.Commands.add('openBackstage', () => {
    cy.get('#lhsHeader', {timeout: TIMEOUTS.GIGANTIC}).should('exist').within(() => {
        // # Wait until the channel loads enough to show the post textbox.
        cy.get('#post-create').should('exist');
        cy.wait(2000);

        // # Click hamburger main menu
        cy.get('#sidebarHeaderDropdownButton').click();

        // * Dropdown menu should be visible
        cy.get('.dropdown-menu').should('exist').within(() => {
            // Click main menu option
            cy.findByText('Incident Collaboration').should('exist').click();
        });
    });
});

// Create playbook
Cypress.Commands.add('createPlaybook', (teamName, playbookName) => {
    cy.visit(`/${teamName}/com.mattermost.plugin-incident-management/playbooks/new`);

    cy.findByTestId('save_playbook', {timeout: TIMEOUTS.LARGE}).should('exist');

    // # Type playbook name
    cy.get('#playbook-name .editable-trigger').click();
    cy.get('#playbook-name .editable-input').type(playbookName);
    cy.get('#playbook-name .editable-input').type('{enter}');

    // # Save playbook
    cy.findByTestId('save_playbook', {timeout: TIMEOUTS.LARGE}).should('not.be.disabled').click();
    cy.wait(2000);
    cy.findByTestId('save_playbook', {timeout: TIMEOUTS.LARGE}).should('not.be.disabled').click();
});

// Select the playbook from the dropdown menu
Cypress.Commands.add('selectPlaybookFromDropdown', (playbookName) => {
    cy.findByTestId('autoCompleteSelector').should('exist').within(() => {
        cy.get('input').click().type(playbookName.toLowerCase());
        cy.get('#suggestionList').contains(playbookName).click({force: true});
    });
});

Cypress.Commands.add('createPost', (message) => {
    // post a message as user to avoid system message
    cy.findByTestId('post_textbox').clear().type(`${message}{enter}`);
});

Cypress.Commands.add('addPostToTimelineUsingPostMenu', (playbookRunName, summary, postId) => {
    cy.clickPostDotMenu(postId);
    cy.findByTestId('playbookRunAddToTimeline').click();

    cy.get('#interactiveDialogModal').should('exist').within(() => {
        // # Select playbook run
        cy.findByTestId('autoCompleteSelector').should('exist').within(() => {
            cy.get('input').click().type(playbookRunName);
            cy.get('#suggestionList').contains(playbookRunName).click({force: true});
        });

        // # Type playbook run name
        cy.findByTestId('summaryinput').clear().type(summary, {force: true});

        // # Submit
        cy.get('#interactiveDialogSubmit').click();
    });

    cy.get('#interactiveDialogModal').should('not.exist');
});

Cypress.Commands.add('openSelector', () => {
    cy.findByText('Search for member').click({force: true});
});

Cypress.Commands.add('openChannelSelector', () => {
    cy.findByText('Search for channel').click({force: true});
});

Cypress.Commands.add('addInvitedUser', (userName) => {
    cy.get('.invite-users-selector__menu').within(() => {
        cy.findByText(userName).click({force: true});
    });
});

Cypress.Commands.add('selectOwner', (userName) => {
    cy.get('.assign-owner-selector__menu').within(() => {
        cy.findByText(userName).click({force: true});
    });
});

Cypress.Commands.add('selectChannel', (channelName) => {
    cy.get('.channel-selector__menu').within(() => {
        cy.findByText(channelName).click({force: true});
    });
});
