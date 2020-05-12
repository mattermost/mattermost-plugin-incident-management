// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import moment from 'moment';
import {Tooltip, OverlayTrigger} from 'react-bootstrap';
import classNames from 'classnames';

import {ChannelWithTeamData} from 'mattermost-redux/types/channels';

import {Incident} from 'src/types/incident';

import Profile from 'src/components/profile';
import BackIcon from 'src/components/playbook/back_icon';
import StatusBadge from '../status_badge';

import './incident_details.scss';

// @ts-ignore
const WebappUtils = window.WebappUtils;

const OVERLAY_DELAY = 400;

interface Props {
    incident: Incident;
    involvedInIncident: boolean;
    totalMessages: number;
    membersCount: number;
    mainChannelDetails: ChannelWithTeamData;
    exportAvailable: boolean;
    onClose: () => void;
    actions: {
        closeModal: () => void;
    };
}

export default class BackstageIncidentDetails extends React.PureComponent<Props> {
    public timeFrameText = () => {
        const startedText = moment.unix(this.props.incident.created_at).format('DD MMM h:mmA');
        const endedText = this.props.incident.is_active ? 'Ongoing' : moment.unix(this.props.incident.ended_at).format('DD MMM h:mmA');

        return (`${startedText} - ${endedText}`);
    }

    public duration = () => {
        const endTime = this.props.incident.is_active ? moment() : moment.unix(this.props.incident.ended_at);

        const duration = moment.duration(endTime.diff(moment.unix(this.props.incident.created_at)));

        if (duration.days()) {
            return `${duration.days()} days ${duration.hours()} h`;
        }

        if (duration.hours()) {
            return `${duration.hours()} h ${duration.minutes()} m`;
        }

        if (duration.minutes()) {
            return `${duration.minutes()} m`;
        }

        return `${duration.seconds()} s`;
    }

    public goToChannel = () => {
        WebappUtils.browserHistory.push(`/${this.props.mainChannelDetails.team_name}/channels/${this.props.mainChannelDetails.name}`);
        this.props.actions.closeModal();
    }

    public render(): JSX.Element {
        const detailsHeader = (
            <div className='details-header'>
                <div className='title'>
                    <BackIcon
                        className='back-icon mr-4'
                        onClick={this.props.onClose}
                    />
                    <span className='mr-1'>{`Incident ${this.props.incident.name}`}</span>

                    { this.props.involvedInIncident &&
                    <OverlayTrigger
                        placement='bottom'
                        delay={OVERLAY_DELAY}
                        overlay={<Tooltip id='goToChannel'>{'Go to Incident Channel'}</Tooltip>}
                    >
                        <i
                            className='icon icon-link-variant link-icon'
                            onClick={this.goToChannel}
                        />
                    </OverlayTrigger>
                    }
                    <StatusBadge isActive={this.props.incident.is_active}/>
                </div>
                <div className='commander-div'>
                    <span className='label'>{'Commander:'}</span>
                    <Profile
                        userId={this.props.incident.commander_user_id}
                        classNames={{ProfileButton: true, profile: true}}
                    />
                </div>
            </div>);

        if (!this.props.involvedInIncident) {
            return (
                <div className='BackstageIncidentDetails'>
                    {detailsHeader}
                    <div className='no-permission-div'>
                        {'You are not a participant in this incident. Contact the commander to request access.'}
                    </div>
                </div>
            );
        }

        return (
            <div className='BackstageIncidentDetails'>
                {detailsHeader}
                <div className='subheader'>
                    { /*Summary will be a tab once Post Mortem is included */}
                    <div className='summary-tab'>
                        {'Summary'}
                    </div>
                    <div className={classNames('export-link', {disabled: !this.props.exportAvailable})}>
                        <i className='icon icon-download-outline export-icon'/>
                        {'Export Incident Channel'}
                    </div>
                </div>
                <div className='row'>
                    <div className='col-sm-3 statistic-block'>
                        <div className='title'>
                            {'Duration'}
                        </div>
                        <div className='content'>
                            <i className='icon icon-clock-outline box-icon'/>
                            {this.duration()}
                        </div>
                        <div className='block-footer center'>
                            <span>{this.timeFrameText()}</span>
                        </div>
                    </div>
                    <div className='col-sm-3 statistic-block'>
                        <div className='title'>
                            {'Members Involved'}
                        </div>
                        <div className='content'>
                            <i className='icon icon-account-multiple-outline box-icon'/>
                            {this.props.membersCount}
                        </div>
                    </div>
                    <div className='col-sm-3 statistic-block'>
                        <div className='title'>
                            {'Messages'}
                        </div>
                        <div className='content'>
                            <i className='icon icon-send box-icon'/>
                            {this.props.totalMessages}
                        </div>
                        <div className='block-footer right'>
                            <a
                                className='link'
                                onClick={this.goToChannel}
                            >
                                {'Jump to Channel'}
                                <i className='icon icon-arrow-right'/>
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        );
    }
}
