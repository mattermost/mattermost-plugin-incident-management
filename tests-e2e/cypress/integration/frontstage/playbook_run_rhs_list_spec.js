// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as TIMEOUTS from '../../fixtures/timeouts';

describe('rhs playbook run list', () => {
    const playbookName = 'Playbook (' + Date.now() + ')';
    const playbook2Name = 'Playbook (' + (Date.now() + 1) + ')';
    const playbookNameTeam2 = 'Playbook (' + (Date.now() + 2) + ')';
    let teamId1;
    let teamName1;
    let teamId2;
    let teamName2;
    let userId;
    let user2Id;
    let playbookId1;
    let playbookId2;
    let playbookIdTeam2;
    let privateChannelName;

    before(() => {
        // # Login as the sysadmin
        cy.apiLogin('sysadmin');

        // # Create Team 1
        cy.apiCreateTeam('team', 'Team').then(({team}) => {
            teamId1 = team.id;
            teamName1 = team.name;

            // # Add user-1 to team
            cy.apiGetUserByEmail('user-1@sample.mattermost.com').then(({user}) => {
                cy.apiAddUserToTeam(team.id, user.id);

                // # Create a private channel
                cy.apiCreateChannel(team.id, 'private-channel', 'Private Channel', 'P')
                    .then(({channel}) => {
                        privateChannelName = channel.name;

                        // # Add user-1 to that channel
                        cy.apiAddUserToChannel(channel.id, user.id);
                    });
            });

            // # Add user-1 to team
            cy.apiGetUserByEmail('user-2@sample.mattermost.com').then(({user}) => {
                cy.apiAddUserToTeam(team.id, user.id);
            });

            // # Login as user-1
            cy.apiLogin('user-1');

            // # Create a playbook
            cy.apiGetCurrentUser().then((user) => {
                userId = user.id;

                cy.apiCreateTestPlaybook({
                    teamId: team.id,
                    title: playbookName,
                    userId: user.id,
                }).then((playbook) => {
                    playbookId1 = playbook.id;
                });
            });

            // # Login as user-2
            cy.apiLogin('user-2');

            cy.apiGetCurrentUser().then((user) => {
                user2Id = user.id;

                // # Create a playbook
                cy.apiCreateTestPlaybook({
                    teamId: team.id,
                    title: playbook2Name,
                    userId: user2Id,
                }).then((playbook) => {
                    playbookId2 = playbook.id;
                });
            });
        });

        // # Login as the sysadmin
        cy.apiLogin('sysadmin');

        // # Create Team 2
        cy.apiCreateTeam('team', 'Team').then(({team}) => {
            teamId2 = team.id;
            teamName2 = team.name;

            // # Add user-1 to team
            cy.apiGetUserByEmail('user-1@sample.mattermost.com').then(({user}) => {
                cy.apiAddUserToTeam(team.id, user.id);
            });

            // # Login as user-1
            cy.apiLogin('user-1');

            // # Create a playbook
            cy.apiGetCurrentUser().then((user) => {
                userId = user.id;

                cy.apiCreateTestPlaybook({
                    teamId: team.id,
                    title: playbookNameTeam2,
                    userId: user.id,
                }).then((playbook) => {
                    playbookIdTeam2 = playbook.id;
                });
            });
        });
    });

    beforeEach(() => {
        // # Size the viewport to show the RHS without covering posts.
        cy.viewport('macbook-13');

        // # Login as user-1
        cy.apiLogin('user-1');
    });

    describe('should show welcome screen', () => {
        it('when user has no active playbook runs', () => {
            cy.apiGetCurrentUser().then((user) => {
                expect(user.id).to.equal(userId);
            });

            // # Navigate directly to a non-playbook run channel
            cy.wait(TIMEOUTS.ONE_SEC).visit(`/${teamName1}/channels/town-square`);

            // # Ensure the channel is loaded before continuing (allows redux to sync).
            cy.get('#centerChannelFooter').findByTestId('post_textbox').should('exist');

            // # Click the icon
            cy.get('#channel-header').within(() => {
                cy.get('#incidentIcon').should('exist').click();
            });

            // * Verify we see the welcome screen when there are no playbook runs.
            cy.get('#rhsContainer').should('exist').within(() => {
                cy.findByTestId('welcome-view-has-playbooks').should('exist');
            });
        });

        it('when in a playbook run, leaving to another channel, and ending the playbook run', () => {
            // # Navigate directly to a non-playbook run channel
            cy.visit(`/${teamName1}/channels/off-topic`);

            // # Ensure the channel is loaded before continuing (allows redux to sync).
            cy.get('#centerChannelFooter').findByTestId('post_textbox').should('exist');

            // # start a playbook run
            const playbookRunName = 'Private ' + Date.now();
            cy.apiRunPlaybook({
                teamId: teamId1,
                playbookId: playbookId1,
                playbookRunName,
                ownerUserId: userId
            }).then((playbookRun) => {
                cy.verifyPlaybookRunActive(teamId1, playbookRunName);

                // # move to non-playbook run channel
                cy.get('#sidebarItem_town-square').click();

                // # Ensure the channel is loaded before continuing (allows redux to sync).
                cy.get('#centerChannelFooter').findByTestId('post_textbox').should('exist');

                // # Click the icon
                cy.get('#channel-header').within(() => {
                    cy.get('#incidentIcon').should('exist').click();
                });

                // * Verify the rhs list is open the playbook run is visible.
                cy.get('#rhsContainer').should('exist').within(() => {
                    cy.findByText('Runs in progress').should('exist');

                    cy.findByText(playbookRunName).should('exist');
                });

                cy.apiUpdateStatus({
                    playbookRunId: playbookRun.id,
                    userId,
                    teamId: teamId1,
                    message: 'ending',
                    description: 'description',
                    status: 'Archived',
                });
            });

            // * Verify we see the welcome screen when there are no playbook runs.
            cy.get('#rhsContainer').should('exist').within(() => {
                cy.findByTestId('welcome-view-has-playbooks').should('exist');
            });
        });
    });

    describe('should see the complete playbook run list', () => {
        it('after creating two playbook runs and moving back to town-square', () => {
            cy.endAllMyActivePlaybookRuns(teamId1);

            // # Navigate directly to a non-playbook run channel
            cy.visit(`/${teamName1}/channels/town-square`);

            // # Ensure the channel is loaded before continuing (allows redux to sync).
            cy.get('#centerChannelFooter').findByTestId('post_textbox').should('exist');

            // # Click the icon
            cy.get('#channel-header').within(() => {
                cy.get('#incidentIcon').should('exist').click();
            });

            // # start 2 playbook runs
            const now = Date.now();
            let playbookRunName = 'Private ' + now;
            cy.apiRunPlaybook({
                teamId: teamId1,
                playbookId: playbookId1,
                playbookRunName,
                ownerUserId: userId
            });
            cy.verifyPlaybookRunActive(teamId1, playbookRunName);

            playbookRunName = 'Private ' + Date.now();
            cy.apiRunPlaybook({
                teamId: teamId1,
                playbookId: playbookId1,
                playbookRunName,
                ownerUserId: userId
            });
            cy.verifyPlaybookRunActive(teamId1, playbookRunName);

            // * Verify the rhs list is still open and two go-to-channel buttons are visible.
            cy.get('#rhsContainer').should('exist').within(() => {
                cy.findByText('Runs in progress').should('exist');

                cy.findAllByTestId('go-to-channel').should('have.length', 2);
            });
        });

        it('after seeing playbook run details and clicking on the back button', () => {
            // # Navigate directly to a non-playbook run channel
            cy.visit(`/${teamName1}/channels/town-square`);

            // # Ensure the channel is loaded before continuing (allows redux to sync).
            cy.get('#centerChannelFooter').findByTestId('post_textbox').should('exist');

            // # start new playbook run
            const now = Date.now();
            const playbookRunName = 'Playbook Run (' + now + ')';
            cy.apiRunPlaybook({
                teamId: teamId1,
                playbookId: playbookId1,
                playbookRunName,
                ownerUserId: userId
            });
            cy.verifyPlaybookRunActive(teamId1, playbookRunName);

            // # Open the playbook run channel from the LHS.
            cy.uiSwitchChannel(playbookRunName);

            // # Ensure the channel is loaded before continuing (allows redux to sync).
            cy.get('#centerChannelFooter').findByTestId('post_textbox').should('exist');

            // * Verify the playbook run RHS is open.
            cy.get('#rhsContainer').should('exist').within(() => {
                cy.findByTestId('rhs-title').should('exist').within(() => {
                    cy.findByText(playbookRunName).should('exist');
                });

                // * Verify the title shows "Reported"
                cy.get('.sidebar--right__title').contains('Reported');
            });

            // # bring up the playbook run list
            cy.get('#rhsContainer').within(() => {
                cy.findByTestId('back-button').should('exist').click();
            });

            // * Verify the rhs list is open playbook run is visible.
            cy.get('#rhsContainer').should('exist').within(() => {
                cy.findByText('Runs in progress').should('exist');

                cy.findByText(playbookRunName).should('exist');
            });
        });

        it('in playbook runs, closing the RHS, going to town-square, and clicking on the header icon', () => {
            // # Navigate directly to a non-playbook run channel
            cy.visit(`/${teamName1}/channels/town-square`);

            // # Ensure the channel is loaded before continuing (allows redux to sync).
            cy.get('#centerChannelFooter').findByTestId('post_textbox').should('exist');

            // # start new playbook run
            const now = Date.now();
            const playbookRunName = 'Playbook Run (' + now + ')';
            cy.apiRunPlaybook({
                teamId: teamId1,
                playbookId: playbookId1,
                playbookRunName,
                ownerUserId: userId
            });
            cy.verifyPlaybookRunActive(teamId1, playbookRunName);

            // # Open the playbook run channel from the LHS.
            cy.uiSwitchChannel(playbookRunName);

            // # Ensure the channel is loaded before continuing (allows redux to sync).
            cy.get('#centerChannelFooter').findByTestId('post_textbox').should('exist');

            // # Close the RHS
            cy.get('#rhsContainer').within(() => {
                cy.get('#searchResultsCloseButton').should('exist').click();
            });

            // # Go to town-square
            cy.get('#sidebarItem_town-square').click();

            // # Ensure the channel is loaded before continuing (allows redux to sync).
            cy.get('#centerChannelFooter').findByTestId('post_textbox').should('exist');

            // * Verify the rhs list is closed
            cy.get('#rhsContainer').should('not.exist');

            // # Click the icon
            cy.get('#channel-header').within(() => {
                cy.get('#incidentIcon').should('exist').click();
            });

            // * Verify the rhs list is open and we can see the new playbook run
            cy.get('#rhsContainer').should('exist').within(() => {
                cy.findByText('Runs in progress').should('exist');

                cy.findByText(playbookRunName).should('exist');
            });
        });

        it('after clicking back and going to town-square', () => {
            // # Navigate directly to a non-playbook run channel
            cy.visit(`/${teamName1}/channels/town-square`);

            // # Ensure the channel is loaded before continuing (allows redux to sync).
            cy.get('#centerChannelFooter').findByTestId('post_textbox').should('exist');

            // # start new playbook run
            const now = Date.now();
            const playbookRunName = 'Playbook Run (' + now + ')';
            cy.apiRunPlaybook({
                teamId: teamId1,
                playbookId: playbookId1,
                playbookRunName,
                ownerUserId: userId
            });
            cy.verifyPlaybookRunActive(teamId1, playbookRunName);

            // # Open the playbook run channel from the LHS.
            cy.uiSwitchChannel(playbookRunName);

            // # Ensure the channel is loaded before continuing (allows redux to sync).
            cy.get('#centerChannelFooter').findByTestId('post_textbox').should('exist');

            // # Click the back button
            cy.get('#rhsContainer').within(() => {
                cy.findByTestId('back-button').should('exist').click();
            });

            // # Go to town-square
            cy.get('#sidebarItem_town-square').click();

            // # Ensure the channel is loaded before continuing (allows redux to sync).
            cy.get('#centerChannelFooter').findByTestId('post_textbox').should('exist');

            // * Verify the rhs list is open and we can see the new playbook run
            cy.get('#rhsContainer').should('exist').within(() => {
                cy.findByText('Runs in progress').should('exist');

                cy.findByText(playbookRunName).should('exist');
            });
        });

        it('after going to a private channel and clicking on the header icon', () => {
            // # start new playbook run
            const now = Date.now();
            const playbookRunName = 'Playbook Run (' + now + ')';
            cy.apiRunPlaybook({
                teamId: teamId1,
                playbookId: playbookId1,
                playbookRunName,
                ownerUserId: userId
            });
            cy.verifyPlaybookRunActive(teamId1, playbookRunName);

            // # Visit a private channel: autem-2
            cy.visit(`/${teamName1}/channels/${privateChannelName}`);

            // # Ensure the channel is loaded before continuing (allows redux to sync).
            cy.get('#centerChannelFooter').findByTestId('post_textbox').should('exist');

            // * Verify the rhs list is closed
            cy.get('#rhsContainer').should('not.exist');

            // # Click the icon
            cy.get('#channel-header').within(() => {
                cy.get('#incidentIcon').should('exist').click();
            });

            // * Verify the rhs list is open and we can see the new playbook run
            cy.get('#rhsContainer').should('exist').within(() => {
                cy.findByText('Runs in progress').should('exist');

                cy.findByText(playbookRunName).should('exist');
            });
        });

        it('of the current team, not another teams channels', () => {
            // # Remove all active playbook runs so that we can verify the number of playbook runs in the rhs list later
            cy.endAllMyActivePlaybookRuns(teamId1);
            cy.endAllMyActivePlaybookRuns(teamId2);

            // # Navigate directly to a non-playbook run channel
            cy.visit(`/${teamName1}/channels/town-square`);

            // # Ensure the channel is loaded before continuing (allows redux to sync).
            cy.get('#centerChannelFooter').findByTestId('post_textbox').should('exist');

            // # Click the icon
            cy.get('#channel-header').within(() => {
                cy.get('#incidentIcon').should('exist').click();
            });

            // # start first playbook run
            const now = Date.now();
            const playbookRunName1 = 'Private ' + now;
            cy.apiRunPlaybook({
                teamId: teamId1,
                playbookId: playbookId1,
                playbookRunName: playbookRunName1,
                ownerUserId: userId
            });
            cy.verifyPlaybookRunActive(teamId1, playbookRunName1);

            // * Verify the rhs list is still open and playbook run is visible.
            cy.get('#rhsContainer').should('exist').within(() => {
                cy.findByText('Runs in progress').should('exist');

                // * Verify playbook run is visible
                cy.findByText(playbookRunName1).should('exist');

                // * Verify only one playbook run is visible
                cy.findAllByTestId('go-to-channel').should('have.length', 1);
            });

            // # Go to second team (not directly, we want redux to not be wiped)
            cy.get(`#${teamName2}TeamButton`).should('exist').click();

            // # Ensure the channel is loaded before continuing (allows redux to sync).
            cy.get('#centerChannelFooter').findByTestId('post_textbox').should('exist');

            // # Click the icon
            cy.get('#channel-header').within(() => {
                cy.get('#incidentIcon').should('exist').click();
            });

            // # start second playbook run
            const now2 = Date.now();
            const playbookRunName2 = 'Private ' + now2;
            cy.apiRunPlaybook({
                teamId: teamId2,
                playbookId: playbookIdTeam2,
                playbookRunName: playbookRunName2,
                ownerUserId: userId
            });
            cy.verifyPlaybookRunActive(teamId2, playbookRunName2);

            // * Verify the rhs list is still open and playbook run is visible.
            cy.get('#rhsContainer').should('exist').within(() => {
                cy.findByText('Runs in progress').should('exist');

                // * Verify playbookRun2 is visible
                cy.findByText(playbookRunName2).should('exist');

                // * Verify only one playbook run is visible
                cy.findAllByTestId('go-to-channel').should('have.length', 1);
            });

            // # Go to first team (not directly, we want redux to not be wiped)
            cy.get(`#${teamName1}TeamButton`).should('exist').click();

            // # Ensure the channel is loaded before continuing (allows redux to sync).
            cy.get('#centerChannelFooter').findByTestId('post_textbox').should('exist');

            // # Click the icon
            cy.get('#channel-header').within(() => {
                cy.get('#incidentIcon').should('exist').click();
            });

            // * Verify the rhs list is open and only one playbook run is visible.
            cy.get('#rhsContainer').should('exist').within(() => {
                cy.findByText('Runs in progress').should('exist');

                // * Verify playbook run is visible
                cy.findByText(playbookRunName1).should('exist');

                // * Verify only that one playbook run is visible
                cy.findAllByTestId('go-to-channel').should('have.length', 1);
            });
        });
    });

    describe('should see playbook run details', () => {
        it('after opening playbook runs list and clicking on the go to channel button', () => {
            // # Navigate directly to a non-playbook run channel
            cy.visit(`/${teamName1}/channels/town-square`);

            // # Ensure the channel is loaded before continuing (allows redux to sync).
            cy.get('#centerChannelFooter').findByTestId('post_textbox').should('exist');

            // # start new playbook run
            const now = Date.now();
            const playbookRunName = 'Playbook Run (' + now + ')';
            cy.apiRunPlaybook({
                teamId: teamId1,
                playbookId: playbookId1,
                playbookRunName,
                ownerUserId: userId
            });
            cy.verifyPlaybookRunActive(teamId1, playbookRunName);

            // # Click the icon
            cy.get('#channel-header').within(() => {
                cy.get('#incidentIcon').should('exist').click();
            });

            // * click on the first go-to-channel button.
            cy.get('#rhsContainer').should('exist').within(() => {
                cy.findByText('Runs in progress').should('exist');

                cy.findAllByTestId('go-to-channel').eq(0).click();
            });

            // * Verify the playbook run RHS is open.
            cy.get('#rhsContainer').should('exist').within(() => {
                cy.findByTestId('rhs-title').should('exist').within(() => {
                    cy.findByText(playbookRunName).should('exist');
                });

                // * Verify the title shows "Reported"
                cy.get('.sidebar--right__title').contains('Reported');
            });
        });

        it('after clicking back button then clicking on the go to channel button of same playbook run', () => {
            // # Navigate directly to a non-playbook run channel
            cy.visit(`/${teamName1}/channels/town-square`);

            // # Ensure the channel is loaded before continuing (allows redux to sync).
            cy.get('#centerChannelFooter').findByTestId('post_textbox').should('exist');

            // # start new playbook run
            const now = Date.now();
            const playbookRunName = 'Playbook Run (' + now + ')';
            cy.apiRunPlaybook({
                teamId: teamId1,
                playbookId: playbookId1,
                playbookRunName,
                ownerUserId: userId
            });
            cy.verifyPlaybookRunActive(teamId1, playbookRunName);

            // # Open the playbook run channel from the LHS.
            cy.uiSwitchChannel(playbookRunName);

            // # Ensure the channel is loaded before continuing (allows redux to sync).
            cy.get('#centerChannelFooter').findByTestId('post_textbox').should('exist');

            // * Verify the playbook run RHS is open.
            cy.get('#rhsContainer').should('exist').within(() => {
                cy.findByTestId('rhs-title').should('exist').within(() => {
                    cy.findByText(playbookRunName).should('exist');
                });

                // * Verify the title shows "Reported"
                cy.get('.sidebar--right__title').contains('Reported');

                // # Click the back button
                cy.findByTestId('back-button').should('exist').click();
            });

            // * click on the first go-to-channel button.
            cy.get('#rhsContainer').should('exist').within(() => {
                cy.findByText('Runs in progress').should('exist');

                cy.findAllByTestId('go-to-channel').eq(0).click();
            });

            // * Verify the playbook run RHS is open.
            cy.get('#rhsContainer').should('exist').within(() => {
                cy.findByTestId('rhs-title').should('exist').within(() => {
                    cy.findByText(playbookRunName).should('exist');
                });

                // * Verify the title shows "Reported"
                cy.get('.sidebar--right__title').contains('Reported');
            });
        });

        it('after going to an playbook run channel, closing rhs, and clicking on LHS of another playbook run channel', () => {
            // # Navigate directly to a non-playbook run channel
            cy.visit(`/${teamName1}/channels/town-square`);

            // # Ensure the channel is loaded before continuing (allows redux to sync).
            cy.get('#centerChannelFooter').findByTestId('post_textbox').should('exist');

            // # start 2 new playbook runs
            let now = Date.now();
            const playbookRunName = 'Playbook Run (' + now + ')';

            cy.apiRunPlaybook({
                teamId: teamId1,
                playbookId: playbookId1,
                playbookRunName,
                ownerUserId: userId
            });
            cy.verifyPlaybookRunActive(teamId1, playbookRunName);

            now = Date.now() + 1;
            const secondPlaybookRunName = 'Playbook Run (' + now + ')';

            cy.apiRunPlaybook({
                teamId: teamId1,
                playbookId: playbookId1,
                playbookRunName: secondPlaybookRunName,
                ownerUserId: userId
            });
            cy.verifyPlaybookRunActive(teamId1, secondPlaybookRunName);

            // # Open the playbook run channel from the LHS.
            cy.uiSwitchChannel(secondPlaybookRunName);

            // # Ensure the channel is loaded before continuing (allows redux to sync).
            cy.get('#centerChannelFooter').findByTestId('post_textbox').should('exist');

            // * Verify the playbook run RHS is open.
            cy.get('#rhsContainer').should('exist').within(() => {
                cy.findByTestId('rhs-title').should('exist').within(() => {
                    cy.findByText(secondPlaybookRunName).should('exist');
                });

                // * Verify the title shows "Reported"
                cy.get('.sidebar--right__title').contains('Reported');
            });

            // # Close the RHS
            cy.get('#rhsContainer').within(() => {
                cy.get('#searchResultsCloseButton').should('exist').click();
            });

            // # Open the first playbook run channel from the LHS.
            cy.uiSwitchChannel(playbookRunName);

            // # Ensure the channel is loaded before continuing (allows redux to sync).
            cy.get('#centerChannelFooter').findByTestId('post_textbox').should('exist');

            // * Verify the playbook run RHS is open.
            cy.get('#rhsContainer').should('exist').within(() => {
                cy.findByTestId('rhs-title').should('exist').within(() => {
                    cy.findByText(playbookRunName).should('exist');
                });

                // * Verify the title shows "Reported"
                cy.get('.sidebar--right__title').contains('Reported');
            });
        });

        it('highlights current playbook run', () => {
            // # Navigate directly to a non-playbook run channel
            cy.visit(`/${teamName1}/channels/town-square`);

            // # Ensure the channel is loaded before continuing (allows redux to sync).
            cy.get('#centerChannelFooter').findByTestId('post_textbox').should('exist');

            // # start 2 new playbook runs
            let now = Date.now();
            const playbookRunName = 'Playbook Run (' + now + ')';

            cy.apiRunPlaybook({
                teamId: teamId1,
                playbookId: playbookId1,
                playbookRunName,
                ownerUserId: userId
            });
            cy.verifyPlaybookRunActive(teamId1, playbookRunName);

            now = Date.now() + 1;
            const secondPlaybookRunName = 'Playbook Run (' + now + ')';
            cy.apiRunPlaybook({
                teamId: teamId1,
                playbookId: playbookId1,
                playbookRunName: secondPlaybookRunName,
                ownerUserId: userId
            });
            cy.verifyPlaybookRunActive(teamId1, secondPlaybookRunName);

            // # Open the playbook run channel from the LHS.
            cy.uiSwitchChannel(playbookRunName);

            // # Ensure the channel is loaded before continuing (allows redux to sync).
            cy.get('#centerChannelFooter').findByTestId('post_textbox').should('exist');

            // * Verify the playbook run RHS is open.
            cy.get('#rhsContainer').should('exist').within(() => {
                // # Click the back button
                cy.findByTestId('back-button').should('exist').click();
            });

            // * Verify second playbook run is not highlighted
            cy.get('#rhsContainer').should('exist').within(() => {
                cy.get('[class^=PlaybookRunContainer]').eq(0).within(() => {
                    cy.findByText(secondPlaybookRunName).should('exist');
                });
                cy.get('[class^=PlaybookRunContainer]')
                    .eq(0)
                    .should('have.css', 'box-shadow', 'rgba(61, 60, 64, 0.24) 0px -1px 0px 0px inset');
            });

            // * Verify first playbook run is highlighted
            cy.get('#rhsContainer').should('exist').within(() => {
                cy.get('[class^=PlaybookRunContainer]').eq(1).within(() => {
                    cy.findByText(playbookRunName).should('exist');
                });
                cy.get('[class^=PlaybookRunContainer]')
                    .eq(1)
                    .should('have.css', 'box-shadow', 'rgba(61, 60, 64, 0.24) 0px -1px 0px 0px inset, rgb(22, 109, 224) 4px 0px 0px 0px inset');
            });
        });

        it('after going to playbook run, closing rhs, going to town-square, and clicking on same playbook run channel in LHS', () => {
            // # Navigate directly to a non-playbook run channel
            cy.visit(`/${teamName1}/channels/town-square`);

            // # Ensure the channel is loaded before continuing (allows redux to sync).
            cy.get('#centerChannelFooter').findByTestId('post_textbox').should('exist');

            // # start new playbook run
            const now = Date.now();
            const playbookRunName = 'Playbook Run (' + now + ')';
            cy.apiRunPlaybook({
                teamId: teamId1,
                playbookId: playbookId1,
                playbookRunName,
                ownerUserId: userId
            });
            cy.verifyPlaybookRunActive(teamId1, playbookRunName);

            // # Open the playbook run channel from the LHS.
            cy.uiSwitchChannel(playbookRunName);

            // # Ensure the channel is loaded before continuing (allows redux to sync).
            cy.get('#centerChannelFooter').findByTestId('post_textbox').should('exist');

            // * Verify the playbook run RHS is open.
            cy.get('#rhsContainer').should('exist').within(() => {
                cy.findByTestId('rhs-title').should('exist').within(() => {
                    cy.findByText(playbookRunName).should('exist');
                });
            });

            // # Close the RHS
            cy.get('#rhsContainer').within(() => {
                cy.get('#searchResultsCloseButton').should('exist').click();
            });

            // # Open town-square from the LHS.
            cy.get('#sidebarItem_town-square').click();

            // # Ensure the channel is loaded before continuing (allows redux to sync).
            cy.get('#centerChannelFooter').findByTestId('post_textbox').should('exist');

            // * Verify the rhs list is closed
            cy.get('#rhsContainer').should('not.exist');

            // # Open the playbook run channel from the LHS.
            cy.uiSwitchChannel(playbookRunName);

            // # Ensure the channel is loaded before continuing (allows redux to sync).
            cy.get('#centerChannelFooter').findByTestId('post_textbox').should('exist');

            // * Verify the playbook run RHS is open.
            cy.get('#rhsContainer').should('exist').within(() => {
                cy.findByTestId('rhs-title').should('exist').within(() => {
                    cy.findByText(playbookRunName).should('exist');
                });

                // * Verify the title shows "Reported"
                cy.get('.sidebar--right__title').contains('Reported');
            });
        });

        it('after going to playbook run, go to town-square, then back', () => {
            // # Navigate directly to a non-playbook run channel
            cy.visit(`/${teamName1}/channels/town-square`);

            // # Ensure the channel is loaded before continuing (allows redux to sync).
            cy.get('#centerChannelFooter').findByTestId('post_textbox').should('exist');

            // # start new playbook run
            const now = Date.now();
            const playbookRunName = 'Playbook Run (' + now + ')';
            cy.apiRunPlaybook({
                teamId: teamId1,
                playbookId: playbookId1,
                playbookRunName,
                ownerUserId: userId
            });
            cy.verifyPlaybookRunActive(teamId1, playbookRunName);

            // # Open the playbook run channel from the LHS.
            cy.uiSwitchChannel(playbookRunName);

            // # Ensure the channel is loaded before continuing (allows redux to sync).
            cy.get('#centerChannelFooter').findByTestId('post_textbox').should('exist');

            // * Verify the playbook run RHS is open.
            cy.get('#rhsContainer').should('exist').within(() => {
                cy.findByTestId('rhs-title').should('exist').within(() => {
                    cy.findByText(playbookRunName).should('exist');
                });
            });

            // # Open town-square from the LHS.
            cy.get('#sidebarItem_town-square').click();

            // # Ensure the channel is loaded before continuing (allows redux to sync).
            cy.get('#centerChannelFooter').findByTestId('post_textbox').should('exist');

            // * Verify the rhs list is open and we can see the new playbook run
            cy.get('#rhsContainer').should('exist').within(() => {
                cy.findByText('Runs in progress').should('exist');

                cy.findByText(playbookRunName).should('exist');
            });

            // # Open the playbook run channel from the LHS.
            cy.uiSwitchChannel(playbookRunName);

            // # Ensure the channel is loaded before continuing (allows redux to sync).
            cy.get('#centerChannelFooter').findByTestId('post_textbox').should('exist');

            // * Verify the playbook run RHS is open.
            cy.get('#rhsContainer').should('exist').within(() => {
                cy.findByTestId('rhs-title').should('exist').within(() => {
                    cy.findByText(playbookRunName).should('exist');
                });

                // * Verify the title shows "Reported"
                cy.get('.sidebar--right__title').contains('Reported');
            });
        });
    });

    describe('websockets', () => {
        it('should see playbook run in list when user is added to the channel by another user', () => {
            // # Navigate directly to a non-playbook run channel
            cy.visit(`/${teamName1}/channels/town-square`);

            // # Ensure the channel is loaded before continuing (allows redux to sync).
            cy.get('#centerChannelFooter').findByTestId('post_textbox').should('exist');

            // # Click the icon
            cy.get('#channel-header').within(() => {
                cy.get('#incidentIcon').should('exist').click();
            });

            // # Login as user-2
            cy.apiLogin('user-2');

            // # start new playbook run
            const now = Date.now();
            const playbookRunName = 'Playbook Run (' + now + ')';
            const playbookRunChannelName = 'playbook-run-' + now;
            cy.apiRunPlaybook({
                teamId: teamId1,
                playbook2Id: playbookId2,
                playbookRunName,
                ownerUserId: user2Id
            });
            cy.verifyPlaybookRunActive(teamId1, playbookRunName);

            // # add user-1 to the playbook run
            let channelId;
            cy.apiGetChannelByName(teamName1, playbookRunChannelName).then(({channel}) => {
                channelId = channel.id;
                cy.apiAddUserToChannel(channelId, userId);
            });

            // * Verify the rhs list is open and we can see the new playbook run
            cy.get('#rhsContainer').should('exist').within(() => {
                cy.findByText('Runs in progress').should('exist');

                cy.findByText(playbookRunName).should('exist');
            });
        });

        it('should see playbook run in list when user creates new playbook run and presses back button', () => {
            // # Navigate directly to a non-playbook run channel
            cy.visit(`/${teamName1}/channels/town-square`);

            // # Ensure the channel is loaded before continuing (allows redux to sync).
            cy.get('#centerChannelFooter').findByTestId('post_textbox').should('exist');

            // # start new playbook run
            const now = Date.now();
            const playbookRunName = 'Playbook Run (' + now + ')';
            cy.apiRunPlaybook({
                teamId: teamId1,
                playbookId: playbookId1,
                playbookRunName,
                ownerUserId: userId
            });
            cy.verifyPlaybookRunActive(teamId1, playbookRunName);

            // # Open the playbook run channel from the LHS.
            cy.uiSwitchChannel(playbookRunName);

            // # Ensure the channel is loaded before continuing (allows redux to sync).
            cy.get('#centerChannelFooter').findByTestId('post_textbox').should('exist');

            // * Verify the playbook run RHS is open.
            cy.get('#rhsContainer').should('exist').within(() => {
                cy.findByTestId('rhs-title').should('exist').within(() => {
                    cy.findByText(playbookRunName).should('exist');
                });

                // * Verify the title shows "Reported"
                cy.get('.sidebar--right__title').contains('Reported');

                // # Click the back button
                cy.findByTestId('back-button').should('exist').click();
            });

            // * Verify the rhs list is open and we can see the new playbook run
            cy.get('#rhsContainer').should('exist').within(() => {
                cy.findByText('Runs in progress').should('exist');

                cy.findByText(playbookRunName).should('exist');
            });
        });

        it('playbook run should be removed from list when user is removed from channel', () => {
            // # Navigate directly to a non-playbook run channel
            cy.visit(`/${teamName1}/channels/town-square`);

            // # Ensure the channel is loaded before continuing (allows redux to sync).
            cy.get('#centerChannelFooter').findByTestId('post_textbox').should('exist');

            // # Click the playbook run icon
            cy.get('#channel-header').within(() => {
                cy.get('#incidentIcon').should('exist').click();
            });

            // # Login as user-2
            cy.apiLogin('user-2');

            // # start new playbook run
            const now = Date.now();
            const playbookRunName = 'Playbook Run (' + now + ')';
            const playbookRunChannelName = 'playbook-run-' + now;
            cy.apiRunPlaybook({
                teamId: teamId1,
                playbook2Id: playbookId2,
                playbookRunName,
                ownerUserId: user2Id
            });
            cy.verifyPlaybookRunActive(teamId1, playbookRunName);

            // # add user-1 to the playbook run
            cy.apiGetChannelByName(teamName1, playbookRunChannelName).then(({channel}) => {
                const channelId = channel.id;
                cy.apiAddUserToChannel(channelId, userId);

                // * Verify the rhs list is open and we can see the new playbook run
                cy.get('#rhsContainer').should('exist').within(() => {
                    cy.findByText('Runs in progress').should('exist');

                    cy.findByText(playbookRunName).should('exist');
                });

                // # remove user-1 from the playbook run
                cy.removeUserFromChannel(channelId, userId);

                // * Verify the playbook run is not listed
                cy.get('#rhsContainer').should('exist').within(() => {
                    cy.findByText('Runs in progress').should('exist');

                    cy.findByText(playbookRunName).should('not.exist');
                });
            });
        });

        it('playbook run should be removed from list when another user closes playbook run', () => {
            // # Navigate directly to a non-playbook run channel
            cy.visit(`/${teamName1}/channels/town-square`);

            // # Ensure the channel is loaded before continuing (allows redux to sync).
            cy.get('#centerChannelFooter').findByTestId('post_textbox').should('exist');

            // # Click the icon
            cy.get('#channel-header').within(() => {
                cy.get('#incidentIcon').should('exist').click();
            });

            // # Login as user-2
            cy.apiLogin('user-2');

            // # start new playbook run
            const now = Date.now();
            const playbookRunName = 'Playbook Run (' + now + ')';
            const playbookRunChannelName = 'playbook-run-' + now;
            let playbookRunId;
            cy.apiRunPlaybook({
                teamId: teamId1,
                playbook2Id: playbookId2,
                playbookRunName,
                ownerUserId: user2Id
            }).then((playbookRun) => {
                playbookRunId = playbookRun.id;
            });
            cy.verifyPlaybookRunActive(teamId1, playbookRunName);

            // # add user-1 to the playbook run
            cy.apiGetChannelByName(teamName1, playbookRunChannelName).then(({channel}) => {
                cy.apiAddUserToChannel(channel.id, userId);

                // * Verify the rhs list is open and we can see the new playbook run
                cy.get('#rhsContainer').should('exist').within(() => {
                    cy.findByText('Runs in progress').should('exist');

                    cy.findByText(playbookRunName).should('exist');
                });

                // # User-2 closes the playbook run
                cy.apiUpdateStatus({
                    playbookRunId,
                    userId: user2Id,
                    teamId: teamId1,
                    message: 'ending',
                    description: 'description',
                    status: 'Archived',
                });

                // * Verify the playbook run is not listed
                cy.get('#rhsContainer').should('exist').within(() => {
                    cy.findByText('Runs in progress').should('exist');

                    cy.findByText(playbookRunName).should('not.exist');
                });
            });
        });

        it('should see playbook run in list when the user restarts an playbook run and presses back button', () => {
            // # Navigate directly to a non-playbook run channel
            cy.visit(`/${teamName1}/channels/town-square`);

            // # Ensure the channel is loaded before continuing (allows redux to sync).
            cy.get('#centerChannelFooter').findByTestId('post_textbox').should('exist');

            // # Click the icon
            cy.get('#channel-header').within(() => {
                cy.get('#incidentIcon').should('exist').click();
            });

            // # start new playbook run
            const now = Date.now();
            const playbookRunName = 'Playbook Run (' + now + ')';
            let playbookRunId;
            cy.apiRunPlaybook({
                teamId: teamId1,
                playbookId: playbookId1,
                playbookRunName,
                ownerUserId: userId
            }).then((playbookRun) => {
                playbookRunId = playbookRun.id;
                cy.verifyPlaybookRunActive(teamId1, playbookRunName);

                // * Verify the rhs list is open and we can see the new playbook run
                cy.get('#rhsContainer').should('exist').within(() => {
                    cy.findByText('Runs in progress').should('exist');

                    cy.findByText(playbookRunName).should('exist');
                });

                // # User-1 closes the playbook run
                // TODO: Waiting here because of https://mattermost.atlassian.net/browse/MM-29617
                cy.wait(TIMEOUTS.HALF_SEC).apiUpdateStatus({
                    playbookRunId,
                    userId,
                    teamId: teamId1,
                    message: 'ending',
                    description: 'description',
                    status: 'Archived',
                });
                cy.verifyPlaybookRunEnded(teamId1, playbookRunName);

                // * Verify we cannot see the playbook run
                cy.get('#rhsContainer').should('exist').within(() => {
                    cy.findByText('Runs in progress').should('exist');

                    cy.findByText(playbookRunName).should('not.exist');
                });

                // # User-1 restarts the playbook run
                cy.apiRestartPlaybookRun(playbookRunId);
                cy.verifyPlaybookRunActive(teamId1, playbookRunName);

                // * Verify the rhs list is open and we can see the new playbook run
                cy.get('#rhsContainer').should('exist').within(() => {
                    cy.findByText('Runs in progress').should('exist');

                    cy.findByText(playbookRunName).should('exist');
                });
            });
        });

        it('should see playbook run in list when another user restarts an playbook run', () => {
            // # Navigate directly to a non-playbook run channel
            cy.visit(`/${teamName1}/channels/town-square`);

            // # Ensure the channel is loaded before continuing (allows redux to sync).
            cy.get('#centerChannelFooter').findByTestId('post_textbox').should('exist');

            // # Click the icon
            cy.get('#channel-header').within(() => {
                cy.get('#incidentIcon').should('exist').click();
            });

            // * Verify we can see the playbook runs list
            cy.get('#rhsContainer').should('exist').within(() => {
                cy.findByText('Runs in progress').should('exist');
            });

            // # Login as user-2
            cy.apiLogin('user-2');

            // # start new playbook run
            const now = Date.now();
            const playbookRunName = 'Playbook Run (' + now + ')';
            const playbookRunChannelName = 'playbook-run-' + now;
            cy.apiRunPlaybook({
                teamId: teamId1,
                playbook2Id: playbookId2,
                playbookRunName,
                ownerUserId: user2Id
            }).then((playbookRun) => {
                const playbookRunId = playbookRun.id;
                cy.verifyPlaybookRunActive(teamId1, playbookRunName);

                // # add user-1 to the playbook run
                cy.apiGetChannelByName(teamName1, playbookRunChannelName).then(({channel}) => {
                    cy.apiAddUserToChannel(channel.id, userId);
                });

                // * Verify the rhs list is open and we can see the new playbook run
                cy.get('#rhsContainer').should('exist').within(() => {
                    cy.findByText('Runs in progress').should('exist');

                    cy.findByText(playbookRunName).should('exist');
                });

                // # User-2 closes the playbook run
                cy.apiUpdateStatus({
                    playbookRunId: playbookRun.id,
                    userId: user2Id,
                    teamId: teamId1,
                    message: 'ending',
                    description: 'description',
                    status: 'Archived',
                });

                // * Verify we cannot see the playbook run
                cy.get('#rhsContainer').should('exist').within(() => {
                    cy.findByText('Runs in progress').should('exist');

                    cy.findByText(playbookRunName).should('not.exist');
                });

                // # User-2 restarts the playbook run
                cy.apiRestartPlaybookRun(playbookRunId);

                // * Verify the rhs list is open and we can see the new playbook run
                cy.get('#rhsContainer').should('exist').within(() => {
                    cy.findByText('Runs in progress').should('exist');

                    cy.findByText(playbookRunName).should('exist');
                });
            });
        });
    });

    describe('menu items', () => {
        it('should be able to open start playbook run dialog', () => {
            // # Navigate directly to a non-playbook run channel
            cy.visit(`/${teamName1}/channels/town-square`);

            // # Ensure the channel is loaded before continuing (allows redux to sync).
            cy.get('#centerChannelFooter').findByTestId('post_textbox').should('exist');

            // In case we're running this test from scratch, the playbook run list should not be empty.
            // # start new playbook run
            const now = Date.now();
            const playbookRunName = 'Playbook Run (' + now + ')';
            cy.apiRunPlaybook({
                teamId: teamId1,
                playbookId: playbookId1,
                playbookRunName,
                ownerUserId: userId
            });
            cy.verifyPlaybookRunActive(teamId1, playbookRunName);

            // # Open the playbook run channel from the LHS.
            cy.uiSwitchChannel(playbookRunName);

            // * Verify the playbook run RHS is open.
            cy.get('#rhsContainer').should('exist').within(() => {
                cy.findByTestId('rhs-title').should('exist').within(() => {
                    cy.findByText(playbookRunName).should('exist');
                });
            });

            // # Open town-square from the LHS.
            cy.get('#sidebarItem_town-square').click();

            // * Verify the rhs list is open and we can see the new playbook run
            cy.get('#rhsContainer').should('exist').within(() => {
                cy.findByText('Runs in progress').should('exist');

                cy.findByText(playbookRunName).should('exist');
            });

            // # click the Run playbook link
            cy.get('#rhsContainer').within(() => {
                cy.findByText('Run playbook').click();
            });

            // * Verify the playbook run creation dialog has opened
            cy.get('#interactiveDialogModal').should('exist').within(() => {
                cy.findByText('Start run').should('exist');
            });
        });

        it('should be able to create playbook from three dot menu', () => {
            // # Navigate directly to a non-playbook run channel
            cy.visit(`/${teamName1}/channels/town-square`);

            // # Ensure the channel is loaded before continuing (allows redux to sync).
            cy.get('#centerChannelFooter').findByTestId('post_textbox').should('exist');

            // # Click the icon
            cy.get('#channel-header').within(() => {
                cy.get('#incidentIcon').should('exist').click();
            });

            // # click the Run playbook link
            cy.get('#rhsContainer').find('.icon-dots-vertical').click();

            // # click the Create playbook link
            cy.get('#rhsContainer').within(() => {
                cy.findByText('Create playbook').click();
            });

            // * Verify we reached the playbook backstage
            cy.url()
                .should('include', `/${teamName1}/com.mattermost.plugin-incident-management/playbooks`);
        });

        it('should be able to go to playbook run backstage from three dot menu', () => {
            // # Navigate directly to a non-playbook run channel
            cy.visit(`/${teamName1}/channels/town-square`);

            // # Ensure the channel is loaded before continuing (allows redux to sync).
            cy.get('#centerChannelFooter').findByTestId('post_textbox').should('exist');

            // # Click the icon
            cy.get('#channel-header').within(() => {
                cy.get('#incidentIcon').should('exist').click();
            });

            // # click the Run playbook link
            cy.get('#rhsContainer').find('.icon-dots-vertical').click();

            // # click the Create playbook link
            cy.get('#rhsContainer').within(() => {
                cy.findByText('See all runs').click();
            });

            // * Verify we reached the playbook backstage
            cy.url()
                .should('include', `/${teamName1}/com.mattermost.plugin-incident-management/runs`);
        });

        it('should be able to see all playbook runs (runs backstage list)', () => {
            // # Navigate directly to a non-playbook run channel
            cy.visit(`/${teamName1}/channels/town-square`);

            // # Ensure the channel is loaded before continuing (allows redux to sync).
            cy.get('#centerChannelFooter').findByTestId('post_textbox').should('exist');

            // # Click the icon
            cy.get('#channel-header').within(() => {
                cy.get('#incidentIcon').should('exist').click();
            });

            // # click the link to see all runs.
            cy.get('#rhsContainer').within(() => {
                cy.get('a').within(() => {
                    cy.findByText('Click here').click();
                });
            });

            // * Verify we reached the playbook backstage
            cy.url()
                .should('include', `/${teamName1}/com.mattermost.plugin-incident-management/runs`);
        });
    });

    describe('Last updated', () => {
        it('should update when in playbook run channel', () => {
            // # Navigate directly to a non-playbook run channel
            cy.visit(`/${teamName1}/channels/town-square`);

            // # Ensure the channel is loaded before continuing (allows redux to sync).
            cy.get('#centerChannelFooter').findByTestId('post_textbox').should('exist');

            // # start new playbook run
            const now = Date.now();
            const playbookRunName = 'Playbook Run (' + now + ')';
            cy.apiRunPlaybook({
                teamId: teamId1,
                playbookId: playbookId1,
                playbookRunName,
                ownerUserId: userId
            });
            cy.verifyPlaybookRunActive(teamId1, playbookRunName);

            // # Open the playbook run channel from the LHS.
            cy.uiSwitchChannel(playbookRunName);

            // # Ensure the channel is loaded before continuing (allows redux to sync).
            cy.get('#centerChannelFooter').findByTestId('post_textbox').should('exist');

            // * Verify the playbook run RHS is open.
            cy.get('#rhsContainer').should('exist').within(() => {
                cy.findByTestId('rhs-title').should('exist').within(() => {
                    cy.findByText(playbookRunName).should('exist');
                });

                // # Click the back button
                cy.findByTestId('back-button').should('exist').click();
            });

            // * Verify the rhs list is open and we can see the new playbook run
            cy.get('#rhsContainer').should('exist').within(() => {
                cy.findByText('Runs in progress').should('exist');

                cy.get('.scrollbar--view').scrollIntoView();

                cy.findByText(playbookRunName).should('exist');

                // * Verify the last updated is blank
                cy.findAllByText('Last updated:').eq(0).should('exist')
                    .next().should('have.text', '-');
            });

            // # Update the status
            cy.updateStatus('Status update 1');

            // * verify the last updated time is updated
            cy.get('#rhsContainer').should('exist').within(() => {
                cy.findByText('Runs in progress').should('exist');

                cy.get('.scrollbar--view').scrollIntoView();

                cy.findByText(playbookRunName).should('exist');

                // * Verify the last updated is updated
                cy.findAllByText('Last updated:').eq(0).should('exist')
                    .next().should('have.text', '< 1m ago');
            });
        });

        it('should update when in another playbook run channel', () => {
            // # Navigate directly to a non-playbook run channel
            cy.visit(`/${teamName1}/channels/town-square`);

            // # Ensure the channel is loaded before continuing (allows redux to sync).
            cy.get('#centerChannelFooter').findByTestId('post_textbox').should('exist');

            // # start new playbook run
            const now = Date.now();
            const playbookRunName = 'Playbook Run (' + now + ')';
            const playbookRunChannelName = 'playbook-run-' + now;
            cy.apiRunPlaybook({
                teamId: teamId1,
                playbookId: playbookId1,
                playbookRunName,
                ownerUserId: userId
            })
                .then((playbookRun) => {
                    const playbookRunId = playbookRun.id;

                    cy.verifyPlaybookRunActive(teamId1, playbookRunName);

                    // # Open the playbook run channel from the LHS.
                    cy.uiSwitchChannel(playbookRunName);

                    // # Ensure the channel is loaded before continuing (allows redux to sync).
                    cy.get('#centerChannelFooter').findByTestId('post_textbox').should('exist');

                    // * Verify the playbook run RHS is open.
                    cy.get('#rhsContainer').should('exist').within(() => {
                        cy.findByTestId('rhs-title').should('exist').within(() => {
                            cy.findByText(playbookRunName).should('exist');
                        });

                        // # Click the back button
                        cy.findByTestId('back-button').should('exist').click();
                    });

                    // * Verify the rhs list is open and we can see the new playbook run
                    cy.get('#rhsContainer').should('exist').within(() => {
                        cy.findByText('Runs in progress').should('exist');

                        cy.get('.scrollbar--view').scrollIntoView();

                        cy.findByText(playbookRunName).should('exist');

                        // * Verify the last updated is blank
                        cy.findAllByText('Last updated:').eq(0).should('exist')
                            .next().should('have.text', '-');
                    });

                    // # Update the status
                    cy.apiGetChannelByName(teamName1, playbookRunChannelName).then(({channel}) => {
                        const channelId = channel.id;

                        cy.apiUpdateStatus({
                            playbookRunId,
                            userId,
                            channelId,
                            teamId: teamId1,
                            message: 'Status update 2',
                            description: 'description',
                            status: 'Active',
                        });

                        // * verify the last updated time is updated
                        cy.get('#rhsContainer').should('exist').within(() => {
                            cy.findByText('Runs in progress').should('exist');

                            cy.get('.scrollbar--view').scrollIntoView();

                            cy.findByText(playbookRunName).should('exist');

                            // * Verify the last updated is updated
                            cy.findAllByText('Last updated:').eq(0).should('exist')
                                .next().should('have.text', '< 1m ago');
                        });
                    });
                });
        });
    });
});
