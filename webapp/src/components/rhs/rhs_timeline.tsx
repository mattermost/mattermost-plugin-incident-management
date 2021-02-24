// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useState} from 'react';
import {useDispatch, useSelector, useStore} from 'react-redux';
import styled from 'styled-components';
import Scrollbars from 'react-custom-scrollbars';
import moment, {Moment} from 'moment';

import {GlobalState} from 'mattermost-redux/types/store';
import {getUser} from 'mattermost-redux/selectors/entities/users';
import {getUser as getUserAction} from 'mattermost-redux/actions/users';
import {UserProfile} from 'mattermost-redux/types/users';
import {displayUsername} from 'mattermost-redux/utils/user_utils';
import {getTeammateNameDisplaySetting} from 'mattermost-redux/selectors/entities/preferences';
import {DispatchFunc} from 'mattermost-redux/types/actions';
import {getChannelsNameMapInCurrentTeam} from 'mattermost-redux/selectors/entities/channels';
import {Team} from 'mattermost-redux/types/teams';
import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';

import {Incident} from 'src/types/incident';
import {TimelineEvent, TimelineEventType} from 'src/types/rhs';
import RHSTimelineEventItem from 'src/components/rhs/rhs_timeline_event_item';
import {
    renderThumbHorizontal,
    renderThumbVertical,
    renderView,
} from 'src/components/rhs/rhs_shared';
import {ChannelNamesMap} from 'src/types/backstage';

const Timeline = styled.ul`
    margin: 10px 0 150px 0;
    padding: 0;
    list-style: none;
    position: relative;

    :before {
        content: '';
        position: absolute;
        top: 5px;
        bottom: -10px;
        left: 97px;
        width: 1px;
        background: #EFF1F5;
    }
`;

type IdToUserFn = (userId: string) => UserProfile;

interface Props {
    incident: Incident;
}

const RHSTimeline = (props: Props) => {
    const dispatch = useDispatch();
    const channelNamesMap = useSelector<GlobalState, ChannelNamesMap>(getChannelsNameMapInCurrentTeam);
    const team = useSelector<GlobalState, Team>(getCurrentTeam);
    const displayPreference = useSelector<GlobalState, string | undefined>(getTeammateNameDisplaySetting) || 'username';
    const getStateFn = useStore().getState;
    const getUserFn = (userId: string) => getUserAction(userId)(dispatch as DispatchFunc, getStateFn);
    const selectUser = useSelector<GlobalState, IdToUserFn>((state) => (userId: string) => getUser(state, userId));
    const [events, setEvents] = useState<TimelineEvent[]>([]);
    const [reportedAt, setReportedAt] = useState(moment());

    const ignoredEvent = (e: TimelineEvent) => {
        switch (e.event_type) {
        case TimelineEventType.AssigneeChanged:
        case TimelineEventType.TaskStateModified:
        case TimelineEventType.RanSlashCommand:
            return true;
        }
        return false;
    };

    useEffect(() => {
        Promise.all(props.incident.timeline_events.map(async (e) => {
            if (e.event_type === TimelineEventType.IncidentCreated) {
                setReportedAt(moment(e.event_at));
            }

            if (ignoredEvent(e)) {
                return null;
            }

            let user = selectUser(e.subject_user_id) as UserProfile | undefined;

            if (!user) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const ret = await getUserFn(e.subject_user_id) as { data?: UserProfile, error?: any };
                if (!ret.data) {
                    return null;
                }
                user = ret.data;
            }
            return {
                ...e,
                subject_display_name: displayUsername(user, displayPreference),
            } as TimelineEvent;
        })).then((eventArray) => {
            setEvents(eventArray.filter((e) => e) as TimelineEvent[]);
        });
    }, [props.incident.timeline_events, displayPreference]);

    return (
        <Scrollbars
            autoHide={true}
            autoHideTimeout={500}
            autoHideDuration={500}
            renderThumbHorizontal={renderThumbHorizontal}
            renderThumbVertical={renderThumbVertical}
            renderView={renderView}
            style={{position: 'absolute'}}
        >
            <Timeline data-testid='timeline-view'>
                {
                    events.map((event) => (
                        <RHSTimelineEventItem
                            key={event.id}
                            event={event}
                            reportedAt={reportedAt}
                            channelNames={channelNamesMap}
                            team={team}
                        />
                    ))
                }
            </Timeline>
        </Scrollbars>
    );
};

export default RHSTimeline;
