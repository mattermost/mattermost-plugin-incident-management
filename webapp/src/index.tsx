// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {Store, Unsubscribe} from 'redux';
import {debounce} from 'debounce';

import {GlobalState} from 'mattermost-redux/types/store';

//@ts-ignore Webapp imports don't work properly
import {PluginRegistry} from 'mattermost-webapp/plugins/registry';
import WebsocketEvents from 'mattermost-redux/constants/websocket';

import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';

import {makeRHSOpener} from 'src/rhs_opener';
import {makeSlashCommandHook} from 'src/slash_command';

import {RetrospectiveFirstReminder, RetrospectiveReminder} from './components/retrospective_reminder_posts';

import {pluginId} from './manifest';
import ChannelHeaderButton from './components/assets/icons/channel_header_button';
import RightHandSidebar from './components/rhs/rhs_main';
import RHSTitle from './components/rhs/rhs_title';
import {AttachToPlaybookRunPostMenu, StartPlaybookRunPostMenu} from './components/post_menu';
import Backstage from './components/backstage/backstage';
import ErrorPage from './components/error_page';
import PostMenuModal from './components/post_menu_modal';
import {
    setToggleRHSAction, actionSetGlobalSettings,
} from './actions';
import reducer from './reducer';
import {
    handleReconnect,
    handleWebsocketPlaybookRunUpdated,
    handleWebsocketPlaybookRunCreated,
    handleWebsocketPlaybookCreated,
    handleWebsocketPlaybookDeleted,
    handleWebsocketUserAdded,
    handleWebsocketUserRemoved,
    handleWebsocketPostEditedOrDeleted,
    handleWebsocketChannelUpdated, handleWebsocketChannelViewed,
} from './websocket_events';
import {
    WEBSOCKET_PLAYBOOK_RUN_UPDATED,
    WEBSOCKET_PLAYBOOK_RUN_CREATED,
    WEBSOCKET_PLAYBOOK_CREATED,
    WEBSOCKET_PLAYBOOK_DELETED,
} from './types/websocket_events';
import RegistryWrapper from './registry_wrapper';
import SystemConsoleEnabledTeams from './system_console_enabled_teams';
import {makeUpdateMainMenu} from './make_update_main_menu';
import {fetchGlobalSettings} from './client';
import {CloudUpgradePost} from './components/cloud_upgrade_post';
import {teamPluginUrl} from './browser_routing';

const GlobalHeaderIcon = () => {
    return (
        <svg
            width='24'
            height='24'
            viewBox='0 0 24 24'
            fill='none'
            xmlns='http://www.w3.org/2000/svg'
        >
            <path
                fillRule='evenodd'
                clipRule='evenodd'
                d='M1.55148 11.4515C1.08286 11.9201 1.08285 12.6799 1.55148 13.1486L7.58707 19.1841C8.05569 19.6528 8.81549 19.6528 9.28412 19.1841L11.8233 16.645L14.3625 19.1841C14.8311 19.6528 15.5909 19.6528 16.0595 19.1841L22.0951 13.1486C22.5637 12.6799 22.5637 11.9201 22.0951 11.4515L16.0595 5.41593C15.5909 4.9473 14.8311 4.9473 14.3625 5.41592L11.8233 7.9551L9.28412 5.41593C8.81549 4.9473 8.0557 4.9473 7.58707 5.41592L1.55148 11.4515ZM11.8233 7.9551L8.3269 11.4515C7.85827 11.9201 7.85827 12.6799 8.3269 13.1486L11.8233 16.645L15.3197 13.1486C15.7883 12.6799 15.7883 11.9201 15.3197 11.4515L11.8233 7.9551Z'
                fill='green'
            />
        </svg>
    );
};

const TestComponent = () => {
    return (
        <div>
            {'This is Playbooks'}
        </div>
    );
};

export default class Plugin {
    removeMainMenuSub?: Unsubscribe;
    removeRHSListener?: Unsubscribe;

