// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {UserProfile} from 'mattermost-redux/types/users';
import {ChannelWithTeamData} from 'mattermost-redux/types/channels';

import {ChecklistDetails} from 'src/components/checklist/checklist';

import {Incident} from 'src/types/incident';
import {Checklist, ChecklistItem} from 'src/types/playbook';

import Profile from 'src/components/rhs/profile';

import Link from 'src/components/rhs/link';

// @ts-ignore
const WebappUtils = window.WebappUtils;

import './incident_details.scss';
import {isMobile} from 'src/utils/utils';

interface Props {
    incident: Incident;
    commander: UserProfile;
    profileUri: string;
    channelDetails: ChannelWithTeamData[];
    viewingIncidentChannel: boolean;
    involvedInIncident: boolean;
    teamName: string;
    actions: {
        endIncident: () => void;
        modifyChecklistItemState: (incidentID: string, checklistNum: number, itemNum: number, checked: boolean) => void;
        addChecklistItem: (incidentID: string, checklistNum: number, checklistItem: ChecklistItem) => void;
        removeChecklistItem: (incidentID: string, checklistNum: number, itemNum: number) => void;
        renameChecklistItem: (incidentID: string, checklistNum: number, itemNum: number, newtitle: string) => void;
        reorderChecklist: (incidentID: string, checklistNum: number, itemNum: number, newPosition: number) => void;
        toggleRHS: () => void;
    };
}

export default class IncidentDetails extends React.PureComponent<Props> {
    private moveToDM(userName: string) {
        WebappUtils.browserHistory.push(`/${this.props.teamName}/messages/@${userName}`);
        if (isMobile()) {
            this.props.actions.toggleRHS();
        }
    }

    public render(): JSX.Element {
        return (
            <div className='IncidentDetails'>
                <div className='inner-container'>
                    <div className='title'>{'Commander'}</div>
                    <Profile
                        userId={this.props.incident.commander_user_id}
                    />
                </div>

                {this.props.incident.playbook.checklists.map((checklist: Checklist, index: number) => (
                    <ChecklistDetails
                        checklist={checklist}
                        enableEdit={this.props.involvedInIncident && this.props.viewingIncidentChannel}
                        key={checklist.title + index}
                        onChange={(itemNum: number, checked: boolean) => {
                            this.props.actions.modifyChecklistItemState(this.props.incident.id, index, itemNum, checked);
                        }}
                        addItem={(checklistItem: ChecklistItem) => {
                            this.props.actions.addChecklistItem(this.props.incident.id, index, checklistItem);
                        }}
                        removeItem={(itemNum: number) => {
                            this.props.actions.removeChecklistItem(this.props.incident.id, index, itemNum);
                        }}
                        editItem={(itemNum: number, newTitle: string) => {
                            this.props.actions.renameChecklistItem(this.props.incident.id, index, itemNum, newTitle);
                        }}
                        reorderItems={(itemNum: number, newPosition: number) => {
                            this.props.actions.reorderChecklist(this.props.incident.id, index, itemNum, newPosition);
                        }}
                    />
                ))}

                {
                    this.props.involvedInIncident &&
                    <div className='inner-container'>
                        <div className='title'>{'Channels'}</div>
                        {
                            this.props.channelDetails.map((channel: ChannelWithTeamData) => (
                                <Link
                                    key={channel.id}
                                    to={`/${channel.team_name}/channels/${channel.name}`}
                                    text={channel.display_name}
                                />
                            ))
                        }
                    </div>
                }

                {
                    this.props.involvedInIncident &&
                    <div className='footer-div'>
                        <button
                            className='btn btn-primary'
                            onClick={() => this.props.actions.endIncident()}
                            disabled={!this.props.viewingIncidentChannel}
                        >
                            {'End Incident'}
                        </button>
                        {
                            this.props.involvedInIncident && !this.props.viewingIncidentChannel &&
                            <div className='help-text'>
                                {'Go to '}
                                <Link
                                    to={`/${this.props.channelDetails[0].team_name}/channels/${this.props.channelDetails[0].name}`}
                                    text={'the incident channel'}
                                />
                                {' to make changes.'}
                            </div>
                        }
                    </div>
                }

                {
                    !this.props.involvedInIncident &&
                    <div className='footer-div'>
                        <div className='help-text'>
                            {'You are not part of the incident, contact '}
                            <a
                                onClick={() => this.moveToDM(this.props.commander.username)}
                            >
                                {'@' + this.props.commander.username}
                            </a>
                            {' to request access. '}
                        </div>
                    </div>
                }
            </div>
        );
    }
}
