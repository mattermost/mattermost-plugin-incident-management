// // Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// // See LICENSE.txt for license information.

// describe('rhs incident list', () => {
//     const playbookName = 'Playbook (' + Date.now() + ')';
//     const playbook2Name = 'Playbook (' + (Date.now() + 1) + ')';
//     const playbookNameTeam2 = 'Playbook (' + (Date.now() + 2) + ')';
//     let teamId1;
//     let teamName1;
//     let teamId2;
//     let teamName2;
//     let userId;
//     let user2Id;
//     let playbookId1;
//     let playbookId2;
//     let playbookIdTeam2;
//     let privateChannelName;

//     before(() => {
//         // # Login as the sysadmin
//         cy.apiLogin('sysadmin');

//         // # Create Team 1
//         cy.apiCreateTeam('team', 'Team').then(({team}) => {
//             teamId1 = team.id;
//             teamName1 = team.name;

//             // # Add user-1 to team
//             cy.apiGetUserByEmail('user-1@sample.mattermost.com').then(({user}) => {
//                 cy.apiAddUserToTeam(team.id, user.id);

//                 // # Create a private channel
//                 cy.apiCreateChannel(team.id, 'private-channel', 'Private Channel', 'P')
//                     .then(({channel}) => {
//                         privateChannelName = channel.name;

//                         // # Add user-1 to that channel
//                         cy.apiAddUserToChannel(channel.id, user.id);
//                     });
//             });

//             // # Add user-1 to team
//             cy.apiGetUserByEmail('user-2@sample.mattermost.com').then(({user}) => {
//                 cy.apiAddUserToTeam(team.id, user.id);
//             });

//             // # Login as user-1
//             cy.apiLogin('user-1');

//             // # Create a playbook
//             cy.apiGetCurrentUser().then((user) => {
//                 userId = user.id;

//                 cy.apiCreateTestPlaybook({
//                     teamId: team.id,
//                     title: playbookName,
//                     userId: user.id,
//                 }).then((playbook) => {
//                     playbookId1 = playbook.id;
//                 });
//             });

//             // # Login as user-2
//             cy.apiLogin('user-2');

//             cy.apiGetCurrentUser().then((user) => {
//                 user2Id = user.id;

//                 // # Create a playbook
//                 cy.apiCreateTestPlaybook({
//                     teamId: team.id,
//                     title: playbook2Name,
//                     userId: user2Id,
//                 }).then((playbook) => {
//                     playbookId2 = playbook.id;
//                 });
//             });
//         });

//         // # Login as the sysadmin
//         cy.apiLogin('sysadmin');

//         // # Create Team 2
//         cy.apiCreateTeam('team', 'Team').then(({team}) => {
//             teamId2 = team.id;
//             teamName2 = team.name;

//             // # Add user-1 to team
//             cy.apiGetUserByEmail('user-1@sample.mattermost.com').then(({user}) => {
//                 cy.apiAddUserToTeam(team.id, user.id);
//             });

//             // # Login as user-1
//             cy.apiLogin('user-1');

//             // # Create a playbook
//             cy.apiGetCurrentUser().then((user) => {
//                 userId = user.id;

//                 cy.apiCreateTestPlaybook({
//                     teamId: team.id,
//                     title: playbookNameTeam2,
//                     userId: user.id,
//                 }).then((playbook) => {
//                     playbookIdTeam2 = playbook.id;
//                 });
//             });
//         });
//     });

//     beforeEach(() => {
//         // # Size the viewport to show the RHS without covering posts.
//         cy.viewport('macbook-13');

//         // # Login as user-1
//         cy.apiLogin('user-1');
//     });

//     describe('should show welcome screen', () => {
//         it('when user has no active incidents', () => {
//             cy.apiGetCurrentUser().then((user) => {
//                 expect(user.id).to.equal(userId);
//             });

//             // # Navigate directly to a non-incident channel
//             cy.wait(1000).visit(`/${teamName1}/channels/town-square`);

//             // # Ensure the channel is loaded before continuing (allows redux to sync).
//             cy.get('#centerChannelFooter').findByTestId('post_textbox').should('exist');

//             // # Click the incident icon
//             cy.get('#channel-header').within(() => {
//                 cy.get('#incidentIcon').should('exist').click();
//             });

//             // * Verify we see the welcome screen when there are no incidents
//             cy.get('#rhsContainer').should('exist').within(() => {
//                 cy.findByTestId('welcome-view-has-playbooks').should('exist');
//             });
//         });

//         it('when in an incident, leaving to another channel, and ending the incident', () => {
//             // # Navigate directly to a non-incident channel
//             cy.visit(`/${teamName1}/channels/off-topic`);

//             // # Ensure the channel is loaded before continuing (allows redux to sync).
//             cy.get('#centerChannelFooter').findByTestId('post_textbox').should('exist');

//             // # start an incident
//             const incidentName = 'Private ' + Date.now();
//             cy.apiStartIncident({
//                 teamId: teamId1,
//                 playbookId: playbookId1,
//                 incidentName,
//                 commanderUserId: userId
//             }).then((incident) => {
//                 cy.verifyIncidentActive(teamId1, incidentName);

//                 // # move to non-incident channel
//                 cy.get('#sidebarItem_town-square').click();

//                 // # Ensure the channel is loaded before continuing (allows redux to sync).
//                 cy.get('#centerChannelFooter').findByTestId('post_textbox').should('exist');

//                 // # Click the incident icon
//                 cy.get('#channel-header').within(() => {
//                     cy.get('#incidentIcon').should('exist').click();
//                 });

//                 // * Verify the rhs list is open the incident is visible.
//                 cy.get('#rhsContainer').should('exist').within(() => {
//                     cy.findByText('Your Ongoing Incidents').should('exist');

//                     cy.findByText(incidentName).should('exist');
//                 });

//                 cy.apiUpdateStatus({
//                     incidentId: incident.id,
//                     userId,
//                     teamId: teamId1,
//                     message: 'ending',
//                     description: 'description',
//                     status: 'Archived',
//                 });
//             });

//             // * Verify we see the welcome screen when there are no incidents
//             cy.get('#rhsContainer').should('exist').within(() => {
//                 cy.findByTestId('welcome-view-has-playbooks').should('exist');
//             });
//         });
//     });

//     describe('should see the complete incident list', () => {
//         it('after creating two incidents and moving back to town-square', () => {
//             cy.endAllMyActiveIncidents(teamId1);

//             // # Navigate directly to a non-incident channel
//             cy.visit(`/${teamName1}/channels/town-square`);

//             // # Ensure the channel is loaded before continuing (allows redux to sync).
//             cy.get('#centerChannelFooter').findByTestId('post_textbox').should('exist');

//             // # Click the incident icon
//             cy.get('#channel-header').within(() => {
//                 cy.get('#incidentIcon').should('exist').click();
//             });

