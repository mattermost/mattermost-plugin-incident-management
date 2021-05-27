// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

describe('preferences', () => {
    let testTeam;
    let testUser;
    let playbookId;
    let publicChannel;
    let privateChannel1;
    let privateChannel2;

    before(() => {

        cy.apiInitSetup().then(({team, user, playbook}) => {
            testTeam = team;
            testUser = user;
            playbookId = playbook.id;

            // # Create a public channel
            cy.apiCreateChannel(team.id, 'public', 'Public', 'O'). then(({channel}) => {
                publicChannel = channel;
                cy.apiAddUserToChannel(publicChannel.id, testUser.id);
            });
            
            // # Create a private channel
            cy.apiCreateChannel(team.id, 'private-1', 'Private 1', 'P').then(({channel}) => {
                privateChannel1 = channel;
                cy.apiAddUserToChannel(privateChannel1.id, testUser.id);
            });

            cy.apiCreateChannel(team.id, 'private-2', 'Private 2', 'P').then(({channel}) => {
                privateChannel2 = channel;
                cy.apiAddUserToChannel(privateChannel2.id, testUser.id);
            });
        });
    });

    beforeEach(() => {
        // # Login as test user
        cy.apiLogin(testUser);

        // # Visit the town-square channel of the team
        cy.visit(`/${testTeam.name}/channels/town-square`);
    });

    it('shows "Select a channel" when no broadcast channel configured', () => {
        // # Visit the selected playbook
        cy.visit(`/${testTeam.name}/com.mattermost.plugin-incident-management/playbooks/` + playbookId);

        // # Switch to Preferences tab
        cy.get('#root').findByText('Preferences').click();

        // * Verify placeholder text is present
        cy.get('#playbook-preferences-broadcast-channel').should('have.text', 'Select a channel');
    });

    it('shows channel name when public broadcast channel configured', () => {
        // # Visit the selected playbook
        cy.visit(`/${testTeam.name}/com.mattermost.plugin-incident-management/playbooks/` + playbookId);

        // # Switch to Preferences tab
        cy.get('#root').findByText('Preferences').click();

        // # Open the broadcast channel widget and select a public channel
        cy.get('#playbook-preferences-broadcast-channel').click().type(`${publicChannel.display_name}{enter}`, {delay: 200});

        // # Save the playbook
        cy.findByTestId('save_playbook').click();

        // # Visit the selected playbook
        cy.visit(`/${testTeam.name}/com.mattermost.plugin-incident-management/playbooks/` + playbookId);

        // # Switch to Preferences tab
        cy.get('#root').findByText('Preferences').click();

        // * Verify placeholder text is present
        cy.get('#playbook-preferences-broadcast-channel').should('have.text', `${publicChannel.display_name}`);
    });

    it('shows channel name when private broadcast channel configured and user is a member', () => {
        // # Visit the selected playbook
        cy.visit(`/${testTeam.name}/com.mattermost.plugin-incident-management/playbooks/` + playbookId);

        // # Switch to Preferences tab
        cy.get('#root').findByText('Preferences').click();

        // # Open the broadcast channel widget and select a public channel
        cy.get('#playbook-preferences-broadcast-channel').click().type(`${privateChannel1.name}{enter}`, {delay: 200});

        // # Save the playbook
        cy.findByTestId('save_playbook').click();

        // # Visit the selected playbook
        cy.visit(`/${testTeam.name}/com.mattermost.plugin-incident-management/playbooks/` + playbookId);

        // # Switch to Preferences tab
        cy.get('#root').findByText('Preferences').click();

        // * Verify placeholder text is present
        cy.get('#playbook-preferences-broadcast-channel').should('have.text', `${privateChannel1.display_name}`);
    });

    it('shows "Unknown channel" when private broadcast channel configured and user is not a member', () => {
        // # Visit the selected playbook
        cy.visit(`/${testTeam.name}/com.mattermost.plugin-incident-management/playbooks/` + playbookId);

        // # Switch to Preferences tab
        cy.get('#root').findByText('Preferences').click();

        // # Open the broadcast channel widget and select the private channel
        cy.get('#playbook-preferences-broadcast-channel').click().type(`${privateChannel2.name}{enter}`, {delay: 200});

        // # Save the playbook
        cy.findByTestId('save_playbook').click();

        // # Browse to the private channel
        cy.visit(`/${testTeam.name}/channels/` + privateChannel2.name);

        // # Leave the private channel
        cy.executeSlashCommand('/leave');
        cy.get('#confirmModalButton').click();

        // # Visit the selected playbook
        cy.visit(`/${testTeam.name}/com.mattermost.plugin-incident-management/playbooks/` + playbookId);

        // # Switch to Preferences tab
        cy.get('#root').findByText('Preferences').click();

        // * Verify placeholder text is present
        cy.get('#playbook-preferences-broadcast-channel').should('have.text', 'Unknown Channel');
    });
});