// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import IncidentItem from 'src/components/rhs/incident_item';
import {Incident} from 'src/types/incident';

import IncidentListIcon from './list_icon';

// @ts-ignore
const {formatText, messageHtmlToComponent} = window.PostUtils;

interface Props {
    incidents: Incident[];
    onClick: (id: string) => void;
    actions: {
        startIncident: () => void;
    };
    theme: Record<string, string>;
}

export default class IncidentList extends React.PureComponent<Props> {
    public render(): JSX.Element {
        console.log('<><> IncidentList, theme:');
        console.log(this.props.theme);

        if (this.props.incidents.length === 0) {
            return (
                <div className='no-incidents'>
                    <div className='inner-text'>
                        <IncidentListIcon theme={this.props.theme}/>
                    </div>
                    <div className='inner-text'>
                        {'There are no active incidents yet.'}
                    </div>
                    <div className='inner-text'>
                        {messageHtmlToComponent(formatText('You can create incidents by the post dropdown menu, and by the slash command `/incident start`'))}
                    </div>
                    <a
                        className='link'
                        onClick={() => this.props.actions.startIncident()}
                    >
                        {'+ Create new incident'}
                    </a>
                </div>
            );
        }

        return (
            <div className='IncidentList'>
                {
                    this.props.incidents.map((i) => (
                        <IncidentItem
                            key={i.id}
                            incident={i}
                            onClick={() => this.props.onClick(i.id)}
                        />
                    ))
                }
            </div>
        );
    }
}