//             // # start 2 incidents
//             const now = Date.now();
//             let incidentName = 'Private ' + now;
//             cy.apiStartIncident({
//                 teamId: teamId1,
//                 playbookId: playbookId1,
//                 incidentName,
//                 commanderUserId: userId
//             });
//             cy.verifyIncidentActive(teamId1, incidentName);

//             incidentName = 'Private ' + Date.now();
//             cy.apiStartIncident({
//                 teamId: teamId1,
//                 playbookId: playbookId1,
//                 incidentName,
//                 commanderUserId: userId
//             });
//             cy.verifyIncidentActive(teamId1, incidentName);

//             // * Verify the rhs list is still open and two go-to-channel buttons are visible.
//             cy.get('#rhsContainer').should('exist').within(() => {
//                 cy.findByText('Your Ongoing Incidents').should('exist');

//                 cy.findAllByTestId('go-to-channel').should('have.length', 2);
//             });
//         });

//         it('after seeing incident details and clicking on the back button', () => {
//             // # Navigate directly to a non-incident channel
//             cy.visit(`/${teamName1}/channels/town-square`);

//             // # Ensure the channel is loaded before continuing (allows redux to sync).
//             cy.get('#centerChannelFooter').findByTestId('post_textbox').should('exist');

//             // # start new incident
//             const now = Date.now();
//             const incidentName = 'Incident (' + now + ')';
//             cy.apiStartIncident({
//                 teamId: teamId1,
//                 playbookId: playbookId1,
//                 incidentName,
//                 commanderUserId: userId
//             });
//             cy.verifyIncidentActive(teamId1, incidentName);

//             // # Open the incident channel from the LHS.
//             cy.uiSwitchChannel(incidentName);

//             // # Ensure the channel is loaded before continuing (allows redux to sync).
//             cy.get('#centerChannelFooter').findByTestId('post_textbox').should('exist');

//             // * Verify the incident RHS is open.
//             cy.get('#rhsContainer').should('exist').within(() => {
//                 cy.findByTestId('rhs-title').should('exist').within(() => {
//                     cy.findByText(incidentName).should('exist');
//                 });

//                 // * Verify the title shows "Reported"
//                 cy.get('.sidebar--right__title').contains('Reported');
//             });

//             // # bring up the incident list
//             cy.get('#rhsContainer').within(() => {
//                 cy.findByTestId('back-button').should('exist').click();
//             });

//             // * Verify the rhs list is open incident is visible.
//             cy.get('#rhsContainer').should('exist').within(() => {
//                 cy.findByText('Your Ongoing Incidents').should('exist');

//                 cy.findByText(incidentName).should('exist');
//             });
//         });

//         it('in incidents, closing the RHS, going to town-square, and clicking on the header icon', () => {
//             // # Navigate directly to a non-incident channel
//             cy.visit(`/${teamName1}/channels/town-square`);

//             // # Ensure the channel is loaded before continuing (allows redux to sync).
//             cy.get('#centerChannelFooter').findByTestId('post_textbox').should('exist');

//             // # start new incident
//             const now = Date.now();
//             const incidentName = 'Incident (' + now + ')';
//             cy.apiStartIncident({
//                 teamId: teamId1,
//                 playbookId: playbookId1,
//                 incidentName,
//                 commanderUserId: userId
//             });
//             cy.verifyIncidentActive(teamId1, incidentName);

//             // # Open the incident channel from the LHS.
//             cy.uiSwitchChannel(incidentName);

//             // # Ensure the channel is loaded before continuing (allows redux to sync).
//             cy.get('#centerChannelFooter').findByTestId('post_textbox').should('exist');

//             // # Close the RHS
//             cy.get('#rhsContainer').within(() => {
//                 cy.get('#searchResultsCloseButton').should('exist').click();
//             });

//             // # Go to town-square
//             cy.get('#sidebarItem_town-square').click();

//             // # Ensure the channel is loaded before continuing (allows redux to sync).
//             cy.get('#centerChannelFooter').findByTestId('post_textbox').should('exist');

//             // * Verify the rhs list is closed
//             cy.get('#rhsContainer').should('not.exist');

//             // # Click the incident icon
//             cy.get('#channel-header').within(() => {
//                 cy.get('#incidentIcon').should('exist').click();
//             });

//             // * Verify the rhs list is open and we can see the new incident
//             cy.get('#rhsContainer').should('exist').within(() => {
//                 cy.findByText('Your Ongoing Incidents').should('exist');

//                 cy.findByText(incidentName).should('exist');
//             });
//         });

//         it('after clicking back and going to town-square', () => {
//             // # Navigate directly to a non-incident channel
//             cy.visit(`/${teamName1}/channels/town-square`);

//             // # Ensure the channel is loaded before continuing (allows redux to sync).
//             cy.get('#centerChannelFooter').findByTestId('post_textbox').should('exist');

//             // # start new incident
//             const now = Date.now();
//             const incidentName = 'Incident (' + now + ')';
//             cy.apiStartIncident({
//                 teamId: teamId1,
//                 playbookId: playbookId1,
//                 incidentName,
//                 commanderUserId: userId
//             });
//             cy.verifyIncidentActive(teamId1, incidentName);

//             // # Open the incident channel from the LHS.
//             cy.uiSwitchChannel(incidentName);

//             // # Ensure the channel is loaded before continuing (allows redux to sync).
//             cy.get('#centerChannelFooter').findByTestId('post_textbox').should('exist');

//             // # Click the back button
//             cy.get('#rhsContainer').within(() => {
//                 cy.findByTestId('back-button').should('exist').click();
//             });

//             // # Go to town-square
//             cy.get('#sidebarItem_town-square').click();

//             // # Ensure the channel is loaded before continuing (allows redux to sync).
//             cy.get('#centerChannelFooter').findByTestId('post_textbox').should('exist');

//             // * Verify the rhs list is open and we can see the new incident
//             cy.get('#rhsContainer').should('exist').within(() => {
//                 cy.findByText('Your Ongoing Incidents').should('exist');

//                 cy.findByText(incidentName).should('exist');
//             });
//         });

//         it('after going to a private channel and clicking on the header icon', () => {
//             // # start new incident
//             const now = Date.now();
//             const incidentName = 'Incident (' + now + ')';
//             cy.apiStartIncident({
//                 teamId: teamId1,
//                 playbookId: playbookId1,
//                 incidentName,
//                 commanderUserId: userId
//             });
//             cy.verifyIncidentActive(teamId1, incidentName);

//             // # Visit a private channel: autem-2
//             cy.visit(`/${teamName1}/channels/${privateChannelName}`);

//             // # Ensure the channel is loaded before continuing (allows redux to sync).
//             cy.get('#centerChannelFooter').findByTestId('post_textbox').should('exist');

