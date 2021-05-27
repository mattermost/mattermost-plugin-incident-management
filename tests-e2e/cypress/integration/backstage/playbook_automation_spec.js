// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

describe('invite members setting', () => {
    let testTeam;
    let testUser1;
    let playbookId;
    let testUser2;
    let testUser3;
    let testUser4;

    before(() => {
        cy.apiInitSetup().then(({team, user, playbook}) => {
            testTeam = team;
            testUser1 = user;
            playbookId = playbook.id;

            cy.apiCreateUser({prefix: 'other'}).then(({user: user2}) => {
                testUser2 = user2;
                cy.apiAddUserToTeam(team.id, user2.id);
            });

            cy.apiCreateUser().then(({user: user3}) => {
                testUser3 = user3;
                cy.apiAddUserToTeam(team.id, user3.id);
            });

            cy.apiCreateUser().then(({user: user4}) => {
                testUser4 = user4;
                cy.apiAddUserToTeam(team.id, user4.id);
            });
        });
    });

    beforeEach(() => {
        // # Login as test user
        cy.apiLogin(testUser1);

        // # Visit the town-square channel of the team
        cy.visit(`/${testTeam.name}/channels/town-square`);
    });

    it('is disabled in a new playbook', () => {
        // # Visit the selected playbook
        cy.visit(`/${testTeam.name}/com.mattermost.plugin-incident-management/playbooks/` + playbookId);

        // # Switch to Automation tab
        cy.get('#root').findByText('Automation').click();

        // * Verify that the toggle is unchecked
        cy.get('#invite-users label input').should('not.be.checked');
    });

    it('can be enabled', () => {
        // # Visit the selected playbook
        cy.visit(`/${testTeam.name}/com.mattermost.plugin-incident-management/playbooks/` + playbookId);

        // # Switch to Automation tab
        cy.get('#root').findByText('Automation').click();

        cy.get('#invite-users').within(() => {
            // * Verify that the toggle is unchecked
            cy.get('label input').should('not.be.checked');

            // # Click on the toggle to enable the setting
            cy.get('label input').click({force: true});

            // * Verify that the toggle is unchecked
            cy.get('label input').should('be.checked');
        });
    });

    it('does not let add users when disabled', () => {
        // # Visit the selected playbook
        cy.visit(`/${testTeam.name}/com.mattermost.plugin-incident-management/playbooks/` + playbookId);

        // # Switch to Automation tab
        cy.get('#root').findByText('Automation').click();

        // * Verify that the toggle is unchecked
        cy.get('#invite-users label input').should('not.be.checked');

        // * Verify that the menu is disabled
        cy.getStyledComponent('StyledReactSelect').should('have.class', 'invite-users-selector--is-disabled');
    });

    it('allows adding users when enabled', () => {
        // # Visit the selected playbook
        cy.visit(`/${testTeam.name}/com.mattermost.plugin-incident-management/playbooks/` + playbookId);

        // # Switch to Automation tab
        cy.get('#root').findByText('Automation').click();

        cy.get('#invite-users').within(() => {
            // * Verify that the toggle is unchecked
            cy.get('label input').should('not.be.checked');

            // # Click on the toggle to enable the setting
            cy.get('label input').click({force: true});

            // * Verify that the toggle is checked
            cy.get('label input').should('be.checked');

            // # Open the invited users selector
            cy.openSelector();

            // # Add one user
            cy.addInvitedUser(`${testUser2.username}`);

            // * Verify that the badge in the selector shows the correct number of members
            cy.get('.invite-users-selector__control')
                .after('content')
                .should('eq', '1 MEMBER');

            // * Verify that the user shows in the group of invited members
            cy.findByText('INVITED MEMBERS').parent().within(() => {
                cy.findByText(`${testUser2.username}`);
            });
        });
    });

    it('allows adding new users to an already populated list', () => {
        // # Visit the selected playbook
        cy.visit(`/${testTeam.name}/com.mattermost.plugin-incident-management/playbooks/` + playbookId);

        // # Switch to Automation tab
        cy.get('#root').findByText('Automation').click();

        cy.get('#invite-users').within(() => {
            // * Verify that the toggle is unchecked
            cy.get('label input').should('not.be.checked');

            // # Click on the toggle to enable the setting
            cy.get('label input').click({force: true});

            // * Verify that the toggle is checked
            cy.get('label input').should('be.checked');

            // # Open the invited users selector
            cy.openSelector();

            // # Add one user
            cy.addInvitedUser(`${testUser3.username}`);

            // * Verify that the user shows in the group of invited members
            cy.findByText('INVITED MEMBERS').parent().within(() => {
                cy.findByText(`${testUser3.username}`);
            });

            // # Add a new user
            cy.addInvitedUser(`${testUser4.username}`);

            // * Verify that the badge in the selector shows the correct number of members
            cy.get('.invite-users-selector__control')
                .after('content')
                .should('eq', '2 MEMBERS');

            // * Verify that the user shows in the group of invited members
            cy.findByText('INVITED MEMBERS').parent().within(() => {
                cy.findByText(`${testUser3.username}`);
                cy.findByText(`${testUser4.username}`);
            });
        });
    });

    it('allows removing users', () => {
        // # Visit the selected playbook
        cy.visit(`/${testTeam.name}/com.mattermost.plugin-incident-management/playbooks/` + playbookId);

        // # Switch to Automation tab
        cy.get('#root').findByText('Automation').click();

        cy.get('#invite-users').within(() => {
            // * Verify that the toggle is unchecked
            cy.get('label input').should('not.be.checked');

            // # Click on the toggle to enable the setting
            cy.get('label input').click({force: true});

            // * Verify that the toggle is checked
            cy.get('label input').should('be.checked');

            // # Open the invited users selector
            cy.openSelector();

            // # Add a couple of users
            cy.addInvitedUser(`${testUser3.username}`);
            cy.addInvitedUser(`${testUser4.username}`);

            // * Verify that the badge in the selector shows the correct number of members
            cy.get('.invite-users-selector__control')
                .after('content')
                .should('eq', '2 MEMBERS');

            // # Remove the first users added
            cy.get('.invite-users-selector__option').eq(0).within(() => {
                cy.findByText('Remove').click();
            });

            // * Verify that there is only one user, the one not removed
            cy.get('.invite-users-selector__control')
                .after('content')
                .should('eq', '1 MEMBER');

            cy.findByText('INVITED MEMBERS').parent().within(() => {
                cy.get('.invite-users-selector__option')
                    .should('have.length', 1)
                    .contains(`${testUser4.username}`);
            });
        });
    });

    it('persists the list of users even if the toggle is off', () => {
        // # Visit the selected playbook
        cy.visit(`/${testTeam.name}/com.mattermost.plugin-incident-management/playbooks/` + playbookId);

        // # Switch to Automation tab
        cy.get('#root').findByText('Automation').click();

        cy.get('#invite-users').within(() => {
            // * Verify that the toggle is unchecked
            cy.get('label input').should('not.be.checked');

            // # Click on the toggle to enable the setting
            cy.get('label input').click({force: true});

            // * Verify that the toggle is checked
            cy.get('label input').should('be.checked');

            // # Open the invited users selector
            cy.openSelector();

            // # Add a couple of users
            cy.addInvitedUser(`${testUser3.username}`);
            cy.addInvitedUser(`${testUser4.username}`);

            // * Verify that the badge in the selector shows the correct number of members
            cy.get('.invite-users-selector__control')
                .after('content')
                .should('eq', '2 MEMBERS');

            // # Click on the toggle to disable the setting
            cy.get('label input').click({force: true});

            // * Verify that the toggle is unchecked
            cy.get('label input').should('not.be.checked');
        });

        // # Save the playbook
        cy.findByTestId('save_playbook').click();

        // # Navigate again to the playbook
        cy.visit(`/${testTeam.name}/com.mattermost.plugin-incident-management/playbooks/` + playbookId);

        // # Switch to Automation tab
        cy.get('#root').findByText('Automation').click();

        cy.get('#invite-users').within(() => {
            // * Verify that the toggle is unchecked
            cy.get('label input').should('not.be.checked');

            // # Click on the toggle to enable the setting
            cy.get('label input').click({force: true});

            // * Verify that the toggle is checked
            cy.get('label input').should('be.checked');

            // * Verify that the badge in the selector shows the correct number of members
            cy.get('.invite-users-selector__control')
                .after('content')
                .should('eq', '2 MEMBERS');

            // # Open the invited users selector
            cy.openSelector();

            // * Verify that the user shows in the group of invited members
            cy.findByText('INVITED MEMBERS').parent().within(() => {
                cy.findByText(`${testUser3.username}`);
                cy.findByText(`${testUser4.username}`);
            });
        });
    });

    it('removes invitation from users that are no longer in the team', () => {
        let userToRemove;

        // # Create a playbook with a user that is later removed from the team
        cy.apiAdminLogin().then(() => {
            // # We need to increase the maximum number of users per team; otherwise,
            // adding a new member to the team fails in CI
            cy.apiUpdateConfig({
                TeamSettings: {
                    MaxUsersPerTeam: 1000,
                },
            });
            cy.apiRemoveUserFromTeam(testTeam.id, testUser3.id);
            cy.apiRemoveUserFromTeam(testTeam.id, testUser4.id);
        }).then(() => {
            cy.apiLogin(testUser1);

            // # Navigate again to the playbook
            cy.visit(`/${testTeam.name}/com.mattermost.plugin-incident-management/playbooks/` + playbookId);

            // # Switch to Automation tab
            cy.get('#root').findByText('Automation').click();

            // # Save the playbook
            cy.findByTestId('save_playbook').click();

            // * Make sure the playbook is correctly saved
            cy.url().should('not.include', playbookId);

            // # Navigate again to the playbook
            cy.visit(`/${testTeam.name}/com.mattermost.plugin-incident-management/playbooks/` + playbookId);

            // # Switch to Automation tab
            cy.get('#root').findByText('Automation').click();

            // # Open the invited users selector
            cy.get('#invite-users').within(() => {
                cy.openSelector();
            });

            // * Verify that there are no invited members
            cy.findByText('INVITED MEMBERS').should('not.exist');
        });
    });
});

function createTestUsers(testUser, returnedUser, teamId) {
    testUser = returnedUser;
    cy.apiAddUserToTeam(teamId, testUser.id);
}
