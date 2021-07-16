// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {HALF_SEC} from '../../../fixtures/timeouts';

describe('timeline', () => {
    const playbookName = 'Playbook (' + Date.now() + ')';
    let teamId;
    let teamName;
    let userId;
    let playbookId;
    let playbookRunName;
    let channelName;
    let channelId;

    before(() => {
        // # Login as the sysadmin
        cy.apiLogin('sysadmin');

        // # Create a new team for the welcome page test
        cy.apiCreateTeam('team', 'Team').then(({team}) => {
            teamName = team.name;
            teamId = team.id;

            // # Add user-1 to team
            cy.apiGetUserByEmail('user-1@sample.mattermost.com').then(({user}) => {
                cy.apiAddUserToTeam(team.id, user.id);
            });

            // # Add aaron.peterson to team
            cy.apiGetUserByEmail('user-7@sample.mattermost.com').then(({user}) => {
                cy.apiAddUserToTeam(team.id, user.id);
            });

            // # Login as user-1
            cy.apiLogin('user-1');

            // # Create a playbook
            cy.apiGetCurrentUser().then((user) => {
                userId = user.id;

                cy.apiCreatePlaybook({
                    teamId: team.id,
                    title: playbookName,
                    checklists: [{
                        title: 'Stage 1',
                        items: [
                            {title: 'Step 1'},
                            {title: 'Step 2', command: '/echo VALID'},
                        ],
                    }],
                    memberIDs: [
                        user.id,
                    ],
                }).then((playbook) => {
                    playbookId = playbook.id;
                });
            });
        });
    });

    beforeEach(() => {
        // # Size the viewport to show the RHS without covering posts.
        cy.viewport('macbook-13');

        // # Login as user-1
        cy.apiLogin('user-1');

        // # Create a new playbook run
        const now = Date.now();
        playbookRunName = 'Playbook Run (' + now + ')';
        channelName = 'playbook-run-' + now;
        cy.apiRunPlaybook({
            teamId,
            playbookId,
            playbookRunName,
            ownerUserId: userId,
        });

        cy.apiGetChannelByName(teamName, channelName).then(({channel}) => {
            channelId = channel.id;
        });

        // # Navigate directly to the application and the playbook run channel
        cy.visit(`/${teamName}/channels/${channelName}`);

        // # Add @aaron.peterson
        cy.apiGetUserByEmail('user-7@sample.mattermost.com').then(({user: aaron}) => {
            cy.apiAddUserToChannel(channelId, aaron.id);
        });

        // * Verify the playbook run RHS is open.
        cy.get('#rhsContainer').should('exist').within(() => {
            cy.findByText(playbookRunName).should('exist');

            // # Select the timeline tab
            cy.findByTestId('timeline').click();
        });
    });

    describe('timeline updates', () => {
        it('show the playbook run created, status updated, owner changed, and checklist events', () => {
            // * Verify playbook run created message is visible in the timeline
            verifyTimelineEvent('incident_created', 1, 0, 'Run started by user-1');

            // # Post an update that doesn't change the playbook run status
            cy.updateStatus('this is a status update');

            // * Verify we can see the update in the timeline
            verifyTimelineEvent('status_updated', 1, 0, 'user-1 posted a status update');

            // # Change owner
            cy.executeSlashCommand('/playbook owner @aaron.peterson');

            // * Verify we can see the change owner in the timeline
            verifyTimelineEvent('owner_changed', 1, 0, 'Owner changed from @user-1 to @aaron.peterson');

            // # Post an update that changes the playbook run status
            cy.updateStatus('this is a status update', 0, 'Active');

            // * Verify we can see the update in the timeline
            verifyTimelineEvent('status_updated', 2, 1, 'user-1 changed status from Reported to Active');

            // # Change owner
            cy.executeSlashCommand('/playbook owner @user-1');

            // * Verify we can see the change owner in the timeline
            verifyTimelineEvent('owner_changed', 2, 1, 'Owner changed from @aaron.peterson to @user-1');

            // # Select the checklists tab
            cy.findByTestId('checklists').click();

            // # Click the first task
            cy.get('[type="checkbox"]').first().check();

            // # Select the timeline tab
            cy.findByTestId('timeline').click();

            // * Verify we can see the task event in the timeline
            clickOnFilterOption('All events');
            verifyTimelineEvent('task_state_modified', 1, 1, 'user-1 checked off checklist item "Step 1"');
        });
    });

    describe('events from posts in the playbook run channel ', () => {
        it('show up at the end and in the middle of the timeline', () => {
            // # Post the first message we'll click on
            cy.apiCreatePost(channelId, 'this is the first post').then(({post}) => {
                // # Change owner, to create a timeline event
                cy.executeSlashCommand('/playbook owner @aaron.peterson');

                // * Verify we can see the change owner in the timeline
                verifyTimelineEvent('owner_changed', 1, 0, 'Owner changed from @user-1 to @aaron.peterson');

                // # Post the second message we'll click on
                cy.createPost('this is the second post we\'ll click on');

                // # Add a timeline event from a post at the end of the playbook run
                const summary1 = 'This is the playbook run summary 1';
                cy.addPostToTimelineUsingPostMenu(playbookRunName, summary1);

                // * Verify we can see the new timeline event
                verifyTimelineEvent('event_from_post', 1, 0, summary1);

                // # Add a timeline event from a post near the start of the playbook run
                const summary2 = 'This is the playbook run summary 2';
                cy.addPostToTimelineUsingPostMenu(playbookRunName, summary2, post.id);

                // * Verify we can see the new timeline event
                verifyTimelineEvent('event_from_post', 2, 0, summary2);
            });
        });
    });

    describe('events from posts in another channel ', () => {
        it('show up at the end and in the middle of the timeline', () => {
            const summary1 = 'This is the playbook run summary 1';
            const summary2 = 'This is the playbook run summary 2';

            cy.apiCreateChannel(teamId, 'test-channel', 'Test Channel', 'O').then(({channel}) => {
                // # Navigate to our new channel
                cy.visit(`/${teamName}/channels/${channel.name}`);

                cy.apiCreatePost(channel.id, 'this is the first post').then(({post}) => {
                    // # Post the second message we'll click on
                    cy.createPost('this is the second post we\'ll click on');

                    // # Add a timeline event from a post at the end of the playbook run
                    cy.addPostToTimelineUsingPostMenu(playbookRunName, summary1);

                    // # Add a timeline event from a post near the start of the playbook run
                    cy.addPostToTimelineUsingPostMenu(playbookRunName, summary2, post.id);
                });
            });

            // # Navigate back to the playbook run channel
            cy.visit(`/${teamName}/channels/${channelName}`);

            // * Verify the playbook run RHS is open.
            cy.get('#rhsContainer').should('exist').within(() => {
                cy.findByText(playbookRunName).should('exist');

                // # Select the timeline tab
                cy.findByTestId('timeline').click();
            });

            // * Verify we can see the new timeline event
            verifyTimelineEvent('event_from_post', 2, 1, summary1);

            // * Verify we can see the new timeline event
            verifyTimelineEvent('event_from_post', 2, 0, summary2);
        });
    });

    describe('timeline updates', () => {
        it('can be deleted (both standard events and events from posts)', () => {
            // * Verify playbook run created message is visible in the timeline
            verifyTimelineEvent('incident_created', 1, 0, 'Run started by user-1');

            // # Post an update that doesn't change the playbook run status
            cy.updateStatus('this is a status update');

            // * Verify we can see the update in the timeline
            verifyTimelineEvent('status_updated', 1, 0, 'user-1 posted a status update');

            // # Change owner
            cy.executeSlashCommand('/playbook owner @aaron.peterson');

            // * Verify we can see the change owner in the timeline
            verifyTimelineEvent('owner_changed', 1, 0, 'Owner changed from @user-1 to @aaron.peterson');

            // # Post an update that changes the playbook run status
            cy.updateStatus('this is a status update', 0, 'Active');

            // * Verify we can see the update in the timeline
            verifyTimelineEvent('status_updated', 2, 1, 'user-1 changed status from Reported to Active');

            // # Change owner
            cy.executeSlashCommand('/playbook owner @user-1');

            // * Verify we can see the change owner in the timeline
            verifyTimelineEvent('owner_changed', 2, 1, 'Owner changed from @aaron.peterson to @user-1');

            // # Post the message we'll click on
            cy.createPost('this is the first post we\'ll click on');

            // # Add a timeline event from a post at the end of the playbook run
            const summary1 = 'This is the playbook run summary 1';
            cy.addPostToTimelineUsingPostMenu(playbookRunName, summary1);

            // * Delete the custom event
            removeTimelineEvent('event_from_post', 1, 0, summary1);

            // * Delete the playbook run created event
            removeTimelineEvent('incident_created', 1, 0, 'Run started by user-1');

            // * Delete the second status update
            removeTimelineEvent('status_updated', 2, 1, 'user-1 changed status from Reported to Active');

            // * Delete the first owner change
            removeTimelineEvent('owner_changed', 2, 0, 'Owner changed from @user-1 to @aaron.peterson');

            // * Delete the first status update
            removeTimelineEvent('status_updated', 1, 0, 'user-1 posted a status update');

            // * Delete the second owner change
            removeTimelineEvent('owner_changed', 1, 0, 'Owner changed from @aaron.peterson to @user-1');
        });
    });

    describe('timeline notice', () => {
        it('shows when there are no events', () => {
            // * See all events:
            clickOnFilterOption('All events');

            // * Verify playbook run created message is visible in the timeline
            verifyTimelineEvent('incident_created', 1, 0, 'Run started by user-1');

            // * Delete the playbook run created event
            removeTimelineEvent('incident_created', 1, 0, 'Run started by user-1');

            // * Verify user joined message is visible in the timeline
            verifyTimelineEvent('user_joined_left', 3, 0, '@playbook joined the channel');

            // * Delete the user joined message
            removeTimelineEvent('user_joined_left', 3, 0, '@playbook joined the channel');

            // * Verify user joined message is visible in the timeline
            verifyTimelineEvent('user_joined_left', 2, 0, '@user-1 joined the channel');

            // * Delete the user joined message
            removeTimelineEvent('user_joined_left', 2, 0, '@user-1 joined the channel');

            // * Verify user joined message is visible in the timeline
            verifyTimelineEvent('user_joined_left', 1, 0, '@aaron.peterson joined the channel');

            // * Delete the user joined message
            removeTimelineEvent('user_joined_left', 1, 0, '@aaron.peterson joined the channel');

            // * Verify notice is shown
            cy.get('#rhsContainer').within(() => {
                cy.findByText('Timeline events are displayed here as they occur. Hover over an event to remove it.')
                    .should('exist');
            });
        });
    });

    describe('timeline filter', () => {
        it('shows each type, and all', () => {
            // # Post an update that doesn't change the playbook run status
            cy.updateStatus('this is a status update');

            // # Change owner
            cy.executeSlashCommand('/playbook owner @aaron.peterson');

            // # Post an update that changes the playbook run status
            cy.updateStatus('this is a status update', 0, 'Active');

            // # Post the message we'll click on
            cy.createPost('this is the first post we\'ll click on');

            // # Add a timeline event from a post at the end of the playbook run
            const summary1 = 'This is the playbook run summary 1';
            cy.addPostToTimelineUsingPostMenu(playbookRunName, summary1);

            // # Change owner
            cy.executeSlashCommand('/playbook owner @user-1');

            // # Select the checklists tab
            cy.findByTestId('checklists').click();

            // # Click the first task
            cy.get('[type="checkbox"]').first().check();

            // # Run the second slash command
            cy.findAllByTestId('run').eq(0).click();

            // # Assign Aaron to the first task
            cy.findAllByTestId('checkbox-item-container').eq(1).trigger('mouseover').within(() => {
                cy.get('.icon-account-plus-outline').click().wait(HALF_SEC);
                cy.get('.playbook-run-user-select__input > input')
                    .type('aaron', {force: true, delay: 100})
                    .wait(100).type('{enter}');
            });

            // # Select the timeline tab
            cy.findByTestId('timeline').click();

            // # Remove default options
            clickOnFilterOption('Role changes');
            clickOnFilterOption('Status updates');
            clickOnFilterOption('Events from posts');

            // # Filter to Owner Changed only
            clickOnFilterOption('Role changes');
            verifyTimelineEvent('owner_changed', 2, 0, 'Owner changed from @user-1 to @aaron.peterson');
            verifyTimelineEvent('owner_changed', 2, 1, 'Owner changed from @aaron.peterson to @user-1');
            cy.findAllByTestId(/timeline-item .*/).should('have.length', 2);
            clickOnFilterOption('Role changes');

            // # Filter to Status Updates only
            clickOnFilterOption('Status updates');
            verifyTimelineEvent('status_updated', 2, 0, 'user-1 posted a status update');
            verifyTimelineEvent('status_updated', 2, 1, 'user-1 changed status from Reported to Active');
            cy.findAllByTestId(/timeline-item .*/).should('have.length', 3);
            clickOnFilterOption('Status updates');

            // # Filter to Events From Posts only
            clickOnFilterOption('Events from posts');
            verifyTimelineEvent('event_from_post', 1, 0, summary1);
            cy.findAllByTestId(/timeline-item .*/).should('have.length', 1);
            clickOnFilterOption('Events from posts');

            // # Filter to Tasks only
            clickOnFilterOption('Task state changes');
            verifyTimelineEvent('task_state_modified', 1, 0, 'user-1 checked off checklist item "Step 1"');
            cy.findAllByTestId(/timeline-item .*/).should('have.length', 1);
            clickOnFilterOption('Task state changes');

            // * Filter to Task Assignee Changed only
            clickOnFilterOption('Task assignments');
            verifyTimelineEvent('assignee_changed', 1, 0, 'Assignee Changed');
            cy.findAllByTestId(/timeline-item .*/).should('have.length', 1);
            clickOnFilterOption('Task assignments');

            // * Filter to Slash Commands only
            clickOnFilterOption('Slash commands');
            verifyTimelineEvent('ran_slash_command', 1, 0, 'Slash Command Executed');
            cy.findAllByTestId(/timeline-item .*/).should('have.length', 1);
            clickOnFilterOption('Slash commands');

            // # Click a couple options to makes sure All below works even when some are selected
            clickOnFilterOption('Status updates');
            clickOnFilterOption('Task state changes');

            // * Verify we can see all events:
            clickOnFilterOption('All events');

            // * Verify all events are shown (incl. 3 user_joined_left events)
            cy.findAllByTestId(/timeline-item .*/).should('have.length', 12);
            verifyTimelineEvent('status_updated', 2, 0, 'user-1 posted a status update');
            verifyTimelineEvent('owner_changed', 2, 0, 'Owner changed from @user-1 to @aaron.peterson');
            verifyTimelineEvent('status_updated', 2, 1, 'user-1 changed status from Reported to Active');
            verifyTimelineEvent('owner_changed', 2, 1, 'Owner changed from @aaron.peterson to @user-1');
            verifyTimelineEvent('event_from_post', 1, 0, summary1);
            verifyTimelineEvent('task_state_modified', 1, 1, 'user-1 checked off checklist item "Step 1"');
            verifyTimelineEvent('assignee_changed', 1, 0, 'Assignee Changed');
            verifyTimelineEvent('ran_slash_command', 1, 0, 'Slash Command Executed');
        });
    });
});