//             // * Verify the rhs list is closed
//             cy.get('#rhsContainer').should('not.exist');

//             // # Click the incident icon
//             cy.get('#channel-header').within(() => {
//                 cy.get('#incidentIcon').should('exist').click();
//             });

//             // * Verify the rhs list is open and we can see the new incident
//             cy.get('#rhsContainer').should('exist').within(() => {
//                 cy.findByText('Your Ongoing Incidents').should('exist');

//                 cy.findByText(incidentName).should('exist');
//             });
//         });

//         it('of the current team, not another teams channels', () => {
//             // # Remove all active incidents so that we can verify the number of incidents in the rhs list later
//             cy.endAllMyActiveIncidents(teamId1);
//             cy.endAllMyActiveIncidents(teamId2);

//             // # Navigate directly to a non-incident channel
//             cy.visit(`/${teamName1}/channels/town-square`);

//             // # Ensure the channel is loaded before continuing (allows redux to sync).
//             cy.get('#centerChannelFooter').findByTestId('post_textbox').should('exist');

//             // # Click the incident icon
//             cy.get('#channel-header').within(() => {
//                 cy.get('#incidentIcon').should('exist').click();
//             });

//             // # start first incident
//             const now = Date.now();
//             const incidentName1 = 'Private ' + now;
//             cy.apiStartIncident({
//                 teamId: teamId1,
//                 playbookId: playbookId1,
//                 incidentName: incidentName1,
//                 commanderUserId: userId
//             });
//             cy.verifyIncidentActive(teamId1, incidentName1);

//             // * Verify the rhs list is still open and incident is visible.
//             cy.get('#rhsContainer').should('exist').within(() => {
//                 cy.findByText('Your Ongoing Incidents').should('exist');

//                 // * Verify incident is visible
//                 cy.findByText(incidentName1).should('exist');

//                 // * Verify only one incident is visible
//                 cy.findAllByTestId('go-to-channel').should('have.length', 1);
//             });

//             // # Go to second team (not directly, we want redux to not be wiped)
//             cy.get(`#${teamName2}TeamButton`).should('exist').click();

//             // # Ensure the channel is loaded before continuing (allows redux to sync).
//             cy.get('#centerChannelFooter').findByTestId('post_textbox').should('exist');

//             // # Click the incident icon
//             cy.get('#channel-header').within(() => {
//                 cy.get('#incidentIcon').should('exist').click();
//             });

//             // # start second incident
//             const now2 = Date.now();
//             const incidentName2 = 'Private ' + now2;
//             cy.apiStartIncident({
//                 teamId: teamId2,
//                 playbookId: playbookIdTeam2,
//                 incidentName: incidentName2,
//                 commanderUserId: userId
//             });
//             cy.verifyIncidentActive(teamId2, incidentName2);

//             // * Verify the rhs list is still open and incident is visible.
//             cy.get('#rhsContainer').should('exist').within(() => {
//                 cy.findByText('Your Ongoing Incidents').should('exist');

//                 // * Verify incident2 is visible
//                 cy.findByText(incidentName2).should('exist');

//                 // * Verify only one incident is visible
//                 cy.findAllByTestId('go-to-channel').should('have.length', 1);
//             });

//             // # Go to first team (not directly, we want redux to not be wiped)
//             cy.get(`#${teamName1}TeamButton`).should('exist').click();

//             // # Ensure the channel is loaded before continuing (allows redux to sync).
//             cy.get('#centerChannelFooter').findByTestId('post_textbox').should('exist');

//             // # Click the incident icon
//             cy.get('#channel-header').within(() => {
//                 cy.get('#incidentIcon').should('exist').click();
//             });

//             // * Verify the rhs list is open and only one incident is visible.
//             cy.get('#rhsContainer').should('exist').within(() => {
//                 cy.findByText('Your Ongoing Incidents').should('exist');

//                 // * Verify incident is visible
//                 cy.findByText(incidentName1).should('exist');

//                 // * Verify only that one incident is visible
//                 cy.findAllByTestId('go-to-channel').should('have.length', 1);
//             });
//         });
//     });

//     describe('should see incident details', () => {
//         it('after opening incidents list and clicking on the go to channel button', () => {
//             // # Navigate directly to a non-incident channel
//             cy.visit(`/${teamName1}/channels/town-square`);

//             // # Ensure the channel is loaded before continuing (allows redux to sync).
//             cy.get('#centerChannelFooter').findByTestId('post_textbox').should('exist');

//             // # start new incident
//             const now = Date.now();
//             const incidentName = 'Incident (' + now + ')';
//             cy.apiStartIncident({
//                 teamId: teamId1,
//                 playbookId: playbookId1,
//                 incidentName,
//                 commanderUserId: userId
//             });
//             cy.verifyIncidentActive(teamId1, incidentName);

//             // # Click the incident icon
//             cy.get('#channel-header').within(() => {
//                 cy.get('#incidentIcon').should('exist').click();
//             });

//             // * click on the first go-to-channel button.
//             cy.get('#rhsContainer').should('exist').within(() => {
//                 cy.findByText('Your Ongoing Incidents').should('exist');

//                 cy.findAllByTestId('go-to-channel').eq(0).click();
//             });

//             // * Verify the incident RHS is open.
//             cy.get('#rhsContainer').should('exist').within(() => {
//                 cy.findByTestId('rhs-title').should('exist').within(() => {
//                     cy.findByText(incidentName).should('exist');
//                 });

//                 // * Verify the title shows "Reported"
//                 cy.get('.sidebar--right__title').contains('Reported');
//             });
//         });

//         it('after clicking back button then clicking on the go to channel button of same incident', () => {
//             // # Navigate directly to a non-incident channel
//             cy.visit(`/${teamName1}/channels/town-square`);

//             // # Ensure the channel is loaded before continuing (allows redux to sync).
//             cy.get('#centerChannelFooter').findByTestId('post_textbox').should('exist');

//             // # start new incident
//             const now = Date.now();
//             const incidentName = 'Incident (' + now + ')';
//             cy.apiStartIncident({
//                 teamId: teamId1,
//                 playbookId: playbookId1,
//                 incidentName,
//                 commanderUserId: userId
//             });
//             cy.verifyIncidentActive(teamId1, incidentName);

//             // # Open the incident channel from the LHS.
//             cy.uiSwitchChannel(incidentName);

//             // # Ensure the channel is loaded before continuing (allows redux to sync).
//             cy.get('#centerChannelFooter').findByTestId('post_textbox').should('exist');

//             // * Verify the incident RHS is open.
//             cy.get('#rhsContainer').should('exist').within(() => {
//                 cy.findByTestId('rhs-title').should('exist').within(() => {
//                     cy.findByText(incidentName).should('exist');
//                 });

//                 // * Verify the title shows "Reported"
//                 cy.get('.sidebar--right__title').contains('Reported');