    public initialize(registry: PluginRegistry, store: Store<GlobalState>): void {
        registry.registerReducer(reducer);

        const updateMainMenuAction = makeUpdateMainMenu(registry, store);
        updateMainMenuAction();

        // Would rather use a saga and listen for ActionTypes.UPDATE_MOBILE_VIEW.
        window.addEventListener('resize', debounce(updateMainMenuAction, 300));
        this.removeMainMenuSub = store.subscribe(updateMainMenuAction);

        registry.registerAdminConsoleCustomSetting('EnabledTeams', SystemConsoleEnabledTeams, {showTitle: true});

        // Grab global settings
        const getGlobalSettings = async () => {
            store.dispatch(actionSetGlobalSettings(await fetchGlobalSettings()));
        };
        getGlobalSettings();

        if (registry.registerProduct) {
            registry.registerProduct(
                '/playbooks',
                GlobalHeaderIcon,
                'Playbooks',
                '/playbooks',
                Backstage,
                TestComponent,
            );
        }

        const doRegistrations = () => {
            const r = new RegistryWrapper(registry, store);

            const {toggleRHSPlugin} = r.registerRightHandSidebarComponent(RightHandSidebar,
                <RHSTitle/>);
            const boundToggleRHSAction = (): void => store.dispatch(toggleRHSPlugin);

            // Store the toggleRHS action to use later
            store.dispatch(setToggleRHSAction(boundToggleRHSAction));

            r.registerChannelHeaderButtonAction(ChannelHeaderButton, boundToggleRHSAction, 'Playbook', 'Playbook');
            r.registerPostDropdownMenuComponent(StartPlaybookRunPostMenu);
            r.registerPostDropdownMenuComponent(AttachToPlaybookRunPostMenu);
            r.registerRootComponent(PostMenuModal);

            r.registerReconnectHandler(handleReconnect(store.getState, store.dispatch));
            r.registerWebSocketEventHandler(WEBSOCKET_PLAYBOOK_RUN_UPDATED, handleWebsocketPlaybookRunUpdated(store.getState, store.dispatch));
            r.registerWebSocketEventHandler(WEBSOCKET_PLAYBOOK_RUN_CREATED, handleWebsocketPlaybookRunCreated(store.getState, store.dispatch));
            r.registerWebSocketEventHandler(WEBSOCKET_PLAYBOOK_CREATED, handleWebsocketPlaybookCreated(store.getState, store.dispatch));
            r.registerWebSocketEventHandler(WEBSOCKET_PLAYBOOK_DELETED, handleWebsocketPlaybookDeleted(store.getState, store.dispatch));
            r.registerWebSocketEventHandler(WebsocketEvents.USER_ADDED, handleWebsocketUserAdded(store.getState, store.dispatch));
            r.registerWebSocketEventHandler(WebsocketEvents.USER_REMOVED, handleWebsocketUserRemoved(store.getState, store.dispatch));
            r.registerWebSocketEventHandler(WebsocketEvents.POST_DELETED, handleWebsocketPostEditedOrDeleted(store.getState, store.dispatch));
            r.registerWebSocketEventHandler(WebsocketEvents.POST_EDITED, handleWebsocketPostEditedOrDeleted(store.getState, store.dispatch));
            r.registerWebSocketEventHandler(WebsocketEvents.CHANNEL_UPDATED, handleWebsocketChannelUpdated(store.getState, store.dispatch));
            r.registerWebSocketEventHandler(WebsocketEvents.CHANNEL_VIEWED, handleWebsocketChannelViewed(store.getState, store.dispatch));

            // Listen for channel changes and open the RHS when appropriate.
            if (this.removeRHSListener) {
                this.removeRHSListener();
            }
            this.removeRHSListener = store.subscribe(makeRHSOpener(store));

            r.registerSlashCommandWillBePostedHook(makeSlashCommandHook(store));

            r.registerNeedsTeamRoute('/error', ErrorPage);
            r.registerNeedsTeamRoute('/', Backstage);

            r.registerPostTypeComponent('custom_retro_rem_first', RetrospectiveFirstReminder);
            r.registerPostTypeComponent('custom_retro_rem', RetrospectiveReminder);
            r.registerPostTypeComponent('custom_cloud_upgrade', CloudUpgradePost);

            return r.unregister;
        };

        // Listen for license changes and update the UI appropriately. This is the only websocket
        // listener that stays active all the time, regardless of license.
        let registered = false;
        let unregister: () => void;
        const checkRegistrations = () => {
            updateMainMenuAction();

            if (!registered) {
                unregister = doRegistrations();
                registered = true;
            } else if (unregister) {
                unregister();
                registered = false;
            }
        };
        registry.registerWebSocketEventHandler(WebsocketEvents.LICENSE_CHANGED, checkRegistrations);
        checkRegistrations();
    }

    public uninitialize() {
        if (this.removeMainMenuSub) {
            this.removeMainMenuSub();
            delete this.removeMainMenuSub;
        }
        if (this.removeRHSListener) {
            this.removeRHSListener();
            delete this.removeRHSListener;
        }
    }
}

// @ts-ignore
window.registerPlugin(pluginId, new Plugin());
