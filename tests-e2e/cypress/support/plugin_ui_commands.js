// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as TIMEOUTS from '../fixtures/timeouts';

const incidentStartCommand = '/incident start';

// function startIncident(incidentName) {
Cypress.Commands.add('startIncident', (playbookName, incidentName) => {
    cy.get('#interactiveDialogModal').should('exist').within(() => {
        // # Select playbook
        cy.selectPlaybookFromDropdown(playbookName);

        // # Type incident name
        cy.findByTestId('incidentNameinput').type(incidentName, {force: true});

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

// Opens incident dialog using the `/incident start` slash command
Cypress.Commands.add('openIncidentDialogFromSlashCommand', () => {
    cy.executeSlashCommand(incidentStartCommand);
});

// Starts incident with the `/incident start` slash command
// function startIncidentWithSlashCommand(incidentName) {
Cypress.Commands.add('startIncidentWithSlashCommand', (playbookName, incidentName) => {
    cy.openIncidentDialogFromSlashCommand();

    cy.startIncident(playbookName, incidentName);
});

// Starts incident from the incident RHS
// function startIncidentFromRHS(playbookName, incidentName) {
Cypress.Commands.add('startIncidentFromRHS', (playbookName, incidentName) => {
    cy.get('#channel-header').within(() => {
        // open flagged posts to ensure incident RHS is closed
        cy.get('#channelHeaderFlagButton').click();

        // open the incident RHS
        cy.get('#incidentIcon').click();
    });

    cy.get('#rhsContainer').should('exist').within(() => {
        cy.findByText('Start Incident').click();
    });

    cy.startIncident(playbookName, incidentName);
});

// Create a new task from the RHS
Cypress.Commands.add('addNewTaskFromPostMenu', (taskname) => {
    // Click add new task
    cy.findAllByText('Add new task').eq(0).click();

    // Type a name
    cy.findByTestId('nameinput').type(taskname);

    // Submit the dialog
    cy.findByText('Add Task').click();
});

// Starts incident from the post menu
// function startIncidentFromPostMenu(incidentName) {
Cypress.Commands.add('startIncidentFromPostMenu', (playbookName, incidentName) => {
    // post a message as user to avoid system message
    cy.findByTestId('post_textbox').clear().type('new message here{enter}');

    // post a second message because cypress has trouble finding latest post when there's only one message
    cy.findByTestId('post_textbox').clear().type('another new message here{enter}');
    cy.clickPostDotMenu();
    cy.findByTestId('incidentPostMenuIcon').click();
    cy.startIncident(playbookName, incidentName);
});

Cypress.Commands.add('openBackstage', () => {
    cy.get('#lhsHeader', {timeout: TIMEOUTS.GIGANTIC}).should('exist');
    // # Wait until the channel loads enough to show the post textbox.
    cy.get('#post-create').should('exist');
    cy.wait(2000);

    // # Click hamburger main menu
    cy.get('#sidebarHeaderDropdownButton').click();

    // * Dropdown menu should be visible
    cy.get('.dropdown-menu').should('exist').within(() => {
        // 'Incident Collaboration' button should be visible, then click
        cy.findByText('Incident Collaboration').should('exist').click();
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
        // cy.get('input').click().type(playbookName.toLowerCase());
        cy.log("PLAYBOOK NAME: ", playbookName)
        cy.get('input').click().type(playbookName);
        cy.get('#suggestionList').contains(playbookName).click({force: true});
    });
});

Cypress.Commands.add('createPost', (message) => {
    // post a message as user to avoid system message
    cy.findByTestId('post_textbox').clear().type(`${message}{enter}`);
});

Cypress.Commands.add('addPostToTimelineUsingPostMenu', (incidentName, summary, postId) => {
    cy.clickPostDotMenu(postId);
    cy.findByTestId('incidentAddToTimeline').click();

    cy.get('#interactiveDialogModal').should('exist').within(() => {
        // # Select incident
        cy.findByTestId('autoCompleteSelector').should('exist').within(() => {
            cy.get('input').click().type(incidentName);
            cy.get('#suggestionList').contains(incidentName).click({force: true});
        });

        // # Type incident name
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

Cypress.Commands.add('selectCommander', (userName) => {
    cy.get('.assign-commander-selector__menu').within(() => {
        cy.findByText(userName).click({force: true});
    });
});

Cypress.Commands.add('selectChannel', (channelName) => {
    cy.get('.channel-selector__menu').within(() => {
        cy.findByText(channelName).click({force: true});
    });
});