//                 // # Click the back button
//                 cy.findByTestId('back-button').should('exist').click();
//             });

//             // * click on the first go-to-channel button.
//             cy.get('#rhsContainer').should('exist').within(() => {
//                 cy.findByText('Your Ongoing Incidents').should('exist');

//                 cy.findAllByTestId('go-to-channel').eq(0).click();
//             });

//             // * Verify the incident RHS is open.
//             cy.get('#rhsContainer').should('exist').within(() => {
//                 cy.findByTestId('rhs-title').should('exist').within(() => {
//                     cy.findByText(incidentName).should('exist');
//                 });

//                 // * Verify the title shows "Reported"
//                 cy.get('.sidebar--right__title').contains('Reported');
//             });
//         });

//         it('after going to an incident channel, closing rhs, and clicking on LHS of another incident channel', () => {
//             // # Navigate directly to a non-incident channel
//             cy.visit(`/${teamName1}/channels/town-square`);

//             // # Ensure the channel is loaded before continuing (allows redux to sync).
//             cy.get('#centerChannelFooter').findByTestId('post_textbox').should('exist');

//             // # start 2 new incidents
//             let now = Date.now();
//             const incidentName = 'Incident (' + now + ')';

//             cy.apiStartIncident({
//                 teamId: teamId1,
//                 playbookId: playbookId1,
//                 incidentName,
//                 commanderUserId: userId
//             });
//             cy.verifyIncidentActive(teamId1, incidentName);

//             now = Date.now() + 1;
//             const secondIncidentName = 'Incident (' + now + ')';

//             cy.apiStartIncident({
//                 teamId: teamId1,
//                 playbookId: playbookId1,
//                 incidentName: secondIncidentName,
//                 commanderUserId: userId
//             });
//             cy.verifyIncidentActive(teamId1, secondIncidentName);

//             // # Open the incident channel from the LHS.
//             cy.uiSwitchChannel(secondIncidentName);

//             // # Ensure the channel is loaded before continuing (allows redux to sync).
//             cy.get('#centerChannelFooter').findByTestId('post_textbox').should('exist');

//             // * Verify the incident RHS is open.
//             cy.get('#rhsContainer').should('exist').within(() => {
//                 cy.findByTestId('rhs-title').should('exist').within(() => {
//                     cy.findByText(secondIncidentName).should('exist');
//                 });

//                 // * Verify the title shows "Reported"
//                 cy.get('.sidebar--right__title').contains('Reported');
//             });

//             // # Close the RHS
//             cy.get('#rhsContainer').within(() => {
//                 cy.get('#searchResultsCloseButton').should('exist').click();
//             });

//             // # Open the first incident channel from the LHS.
//             cy.uiSwitchChannel(incidentName);

//             // # Ensure the channel is loaded before continuing (allows redux to sync).
//             cy.get('#centerChannelFooter').findByTestId('post_textbox').should('exist');

//             // * Verify the incident RHS is open.
//             cy.get('#rhsContainer').should('exist').within(() => {
//                 cy.findByTestId('rhs-title').should('exist').within(() => {
//                     cy.findByText(incidentName).should('exist');
//                 });

//                 // * Verify the title shows "Reported"
//                 cy.get('.sidebar--right__title').contains('Reported');
//             });
//         });

//         it('highlights current incident', () => {
//             // # Navigate directly to a non-incident channel
//             cy.visit(`/${teamName1}/channels/town-square`);

//             // # Ensure the channel is loaded before continuing (allows redux to sync).
//             cy.get('#centerChannelFooter').findByTestId('post_textbox').should('exist');

//             // # start 2 new incidents
//             let now = Date.now();
//             const incidentName = 'Incident (' + now + ')';

//             cy.apiStartIncident({
//                 teamId: teamId1,
//                 playbookId: playbookId1,
//                 incidentName,
//                 commanderUserId: userId
//             });
//             cy.verifyIncidentActive(teamId1, incidentName);

//             now = Date.now() + 1;
//             const secondIncidentName = 'Incident (' + now + ')';
//             cy.apiStartIncident({
//                 teamId: teamId1,
//                 playbookId: playbookId1,
//                 incidentName: secondIncidentName,
//                 commanderUserId: userId
//             });
//             cy.verifyIncidentActive(teamId1, secondIncidentName);

//             // # Open the incident channel from the LHS.
//             cy.uiSwitchChannel(incidentName);

//             // # Ensure the channel is loaded before continuing (allows redux to sync).
//             cy.get('#centerChannelFooter').findByTestId('post_textbox').should('exist');

//             // * Verify the incident RHS is open.
//             cy.get('#rhsContainer').should('exist').within(() => {
//                 // # Click the back button
//                 cy.findByTestId('back-button').should('exist').click();
//             });

//             // * Verify second incident is not highlighted
//             cy.get('#rhsContainer').should('exist').within(() => {
//                 cy.get('[class^=IncidentContainer]').eq(0).within(() => {
//                     cy.findByText(secondIncidentName).should('exist');
//                 });
//                 cy.get('[class^=IncidentContainer]')
//                     .eq(0)
//                     .should('have.css', 'box-shadow', 'rgba(61, 60, 64, 0.24) 0px -1px 0px 0px inset');
//             });

//             // * Verify first incident is highlighted
//             cy.get('#rhsContainer').should('exist').within(() => {
//                 cy.get('[class^=IncidentContainer]').eq(1).within(() => {
//                     cy.findByText(incidentName).should('exist');
//                 });
//                 cy.get('[class^=IncidentContainer]')
//                     .eq(1)
//                     .should('have.css', 'box-shadow', 'rgba(61, 60, 64, 0.24) 0px -1px 0px 0px inset, rgb(22, 109, 224) 4px 0px 0px 0px inset');
//             });
//         });

//         it('after going to incident, closing rhs, going to town-square, and clicking on same incident channel in LHS', () => {
//             // # Navigate directly to a non-incident channel
//             cy.visit(`/${teamName1}/channels/town-square`);

//             // # Ensure the channel is loaded before continuing (allows redux to sync).
//             cy.get('#centerChannelFooter').findByTestId('post_textbox').should('exist');

//             // # start new incident
//             const now = Date.now();
//             const incidentName = 'Incident (' + now + ')';
//             cy.apiStartIncident({
//                 teamId: teamId1,
//                 playbookId: playbookId1,
//                 incidentName,
//                 commanderUserId: userId
//             });
//             cy.verifyIncidentActive(teamId1, incidentName);

//             // # Open the incident channel from the LHS.
//             cy.uiSwitchChannel(incidentName);

//             // # Ensure the channel is loaded before continuing (allows redux to sync).
//             cy.get('#centerChannelFooter').findByTestId('post_textbox').should('exist');

