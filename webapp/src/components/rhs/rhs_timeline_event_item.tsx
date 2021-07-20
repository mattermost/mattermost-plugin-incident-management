// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';
import {useDispatch} from 'react-redux';
import styled from 'styled-components';
import moment, {duration, Moment} from 'moment';
import {Team} from 'mattermost-redux/types/teams';

import {TimelineEvent, TimelineEventType} from 'src/types/rhs';
import {isMobile} from 'src/mobile';
import {toggleRHS} from 'src/actions';
import {ChannelNamesMap} from 'src/types/backstage';
import {messageHtmlToComponent, formatText} from 'src/webapp_globals';
import {renderDuration} from 'src/components/duration';
import ConfirmModal from 'src/components/widgets/confirmation_modal';
import {clientRemoveTimelineEvent} from 'src/client';
import {HoverMenu, HoverMenuButton} from 'src/components/rhs/rhs_shared';

const Circle = styled.div`
    position: absolute;
    width: 24px;
    height: 24px;
    color: var(--button-bg);
    background: #EFF1F5;
    border-radius: 50%;
    left: 86px;

    > .icon {
        font-size: 14px;
        margin: 5px 0 0 2px;
    }
`;

const TimelineItem = styled.li`
    position: relative;
    margin: 20px 0 0 0;
`;

const TimeContainer = styled.div`
    position: absolute;
    width: 75px;
    line-height: 16px;
    text-align: right;
    left: 4px;
`;

const TimeHours = styled.div`
    font-size: 12px;
    font-weight: 600;
    margin: 0 0 4px 0;
`;

const TimeDay = styled.div`
    font-size: 10px;
`;

const SummaryContainer = styled.div`
    position: relative;
    margin: 0 0 0 120px;
    padding: 0 5px 0 0;
    line-height: 16px;
    min-height: 36px;
`;

const SummaryTitle = styled.div`
    font-size: 12px;
    font-weight: 600;

    :hover {
        cursor: pointer;
    }
`;

const SummaryDetail = styled.div`
    font-size: 11px;
    margin: 4px 0 0 0;
    color: var(--center-channel-color-64)
`;

interface Props {
    event: TimelineEvent;
    reportedAt: Moment;
    channelNames: ChannelNamesMap;
    team: Team;
}

const RHSTimelineEventItem = (props: Props) => {
    const dispatch = useDispatch();
    const [showMenu, setShowMenu] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const markdownOptions = {
        atMentions: true,
        team: props.team,
        channelNamesMap: props.channelNames,
    };

    const goToPost = (e: React.MouseEvent<Element, MouseEvent>, postId?: string) => {
        e.preventDefault();
        if (!postId) {
            return;
        }

        // @ts-ignore
        window.WebappUtils.browserHistory.push(`/_redirect/pl/${postId}`);

        if (isMobile()) {
            dispatch(toggleRHS());
        }
    };

    let iconClass = '';
    let summaryTitle = '';
    let summary = '';
    let testid = '';
    const diff = moment(props.event.event_at).diff(moment(props.reportedAt));
    let stamp = renderDuration(duration(diff));
    if (diff < 0) {
        stamp = '-' + renderDuration(duration(diff).abs());
    }
    let timeSince: JSX.Element | null = <TimeDay>{'Time: ' + stamp}</TimeDay>;

    switch (props.event.event_type) {
    case TimelineEventType.PlaybookRunCreated:
        iconClass = 'icon icon-shield-alert-outline';
        summaryTitle = 'Run started by ' + props.event.subject_display_name;
        timeSince = null;
        testid = TimelineEventType.PlaybookRunCreated;
        break;
    case TimelineEventType.StatusUpdated:
        iconClass = 'icon icon-flag-outline';
        if (props.event.summary === '') {
            summaryTitle = props.event.subject_display_name + ' posted a status update';
        } else {
            summaryTitle = props.event.subject_display_name + ' changed status from ' + props.event.summary;
        }
        testid = TimelineEventType.StatusUpdated;
        break;
    case TimelineEventType.OwnerChanged:
        iconClass = 'icon icon-pencil-outline';
        summaryTitle = 'Owner changed from ' + props.event.summary;
        testid = TimelineEventType.OwnerChanged;
        break;
    case TimelineEventType.TaskStateModified:
        iconClass = 'icon icon-format-list-bulleted';
        summaryTitle = props.event.subject_display_name + ' ' + props.event.summary;
        summaryTitle = summaryTitle.replace(/\*\*/g, '"');
        testid = TimelineEventType.TaskStateModified;
        break;
    case TimelineEventType.AssigneeChanged:
        iconClass = 'icon icon-pencil-outline';
        summaryTitle = 'Assignee Changed';
        summary = props.event.subject_display_name + ' ' + props.event.summary;
        testid = TimelineEventType.AssigneeChanged;
        break;
    case TimelineEventType.RanSlashCommand:
        iconClass = 'icon icon-pencil-outline';
        summaryTitle = 'Slash Command Executed';
        summary = props.event.subject_display_name + ' ' + props.event.summary;
        testid = TimelineEventType.RanSlashCommand;
        break;
    case TimelineEventType.EventFromPost:
        iconClass = 'icon icon-pencil-outline';
        summaryTitle = props.event.summary;
        testid = TimelineEventType.EventFromPost;
        break;
    case TimelineEventType.UserJoinedLeft:
        iconClass = 'icon icon-account-outline';
        summaryTitle = JSON.parse(props.event.details).title;
        summary = props.event.summary;
        testid = TimelineEventType.UserJoinedLeft;
        break;
    case TimelineEventType.PublishedRetrospective:
        iconClass = 'icon icon-pencil-outline';
        summaryTitle = 'Retrospective published by ' + props.event.subject_display_name;
        testid = TimelineEventType.PublishedRetrospective;
        break;
    case TimelineEventType.CanceledRetrospective:
        iconClass = 'icon icon-cancel';
        summaryTitle = 'Retrospective canceled by ' + props.event.subject_display_name;
        testid = TimelineEventType.CanceledRetrospective;
        break;
    }

    return (
        <TimelineItem
            data-testid={'timeline-item ' + testid}
            onMouseEnter={() => setShowMenu(true)}
            onMouseLeave={() => setShowMenu(false)}
        >
            {showMenu &&
            <HoverMenu>
                <HoverMenuButton
                    className={'icon-trash-can-outline icon-16 btn-icon'}
                    onClick={() => {
                        setShowDeleteConfirm(true);
                    }}
                />
            </HoverMenu>
            }
            <TimeContainer>
                <TimeHours>{moment(props.event.event_at).format('MMM DD HH:mm')}</TimeHours>
                {timeSince}
            </TimeContainer>
            <Circle>
                <i className={iconClass}/>
            </Circle>
            <SummaryContainer>
                <SummaryTitle onClick={(e) => goToPost(e, props.event.post_id)}>
                    {summaryTitle}
                </SummaryTitle>
                <SummaryDetail>{messageHtmlToComponent(formatText(summary, markdownOptions), true, {})}</SummaryDetail>
            </SummaryContainer>
            <ConfirmModal
                show={showDeleteConfirm}
                title={'Confirm Entry Delete'}
                message={'Are you sure you want to delete this event? Deleted events will be permanently removed from the timeline.'}
                confirmButtonText={'Delete Entry'}
                onConfirm={() =>
                    clientRemoveTimelineEvent(props.event.playbook_run_id, props.event.id)
                }
                onCancel={() => setShowDeleteConfirm(false)}
            />
        </TimelineItem>
    );
};

export default RHSTimelineEventItem;
