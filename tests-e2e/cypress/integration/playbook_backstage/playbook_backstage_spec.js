// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

/*
 * This test spec includes tests for playbooks backstage.
 */

import users from '../../fixtures/users.json';

describe('Playbook List View in Backstage', () => {
	beforeEach(() => {
		// # Login as non-admin user
		cy.apiLogin('user-1');

		cy.visit('/');
	});

	it('Has "Playbooks" and team name in heading', () => {
		// # Launch incident backstage
		cy.openIncidentBackstage();

		// # Switch to Playbooks backstage
		cy.findByTestId('playbooksLHSButton').click();

		// * Verify that the heading has "Playbooks" and the team's name -- eligendi
		cy.findByTestId('titlePlaybook').should('be.visible').contains('Playbooks');
		cy.findByTestId('titlePlaybook').contains('eligendi');
	});

	it('Redirects to /error if the playbook is unknown', () => {
		// # Visit the URL of a non-existing playbook
		cy.visit('/ad-1/com.mattermost.plugin-incident-response/playbooks/an_unknown_id');

		// * Verify that the user has been redirect to /error with type=playbooks
		cy.url().should('include', '/ad-1/com.mattermost.plugin-incident-response/error?type=playbooks');
	});
});