//             // * Verify the incident RHS is open.
//             cy.get('#rhsContainer').should('exist').within(() => {
//                 cy.findByTestId('rhs-title').should('exist').within(() => {
//                     cy.findByText(incidentName).should('exist');
//                 });
//             });

//             // # Close the RHS
//             cy.get('#rhsContainer').within(() => {
//                 cy.get('#searchResultsCloseButton').should('exist').click();
//             });

//             // # Open town-square from the LHS.
//             cy.get('#sidebarItem_town-square').click();

//             // # Ensure the channel is loaded before continuing (allows redux to sync).
//             cy.get('#centerChannelFooter').findByTestId('post_textbox').should('exist');

//             // * Verify the rhs list is closed
//             cy.get('#rhsContainer').should('not.exist');

//             // # Open the incident channel from the LHS.
//             cy.uiSwitchChannel(incidentName);

//             // # Ensure the channel is loaded before continuing (allows redux to sync).
//             cy.get('#centerChannelFooter').findByTestId('post_textbox').should('exist');

//             // * Verify the incident RHS is open.
//             cy.get('#rhsContainer').should('exist').within(() => {
//                 cy.findByTestId('rhs-title').should('exist').within(() => {
//                     cy.findByText(incidentName).should('exist');
//                 });

//                 // * Verify the title shows "Reported"
//                 cy.get('.sidebar--right__title').contains('Reported');
//             });
//         });

//         it('after going to incident, go to town-square, then back', () => {
//             // # Navigate directly to a non-incident channel
//             cy.visit(`/${teamName1}/channels/town-square`);

//             // # Ensure the channel is loaded before continuing (allows redux to sync).
//             cy.get('#centerChannelFooter').findByTestId('post_textbox').should('exist');

//             // # start new incident
//             const now = Date.now();
//             const incidentName = 'Incident (' + now + ')';
//             cy.apiStartIncident({
//                 teamId: teamId1,
//                 playbookId: playbookId1,
//                 incidentName,
//                 commanderUserId: userId
//             });
//             cy.verifyIncidentActive(teamId1, incidentName);

//             // # Open the incident channel from the LHS.
//             cy.uiSwitchChannel(incidentName);

//             // # Ensure the channel is loaded before continuing (allows redux to sync).
//             cy.get('#centerChannelFooter').findByTestId('post_textbox').should('exist');

//             // * Verify the incident RHS is open.
//             cy.get('#rhsContainer').should('exist').within(() => {
//                 cy.findByTestId('rhs-title').should('exist').within(() => {
//                     cy.findByText(incidentName).should('exist');
//                 });
//             });

//             // # Open town-square from the LHS.
//             cy.get('#sidebarItem_town-square').click();

//             // # Ensure the channel is loaded before continuing (allows redux to sync).
//             cy.get('#centerChannelFooter').findByTestId('post_textbox').should('exist');

//             // * Verify the rhs list is open and we can see the new incident
//             cy.get('#rhsContainer').should('exist').within(() => {
//                 cy.findByText('Your Ongoing Incidents').should('exist');

//                 cy.findByText(incidentName).should('exist');
//             });

//             // # Open the incident channel from the LHS.
//             cy.uiSwitchChannel(incidentName);

//             // # Ensure the channel is loaded before continuing (allows redux to sync).
//             cy.get('#centerChannelFooter').findByTestId('post_textbox').should('exist');

//             // * Verify the incident RHS is open.
//             cy.get('#rhsContainer').should('exist').within(() => {
//                 cy.findByTestId('rhs-title').should('exist').within(() => {
//                     cy.findByText(incidentName).should('exist');
//                 });

//                 // * Verify the title shows "Reported"
//                 cy.get('.sidebar--right__title').contains('Reported');
//             });
//         });
//     });

//     describe('websockets', () => {
//         it('should see incident in list when user is added to the channel by another user', () => {
//             // # Navigate directly to a non-incident channel
//             cy.visit(`/${teamName1}/channels/town-square`);

//             // # Ensure the channel is loaded before continuing (allows redux to sync).
//             cy.get('#centerChannelFooter').findByTestId('post_textbox').should('exist');

//             // # Click the incident icon
//             cy.get('#channel-header').within(() => {
//                 cy.get('#incidentIcon').should('exist').click();
//             });

//             // # Login as user-2
//             cy.apiLogin('user-2');

//             // # start new incident
//             const now = Date.now();
//             const incidentName = 'Incident (' + now + ')';
//             const incidentChannelName = 'incident-' + now;
//             cy.apiStartIncident({
//                 teamId: teamId1,
//                 playbook2Id: playbookId2,
//                 incidentName,
//                 commanderUserId: user2Id
//             });
//             cy.verifyIncidentActive(teamId1, incidentName);

//             // # add user-1 to the incident
//             let channelId;
//             cy.apiGetChannelByName(teamName1, incidentChannelName).then(({channel}) => {
//                 channelId = channel.id;
//                 cy.apiAddUserToChannel(channelId, userId);
//             });

//             // * Verify the rhs list is open and we can see the new incident
//             cy.get('#rhsContainer').should('exist').within(() => {
//                 cy.findByText('Your Ongoing Incidents').should('exist');

//                 cy.findByText(incidentName).should('exist');
//             });
//         });

//         it('should see incident in list when user creates new incident and presses back button', () => {
//             // # Navigate directly to a non-incident channel
//             cy.visit(`/${teamName1}/channels/town-square`);

//             // # Ensure the channel is loaded before continuing (allows redux to sync).
//             cy.get('#centerChannelFooter').findByTestId('post_textbox').should('exist');

//             // # start new incident
//             const now = Date.now();
//             const incidentName = 'Incident (' + now + ')';
//             cy.apiStartIncident({
//                 teamId: teamId1,
//                 playbookId: playbookId1,
//                 incidentName,
//                 commanderUserId: userId
//             });
//             cy.verifyIncidentActive(teamId1, incidentName);

//             // # Open the incident channel from the LHS.
//             cy.uiSwitchChannel(incidentName);

//             // # Ensure the channel is loaded before continuing (allows redux to sync).
//             cy.get('#centerChannelFooter').findByTestId('post_textbox').should('exist');

//             // * Verify the incident RHS is open.
//             cy.get('#rhsContainer').should('exist').within(() => {
//                 cy.findByTestId('rhs-title').should('exist').within(() => {
//                     cy.findByText(incidentName).should('exist');
//                 });

//                 // * Verify the title shows "Reported"
//                 cy.get('.sidebar--right__title').contains('Reported');

//                 // # Click the back button
//                 cy.findByTestId('back-button').should('exist').click();
//             });

//             // * Verify the rhs list is open and we can see the new incident
//             cy.get('#rhsContainer').should('exist').within(() => {
//                 cy.findByText('Your Ongoing Incidents').should('exist');

//                 cy.findByText(incidentName).should('exist');
//             });
//         });

