// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

describe('incident automation', () => {
    let teamId;
    let userId;

    before(() => {
        // # Login as user-1
        cy.apiLogin('user-1');

        // # Get the current team and user
        cy.apiGetTeamByName('ad-1').then((team) => {
            teamId = team.id;
        }).then(() => {
            cy.apiGetCurrentUser().then((user) => {
                userId = user.id;
            });
        });
    });

    beforeEach(() => {
        // # Size the viewport to show the RHS without covering posts.
        cy.viewport('macbook-13');

        // # Login as user-1
        cy.apiLogin('user-1');

        // # Go to Town Square
        cy.visit('/ad-1/channels/town-square');
    });

    describe(('when an incident starts'), () => {
        describe('invite members setting', () => {
            it('with no invited users and setting disabled', () => {
                const playbookName = 'Playbook (' + Date.now() + ')';
                let playbookId;

                // # Create a playbook with the invite users disabled and no invited users
                cy.apiCreatePlaybook({
                    teamId,
                    title: playbookName,
                    createPublicIncident: true,
                    memberIDs: [userId],
                    invitedUserIds: [],
                    inviteUsersEnabled: false,
                }).then((playbook) => {
                    playbookId = playbook.id;
                });

                // # Create a new incident with that playbook
                const now = Date.now();
                const incidentName = `Incident (${now})`;
                const incidentChannelName = `incident-${now}`;
                cy.apiStartIncident({
                    teamId,
                    playbookId,
                    incidentName,
                    commanderUserId: userId,
                });

                // # Navigate to the incident channel
                cy.visit(`/ad-1/channels/${incidentChannelName}`);

                // * Verify that no users were invited
                cy.getFirstPostId().then((id) => {
                    cy.get(`#postMessageText_${id}`)
                        .contains('You were added to the channel by @incident.')
                        .should('not.contain', 'joined the channel');
                });
            });

            it('with invited users and setting enabled', () => {
                const playbookName = 'Playbook (' + Date.now() + ')';

                // # Create a playbook with a couple of invited users and the setting enabled, and an incident with it
                cy.apiGetUsers(['aaron.medina', 'alice.johnston']).then((res) => {
                    const userIds = res.body.map((user) => user.id);

                    return cy.apiCreatePlaybook({
                        teamId,
                        title: playbookName,
                        createPublicIncident: true,
                        memberIDs: [userId],
                        invitedUserIds: userIds,
                        inviteUsersEnabled: true,
                    });
                }).then((playbook) => {
                    // # Create a new incident with that playbook
                    const now = Date.now();
                    const incidentName = `Incident (${now})`;
                    const incidentChannelName = `incident-${now}`;

                    cy.apiStartIncident({
                        teamId,
                        playbookId: playbook.id,
                        incidentName,
                        commanderUserId: userId,
                    });

                    // # Navigate to the incident channel
                    cy.visit(`/ad-1/channels/${incidentChannelName}`);

                    // * Verify that the users were invited
                    cy.getFirstPostId().then((id) => {
                        cy.get(`#postMessageText_${id}`).within(() => {
                            cy.findByText('2 others').click();
                        });

                        cy.get(`#postMessageText_${id}`).contains('@aaron.medina');
                        cy.get(`#postMessageText_${id}`).contains('@alice.johnston');
                        cy.get(`#postMessageText_${id}`).contains('added to the channel by @incident.');
                    });
                });
            });

            it('with invited users and setting disabled', () => {
                const playbookName = 'Playbook (' + Date.now() + ')';

                // # Create a playbook with a couple of invited users and the setting enabled, and an incident with it
                cy.apiGetUsers(['aaron.medina', 'alice.johnston']).then((res) => {
                    const userIds = res.body.map((user) => user.id);

                    return cy.apiCreatePlaybook({
                        teamId,
                        title: playbookName,
                        createPublicIncident: true,
                        memberIDs: [userId],
                        invitedUserIds: userIds,
                        inviteUsersEnabled: false,
                    });
                }).then((playbook) => {
                    // # Create a new incident with that playbook
                    const now = Date.now();
                    const incidentName = `Incident (${now})`;
                    const incidentChannelName = `incident-${now}`;

                    cy.apiStartIncident({
                        teamId,
                        playbookId: playbook.id,
                        incidentName,
                        commanderUserId: userId,
                    });

                    // # Navigate to the incident channel
                    cy.visit(`/ad-1/channels/${incidentChannelName}`);

                    // * Verify that no users were invited
                    cy.getFirstPostId().then((id) => {
                        cy.get(`#postMessageText_${id}`)
                            .contains('You were added to the channel by @incident.')
                            .should('not.contain', 'joined the channel');
                    });
                });
            });

            it('with non-existent users', () => {
                let userToRemove;
                let playbook;

                // # Create a playbook with a user that is later removed from the team
                cy.apiLogin('sysadmin').then(() => {
                    // # We need to increase the maximum number of users per team; otherwise,
                    // adding a new member to the team fails in CI
                    cy.apiUpdateConfig({
                        TeamSettings: {
                            MaxUsersPerTeam: 1000,
                        },
                    });

                    cy.apiCreateUser().then((result) => {
                        userToRemove = result.user;
                        cy.apiAddUserToTeam(teamId, userToRemove.id);

                        const playbookName = 'Playbook (' + Date.now() + ')';

                        // # Create a playbook with the user that will be removed from the team.
                        cy.apiCreatePlaybook({
                            teamId,
                            title: playbookName,
                            createPublicIncident: true,
                            memberIDs: [userId],
                            invitedUserIds: [userToRemove.id],
                            inviteUsersEnabled: true,
                        }).then((res) => {
                            playbook = res;
                        });

                        // # Remove user from the team
                        cy.apiRemoveUserFromTeam(teamId, userToRemove.id);
                    });
                }).then(() => {
                    cy.apiLogin('user-1');

                    // # Create a new incident with the playbook.
                    const now = Date.now();
                    const incidentName = `Incident (${now})`;
                    const incidentChannelName = `incident-${now}`;

                    cy.apiStartIncident({
                        teamId,
                        playbookId: playbook.id,
                        incidentName,
                        commanderUserId: userId,
                    });

                    // # Navigate to the incident channel
                    cy.visit(`/ad-1/channels/${incidentChannelName}`);

                    // * Verify that there is an error message from the incident bot
                    cy.getNthPostId(1).then((id) => {
                        cy.get(`#postMessageText_${id}`)
                            .contains(`Failed to invite the following users: @${userToRemove.username}`);
                    });
                });
            });
        });

        describe('default commander setting', () => {
            it('defaults to the creator when no commander is specified', () => {
                const playbookName = 'Playbook (' + Date.now() + ')';
                let playbookId;

                // # Create a playbook with the default commander setting set to false
                // and no commander specified
                cy.apiCreatePlaybook({
                    teamId,
                    title: playbookName,
                    createPublicIncident: true,
                    memberIDs: [userId],
                    defaultCommanderId: '',
                    defaultCommanderEnabled: false,
                }).then((playbook) => {
                    playbookId = playbook.id;
                });

                // # Create a new incident with that playbook
                const now = Date.now();
                const incidentName = `Incident (${now})`;
                const incidentChannelName = `incident-${now}`;
                cy.apiStartIncident({
                    teamId,
                    playbookId,
                    incidentName,
                    commanderUserId: userId,
                });

                // # Navigate to the incident channel
                cy.visit(`/ad-1/channels/${incidentChannelName}`);

                // * Verify that the RHS shows the commander being the creator
                cy.get('#rhsContainer').within(() => {
                    cy.findByText('Commander').parent().within(() => {
                        cy.findByText('@user-1');
                    });
                });
            });

            it('defaults to the creator when no commander is specified, even if the setting is enabled', () => {
                const playbookName = 'Playbook (' + Date.now() + ')';
                let playbookId;

                // # Create a playbook with the default commander setting set to false
                // and no commander specified
                cy.apiCreatePlaybook({
                    teamId,
                    title: playbookName,
                    createPublicIncident: true,
                    memberIDs: [userId],
                    defaultCommanderId: '',
                    defaultCommanderEnabled: true,
                }).then((playbook) => {
                    playbookId = playbook.id;
                });

                // # Create a new incident with that playbook
                const now = Date.now();
                const incidentName = `Incident (${now})`;
                const incidentChannelName = `incident-${now}`;
                cy.apiStartIncident({
                    teamId,
                    playbookId,
                    incidentName,
                    commanderUserId: userId,
                });

                // # Navigate to the incident channel
                cy.visit(`/ad-1/channels/${incidentChannelName}`);

                // * Verify that the RHS shows the commander being the creator
                cy.get('#rhsContainer').within(() => {
                    cy.findByText('Commander').parent().within(() => {
                        cy.findByText('@user-1');
                    });
                });
            });

            it('assigns the commander when they are part of the invited members list', () => {
                const playbookName = 'Playbook (' + Date.now() + ')';

                // # Create a playbook with the commander being part of the invited users
                cy.apiGetUsers(['alice.johnston']).then((res) => {
                    const userIds = res.body.map((user) => user.id);

                    return cy.apiCreatePlaybook({
                        teamId,
                        title: playbookName,
                        createPublicIncident: true,
                        memberIDs: [userId],
                        invitedUserIds: userIds,
                        inviteUsersEnabled: true,
                        defaultCommanderId: userIds[0],
                        defaultCommanderEnabled: true,
                    });
                }).then((playbook) => {
                    // # Create a new incident with that playbook
                    const now = Date.now();
                    const incidentName = `Incident (${now})`;
                    const incidentChannelName = `incident-${now}`;

                    cy.apiStartIncident({
                        teamId,
                        playbookId: playbook.id,
                        incidentName,
                        commanderUserId: userId,
                    });

                    // # Navigate to the incident channel
                    cy.visit(`/ad-1/channels/${incidentChannelName}`);

                    // * Verify that the RHS shows the commander being the invited user
                    cy.get('#rhsContainer').within(() => {
                        cy.findByText('Commander').parent().within(() => {
                            cy.findByText('@alice.johnston');
                        });
                    });
                });
            });

            it('assigns the commander even if they are not invited', () => {
                const playbookName = 'Playbook (' + Date.now() + ')';

                // # Create a playbook with the commander being part of the invited users
                cy.apiGetUsers(['alice.johnston']).then((res) => {
                    const userIds = res.body.map((user) => user.id);

                    return cy.apiCreatePlaybook({
                        teamId,
                        title: playbookName,
                        createPublicIncident: true,
                        memberIDs: [userId],
                        invitedUserIds: [],
                        inviteUsersEnabled: false,
                        defaultCommanderId: userIds[0],
                        defaultCommanderEnabled: true,
                    });
                }).then((playbook) => {
                    // # Create a new incident with that playbook
                    const now = Date.now();
                    const incidentName = `Incident (${now})`;
                    const incidentChannelName = `incident-${now}`;

                    cy.apiStartIncident({
                        teamId,
                        playbookId: playbook.id,
                        incidentName,
                        commanderUserId: userId,
                    });

                    // # Navigate to the incident channel
                    cy.visit(`/ad-1/channels/${incidentChannelName}`);

                    // * Verify that the RHS shows the commander being the invited user
                    cy.get('#rhsContainer').within(() => {
                        cy.findByText('Commander').parent().within(() => {
                            cy.findByText('@alice.johnston');
                        });
                    });
                });
            });

            it('assigns the commander when they and the creator are the same', () => {
                const playbookName = 'Playbook (' + Date.now() + ')';
                let playbookId;

                // # Create a playbook with the default commander setting set to false
                // and no commander specified
                cy.apiCreatePlaybook({
                    teamId,
                    title: playbookName,
                    createPublicIncident: true,
                    memberIDs: [userId],
                    defaultCommanderId: userId,
                    defaultCommanderEnabled: true,
                }).then((playbook) => {
                    playbookId = playbook.id;
                });

                // # Create a new incident with that playbook
                const now = Date.now();
                const incidentName = `Incident (${now})`;
                const incidentChannelName = `incident-${now}`;
                cy.apiStartIncident({
                    teamId,
                    playbookId,
                    incidentName,
                    commanderUserId: userId,
                });

                // # Navigate to the incident channel
                cy.visit(`/ad-1/channels/${incidentChannelName}`);

                // * Verify that the RHS shows the commander being the creator
                cy.get('#rhsContainer').within(() => {
                    cy.findByText('Commander').parent().within(() => {
                        cy.findByText('@user-1');
                    });
                });
            });
        });
    });
});
