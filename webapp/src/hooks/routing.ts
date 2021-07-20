import qs from 'qs';
import {useMemo} from 'react';

import {Team} from 'mattermost-redux/types/teams';

import {navigateToTeamPluginUrl, teamPluginUrl} from 'src/browser_routing';
import {TEMPLATE_TITLE_KEY} from 'src/constants';
import {Playbook} from 'src/types/playbook';
import {tabInfo} from 'src/components/backstage/playbook_edit';

export function usePlaybooksRouting<TArg extends Playbook | Playbook['id']>(
    teamName: Team['name'],
    {urlOnly, onGo}: {urlOnly?: boolean, onGo?: (arg: TArg) => void} = {},
) {
    return useMemo(() => {
        function go(path: string, p?: TArg) {
            if (!urlOnly) {
                if (p) {
                    onGo?.(p);
                }
                navigateToTeamPluginUrl(teamName, path);
            }
            return teamPluginUrl(teamName, path);
        }

        function id(p: Playbook | Playbook['id']) {
            return p && typeof p !== 'string' ? p.id : p;
        }

        return {
            edit: (p: TArg, tabId?: typeof tabInfo[number]['id']) => {
                return go(`/playbooks/${id(p)}/edit${tabId ? `/${tabId}` : ''}`, p);
            },
            view: (p: TArg) => {
                return go(`/playbooks/${id(p)}`, p);
            },
            create: (templateTitle?: string) => {
                const queryParams = qs.stringify({[TEMPLATE_TITLE_KEY]: templateTitle}, {addQueryPrefix: true});
                return go(`/playbooks/new${queryParams}`);
            },
        };
    }, [teamName, onGo, urlOnly]);
}