//         it('incident should be removed from list when user is removed from channel', () => {
//             // # Navigate directly to a non-incident channel
//             cy.visit(`/${teamName1}/channels/town-square`);

//             // # Ensure the channel is loaded before continuing (allows redux to sync).
//             cy.get('#centerChannelFooter').findByTestId('post_textbox').should('exist');

//             // # Click the incident icon
//             cy.get('#channel-header').within(() => {
//                 cy.get('#incidentIcon').should('exist').click();
//             });

//             // # Login as user-2
//             cy.apiLogin('user-2');

//             // # start new incident
//             const now = Date.now();
//             const incidentName = 'Incident (' + now + ')';
//             const incidentChannelName = 'incident-' + now;
//             cy.apiStartIncident({
//                 teamId: teamId1,
//                 playbook2Id: playbookId2,
//                 incidentName,
//                 commanderUserId: user2Id
//             });
//             cy.verifyIncidentActive(teamId1, incidentName);

//             // # add user-1 to the incident
//             cy.apiGetChannelByName(teamName1, incidentChannelName).then(({channel}) => {
//                 const channelId = channel.id;
//                 cy.apiAddUserToChannel(channelId, userId);

//                 // * Verify the rhs list is open and we can see the new incident
//                 cy.get('#rhsContainer').should('exist').within(() => {
//                     cy.findByText('Your Ongoing Incidents').should('exist');

//                     cy.findByText(incidentName).should('exist');
//                 });

//                 // # remove user-1 from the incident
//                 cy.removeUserFromChannel(channelId, userId);

//                 // * Verify the incident is not listed
//                 cy.get('#rhsContainer').should('exist').within(() => {
//                     cy.findByText('Your Ongoing Incidents').should('exist');

//                     cy.findByText(incidentName).should('not.exist');
//                 });
//             });
//         });

//         /* TEMP disable, to be restored with alternate incident close method.
//          * it('incident should be removed from list when the user closes incident and presses back button', () => {
//             // # Navigate directly to a non-incident channel
//             cy.visit('/ad-1/channels/town-square');

//             // # Ensure the channel is loaded before continuing (allows redux to sync).
//             cy.get('#centerChannelFooter').findByTestId('post_textbox').should('exist');

//             // # start new incident
//             const now = Date.now();
//             const incidentName = 'Incident (' + now + ')';
//             const incidentChannelName = 'incident-' + now;
//             cy.apiStartIncident({teamId, playbookId, incidentName, commanderUserId: userId});
//             cy.verifyIncidentActive(teamId, incidentName);

//             // # Open the incident channel from the LHS.
//             cy.get(`#sidebarItem_${incidentChannelName}`).click();

//             // * Verify the incident RHS is open.
//             cy.get('#rhsContainer').should('exist').within(() => {
//                 cy.findByTestId('rhs-title').should('exist').within(() => {
//                     cy.findByText(incidentName).should('exist');
//                 });

//                 // * Verify the title shows "Reported"
//                 cy.get('.sidebar--right__title').contains('Reported');
//             });

//             // # End incident and go to incident list
//             cy.get('#rhsContainer').should('exist').within(() => {
//                 // # Select the tasks tab
//                 cy.findByTestId('tasks').click();

//                 // # End the incident
//                 cy.findByText('End Incident').click();
//             });

//             // # Confirm ending the incident
//             cy.get('.modal-dialog').should('exist').find('#interactiveDialogSubmit').click();

//             cy.get('#rhsContainer').should('exist').within(() => {
//                 // * Verify the title shows "Ended"
//                 cy.get('.sidebar--right__title').contains('Ended');

//                 // # Click the back button
//                 cy.findByTestId('back-button').should('exist').click();
//             });

//             cy.get('#rhsContainer').should('exist').within(() => {
//                 // * Verify the rhs list is open
//                 cy.findByText('Your Ongoing Incidents').should('exist');

//                 // * Verify we cannot see the ended incident
//                 cy.findByText(incidentName).should('not.exist');
//             });
//         });*/

//         it('incident should be removed from list when another user closes incident', () => {
//             // # Navigate directly to a non-incident channel
//             cy.visit(`/${teamName1}/channels/town-square`);

//             // # Ensure the channel is loaded before continuing (allows redux to sync).
//             cy.get('#centerChannelFooter').findByTestId('post_textbox').should('exist');

//             // # Click the incident icon
//             cy.get('#channel-header').within(() => {
//                 cy.get('#incidentIcon').should('exist').click();
//             });

//             // # Login as user-2
//             cy.apiLogin('user-2');

//             // # start new incident
//             const now = Date.now();
//             const incidentName = 'Incident (' + now + ')';
//             const incidentChannelName = 'incident-' + now;
//             let incidentId;
//             cy.apiStartIncident({
//                 teamId: teamId1,
//                 playbook2Id: playbookId2,
//                 incidentName,
//                 commanderUserId: user2Id
//             }).then((incident) => {
//                 incidentId = incident.id;
//             });
//             cy.verifyIncidentActive(teamId1, incidentName);

//             // # add user-1 to the incident
//             cy.apiGetChannelByName(teamName1, incidentChannelName).then(({channel}) => {
//                 cy.apiAddUserToChannel(channel.id, userId);

//                 // * Verify the rhs list is open and we can see the new incident
//                 cy.get('#rhsContainer').should('exist').within(() => {
//                     cy.findByText('Your Ongoing Incidents').should('exist');

//                     cy.findByText(incidentName).should('exist');
//                 });

//                 // # User-2 closes the incident
//                 cy.apiUpdateStatus({
//                     incidentId,
//                     userId: user2Id,
//                     teamId: teamId1,
//                     message: 'ending',
//                     description: 'description',
//                     status: 'Archived',
//                 });

//                 // * Verify the incident is not listed
//                 cy.get('#rhsContainer').should('exist').within(() => {
//                     cy.findByText('Your Ongoing Incidents').should('exist');

//                     cy.findByText(incidentName).should('not.exist');
//                 });
//             });
//         });

//         it('should see incident in list when the user restarts an incident and presses back button', () => {
//             // # Navigate directly to a non-incident channel
//             cy.visit(`/${teamName1}/channels/town-square`);

//             // # Ensure the channel is loaded before continuing (allows redux to sync).
//             cy.get('#centerChannelFooter').findByTestId('post_textbox').should('exist');

//             // # Click the incident icon
//             cy.get('#channel-header').within(() => {
//                 cy.get('#incidentIcon').should('exist').click();
//             });

//             // # start new incident
//             const now = Date.now();
//             const incidentName = 'Incident (' + now + ')';
//             let incidentId;
//             cy.apiStartIncident({
//                 teamId: teamId1,
//                 playbookId: playbookId1,
//                 incidentName,
//                 commanderUserId: userId
//             }).then((incident) => {
//                 incidentId = incident.id;
//                 cy.verifyIncidentActive(teamId1, incidentName);