const verifyTimelineEvent = (expectedEventType, expectedNumberOfEvents, expectedEventIndex, expectedEventSummary) => {
    // * Verify we have the expected number of events
    cy.findAllByTestId('timeline-item ' + expectedEventType)
        .should('have.length', expectedNumberOfEvents);

    // * Verify the target event exists with the expected summary text
    cy.findByText(expectedEventSummary).should('exist');
};

const removeTimelineEvent = (expectedEventType, expectedNumberOfEvents, expectedEventIndex, expectedEventSummary) => {
    // * Verify we have the expected number of events
    cy.findAllByTestId('timeline-item ' + expectedEventType)
        .should('have.length', expectedNumberOfEvents);

    // * Verify the target event exists with the expected summary text
    cy.findByText(expectedEventSummary).should('exist');

    // # Hover over the event
    cy.findAllByTestId('timeline-item ' + expectedEventType)
        .eq(expectedEventIndex)
        .trigger('mouseover');

    // # Click the trash
    cy.get('.icon-trash-can-outline').click();

    // # Press the delete entry button
    cy.get('#confirmModalButton').contains('Delete Entry').click();

    // # Verify we have one fewer event
    cy.findAllByTestId('timeline-item ' + expectedEventType)
        .should('have.length', expectedNumberOfEvents - 1);

    // * Verify the target event does not exist with the expected summary text
    cy.findByText(expectedEventSummary).should('not.exist');
};

const clickOnFilterOption = (option) => {
    cy.get('#rhsContainer').within(() => {
        // # Show filter menu
        cy.get('.icon-filter-variant').click();

        cy.findByTestId('dropdownmenu').within(() => {
            // # Click on desired filter
            cy.findByText(option).click();
        });

        // # Hide menu
        cy.findByTestId('timeline').click();
    });
};