//                 // * Verify the rhs list is open and we can see the new incident
//                 cy.get('#rhsContainer').should('exist').within(() => {
//                     cy.findByText('Your Ongoing Incidents').should('exist');

//                     cy.findByText(incidentName).should('exist');
//                 });

//                 // # User-1 closes the incident
//                 // TODO: Waiting here because of https://mattermost.atlassian.net/browse/MM-29617
//                 cy.wait(500).apiUpdateStatus({
//                     incidentId,
//                     userId,
//                     teamId: teamId1,
//                     message: 'ending',
//                     description: 'description',
//                     status: 'Archived',
//                 });
//                 cy.verifyIncidentEnded(teamId1, incidentName);

//                 // * Verify we cannot see the incident
//                 cy.get('#rhsContainer').should('exist').within(() => {
//                     cy.findByText('Your Ongoing Incidents').should('exist');

//                     cy.findByText(incidentName).should('not.exist');
//                 });

//                 // # User-1 restarts the incident
//                 cy.apiRestartIncident(incidentId);
//                 cy.verifyIncidentActive(teamId1, incidentName);

//                 // * Verify the rhs list is open and we can see the new incident
//                 cy.get('#rhsContainer').should('exist').within(() => {
//                     cy.findByText('Your Ongoing Incidents').should('exist');

//                     cy.findByText(incidentName).should('exist');
//                 });
//             });
//         });

//         it('should see incident in list when another user restarts an incident', () => {
//             // # Navigate directly to a non-incident channel
//             cy.visit(`/${teamName1}/channels/town-square`);

//             // # Ensure the channel is loaded before continuing (allows redux to sync).
//             cy.get('#centerChannelFooter').findByTestId('post_textbox').should('exist');

//             // # Click the incident icon
//             cy.get('#channel-header').within(() => {
//                 cy.get('#incidentIcon').should('exist').click();
//             });

//             // * Verify we can see the incidents list
//             cy.get('#rhsContainer').should('exist').within(() => {
//                 cy.findByText('Your Ongoing Incidents').should('exist');
//             });

//             // # Login as user-2
//             cy.apiLogin('user-2');

//             // # start new incident
//             const now = Date.now();
//             const incidentName = 'Incident (' + now + ')';
//             const incidentChannelName = 'incident-' + now;
//             cy.apiStartIncident({
//                 teamId: teamId1,
//                 playbook2Id: playbookId2,
//                 incidentName,
//                 commanderUserId: user2Id
//             }).then((incident) => {
//                 const incidentId = incident.id;
//                 cy.verifyIncidentActive(teamId1, incidentName);

//                 // # add user-1 to the incident
//                 cy.apiGetChannelByName(teamName1, incidentChannelName).then(({channel}) => {
//                     cy.apiAddUserToChannel(channel.id, userId);
//                 });

//                 // * Verify the rhs list is open and we can see the new incident
//                 cy.get('#rhsContainer').should('exist').within(() => {
//                     cy.findByText('Your Ongoing Incidents').should('exist');

//                     cy.findByText(incidentName).should('exist');
//                 });

//                 // # User-2 closes the incident
//                 cy.apiUpdateStatus({
//                     incidentId: incident.id,
//                     userId: user2Id,
//                     teamId: teamId1,
//                     message: 'ending',
//                     description: 'description',
//                     status: 'Archived',
//                 });

//                 // * Verify we cannot see the incident
//                 cy.get('#rhsContainer').should('exist').within(() => {
//                     cy.findByText('Your Ongoing Incidents').should('exist');

//                     cy.findByText(incidentName).should('not.exist');
//                 });

//                 // # User-2 restarts the incident
//                 cy.apiRestartIncident(incidentId);

//                 // * Verify the rhs list is open and we can see the new incident
//                 cy.get('#rhsContainer').should('exist').within(() => {
//                     cy.findByText('Your Ongoing Incidents').should('exist');

//                     cy.findByText(incidentName).should('exist');
//                 });
//             });
//         });
//     });

//     describe('menu items', () => {
//         it('should be able to open start incident dialog', () => {
//             // # Navigate directly to a non-incident channel
//             cy.visit(`/${teamName1}/channels/town-square`);

//             // # Ensure the channel is loaded before continuing (allows redux to sync).
//             cy.get('#centerChannelFooter').findByTestId('post_textbox').should('exist');

//             // In case we're running this test from scratch, the incident list should not be empty.
//             // # start new incident
//             const now = Date.now();
//             const incidentName = 'Incident (' + now + ')';
//             cy.apiStartIncident({
//                 teamId: teamId1,
//                 playbookId: playbookId1,
//                 incidentName,
//                 commanderUserId: userId
//             });
//             cy.verifyIncidentActive(teamId1, incidentName);

//             // # Open the incident channel from the LHS.
//             cy.uiSwitchChannel(incidentName);

//             // * Verify the incident RHS is open.
//             cy.get('#rhsContainer').should('exist').within(() => {
//                 cy.findByTestId('rhs-title').should('exist').within(() => {
//                     cy.findByText(incidentName).should('exist');
//                 });
//             });

//             // # Open town-square from the LHS.
//             cy.get('#sidebarItem_town-square').click();

//             // * Verify the rhs list is open and we can see the new incident
//             cy.get('#rhsContainer').should('exist').within(() => {
//                 cy.findByText('Your Ongoing Incidents').should('exist');

//                 cy.findByText(incidentName).should('exist');
//             });

//             // # click the Start Incident link
//             cy.get('#rhsContainer').within(() => {
//                 cy.findByText('Start Incident').click();
//             });

//             // * Verify the incident creation dialog has opened
//             cy.get('#interactiveDialogModal').should('exist').within(() => {
//                 cy.findByText('Incident Details').should('exist');
//             });
//         });

//         it('should be able to create playbook from three dot menu', () => {
//             // # Navigate directly to a non-incident channel
//             cy.visit(`/${teamName1}/channels/town-square`);

//             // # Ensure the channel is loaded before continuing (allows redux to sync).
//             cy.get('#centerChannelFooter').findByTestId('post_textbox').should('exist');

//             // # Click the incident icon
//             cy.get('#channel-header').within(() => {
//                 cy.get('#incidentIcon').should('exist').click();
//             });

//             // # click the Start Incident link
//             cy.get('#rhsContainer').find('.icon-dots-vertical').click();

//             // # click the Create Playbook link
//             cy.get('#rhsContainer').within(() => {
//                 cy.findByText('Create Playbook').click();
//             });

//             // * Verify we reached the playbook backstage
//             cy.url()
//                 .should('include', `/${teamName1}/com.mattermost.plugin-incident-management/playbooks`);
//         });

//         it('should be able to go to incident backstage from three dot menu', () => {
//             // # Navigate directly to a non-incident channel
//             cy.visit(`/${teamName1}/channels/town-square`);

//             // # Ensure the channel is loaded before continuing (allows redux to sync).
//             cy.get('#centerChannelFooter').findByTestId('post_textbox').should('exist');

//             // # Click the incident icon
//             cy.get('#channel-header').within(() => {
//                 cy.get('#incidentIcon').should('exist').click();
//             });

//             // # click the Start Incident link
//             cy.get('#rhsContainer').find('.icon-dots-vertical').click();

//             // # click the Create Playbook link
//             cy.get('#rhsContainer').within(() => {
//                 cy.findByText('See all Incidents').click();
//             });

//             // * Verify we reached the playbook backstage
//             cy.url()
//                 .should('include', `/${teamName1}/com.mattermost.plugin-incident-management/incidents`);
//         });

//         it('should be able to see all incidents (incidents backstage list)', () => {
//             // # Navigate directly to a non-incident channel
//             cy.visit(`/${teamName1}/channels/town-square`);

//             // # Ensure the channel is loaded before continuing (allows redux to sync).
//             cy.get('#centerChannelFooter').findByTestId('post_textbox').should('exist');

//             // # Click the incident icon
//             cy.get('#channel-header').within(() => {
//                 cy.get('#incidentIcon').should('exist').click();
//             });

//             // # click the Start Incident link
//             cy.get('#rhsContainer').within(() => {
//                 cy.get('a').within(() => {
//                     cy.findByText('Click here').click();
//                 });
//             });

//             // * Verify we reached the playbook backstage
//             cy.url()
//                 .should('include', `/${teamName1}/com.mattermost.plugin-incident-management/incidents`);
//         });
//     });

//     describe('Last updated', () => {
//         it('should update when in incident channel', () => {
//             // # Navigate directly to a non-incident channel
//             cy.visit(`/${teamName1}/channels/town-square`);

//             // # Ensure the channel is loaded before continuing (allows redux to sync).
//             cy.get('#centerChannelFooter').findByTestId('post_textbox').should('exist');

//             // # start new incident
//             const now = Date.now();
//             const incidentName = 'Incident (' + now + ')';
//             cy.apiStartIncident({
//                 teamId: teamId1,
//                 playbookId: playbookId1,
//                 incidentName,
//                 commanderUserId: userId
//             });
//             cy.verifyIncidentActive(teamId1, incidentName);

//             // # Open the incident channel from the LHS.
//             cy.uiSwitchChannel(incidentName);

//             // # Ensure the channel is loaded before continuing (allows redux to sync).
//             cy.get('#centerChannelFooter').findByTestId('post_textbox').should('exist');

//             // * Verify the incident RHS is open.
//             cy.get('#rhsContainer').should('exist').within(() => {
//                 cy.findByTestId('rhs-title').should('exist').within(() => {
//                     cy.findByText(incidentName).should('exist');
//                 });

//                 // # Click the back button
//                 cy.findByTestId('back-button').should('exist').click();
//             });

//             // * Verify the rhs list is open and we can see the new incident
//             cy.get('#rhsContainer').should('exist').within(() => {
//                 cy.findByText('Your Ongoing Incidents').should('exist');

//                 cy.get('.scrollbar--view').scrollIntoView();

//                 cy.findByText(incidentName).should('exist');

//                 // * Verify the last updated is blank
//                 cy.findAllByText('Last updated:').eq(0).should('exist')
//                     .next().should('have.text', '-');
//             });

//             // # Update the status
//             cy.updateStatus('Status update 1');

//             // * verify the last updated time is updated
//             cy.get('#rhsContainer').should('exist').within(() => {
//                 cy.findByText('Your Ongoing Incidents').should('exist');

//                 cy.get('.scrollbar--view').scrollIntoView();

//                 cy.findByText(incidentName).should('exist');

//                 // * Verify the last updated is updated
//                 cy.findAllByText('Last updated:').eq(0).should('exist')
//                     .next().should('have.text', '< 1m ago');
//             });
//         });

//         it('should update when in another incident channel', () => {
//             // # Navigate directly to a non-incident channel
//             cy.visit(`/${teamName1}/channels/town-square`);

//             // # Ensure the channel is loaded before continuing (allows redux to sync).
//             cy.get('#centerChannelFooter').findByTestId('post_textbox').should('exist');

//             // # start new incident
//             const now = Date.now();
//             const incidentName = 'Incident (' + now + ')';
//             const incidentChannelName = 'incident-' + now;
//             cy.apiStartIncident({
//                 teamId: teamId1,
//                 playbookId: playbookId1,
//                 incidentName,
//                 commanderUserId: userId
//             })
//                 .then((incident) => {
//                     const incidentId = incident.id;

//                     cy.verifyIncidentActive(teamId1, incidentName);

//                     // # Open the incident channel from the LHS.
//                     cy.uiSwitchChannel(incidentName);

//                     // # Ensure the channel is loaded before continuing (allows redux to sync).
//                     cy.get('#centerChannelFooter').findByTestId('post_textbox').should('exist');

//                     // * Verify the incident RHS is open.
//                     cy.get('#rhsContainer').should('exist').within(() => {
//                         cy.findByTestId('rhs-title').should('exist').within(() => {
//                             cy.findByText(incidentName).should('exist');
//                         });

//                         // # Click the back button
//                         cy.findByTestId('back-button').should('exist').click();
//                     });

//                     // * Verify the rhs list is open and we can see the new incident
//                     cy.get('#rhsContainer').should('exist').within(() => {
//                         cy.findByText('Your Ongoing Incidents').should('exist');

//                         cy.get('.scrollbar--view').scrollIntoView();

//                         cy.findByText(incidentName).should('exist');

//                         // * Verify the last updated is blank
//                         cy.findAllByText('Last updated:').eq(0).should('exist')
//                             .next().should('have.text', '-');
//                     });

//                     // # Update the status
//                     cy.apiGetChannelByName(teamName1, incidentChannelName).then(({channel}) => {
//                         const channelId = channel.id;

//                         cy.apiUpdateStatus({
//                             incidentId,
//                             userId,
//                             channelId,
//                             teamId: teamId1,
//                             message: 'Status update 2',
//                             description: 'description',
//                             status: 'Active',
//                         });

//                         // * verify the last updated time is updated
//                         cy.get('#rhsContainer').should('exist').within(() => {
//                             cy.findByText('Your Ongoing Incidents').should('exist');

//                             cy.get('.scrollbar--view').scrollIntoView();

//                             cy.findByText(incidentName).should('exist');

//                             // * Verify the last updated is updated
//                             cy.findAllByText('Last updated:').eq(0).should('exist')
//                                 .next().should('have.text', '< 1m ago');
//                         });
//                     });
//                 });
//         });
//     });
// });
