// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useSelector} from 'react-redux';
import moment from 'moment';
import styled from 'styled-components';

import {GlobalState} from 'mattermost-redux/types/store';
import {Team} from 'mattermost-redux/types/teams';
import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';
import {UserProfile} from 'mattermost-redux/types/users';

import TextWithTooltip from 'src/components/widgets/text_with_tooltip';
import {PlaybookRun, playbookRunCurrentStatus} from 'src/types/playbook_run';
import Duration from 'src/components/duration';
import {navigateToTeamPluginUrl} from 'src/browser_routing';
import Profile from 'src/components/profile/profile';
import StatusBadge from 'src/components/backstage/playbook_runs/status_badge';
import {useProfilesInChannel} from 'src/hooks';
import {Checklist, ChecklistItemState} from 'src/types/playbook';
import ProgressBar from 'src/components/backstage/playbooks/playbook_run_list/progress_bar';
import {findLastUpdatedWithDefault} from 'src/utils';

const SmallText = styled.div`
    font-weight: 400;
    font-size: 11px;
    line-height: 16px;
    color: var(--center-channel-color-64);
    margin: 5px 0;
`;

const NormalText = styled.div`
    font-weight: 400;
    line-height: 16px;
`;

const SmallProfile = styled(Profile)`
    font-weight: 400;
    font-size: 12px;
    line-height: 16px;

    > .image {
        width: 16px;
        height: 16px;
    }
`;

const SmallStatusBadge = styled(StatusBadge)`
    font-size: 10px;
    line-height: 16px;
    height: 16px;
    padding: 0 4px;
    margin: 0;
`;

const Row = (props: { playbookRun: PlaybookRun }) => {
    const currentTeam = useSelector<GlobalState, Team>(getCurrentTeam);
    const profilesInChannel = useProfilesInChannel(props.playbookRun.channel_id);
    const [completedTasks, totalTasks] = tasksCompletedTotal(props.playbookRun.checklists);

    function openPlaybookRunDetails(playbookRun: PlaybookRun) {
        navigateToTeamPluginUrl(currentTeam.name, `/runs/${playbookRun.id}`);
    }

    return (
        <div
            className='row playbook-run-item'
            key={props.playbookRun.id}
            onClick={() => openPlaybookRunDetails(props.playbookRun)}
        >
            <div className='col-sm-4'>
                <TextWithTooltip
                    id={props.playbookRun.id}
                    text={props.playbookRun.name}
                />
            </div>
            <div className='col-sm-2'>
                <SmallStatusBadge
                    status={playbookRunCurrentStatus(props.playbookRun)}
                />
                <SmallText>
                    <Duration
                        from={findLastUpdatedWithDefault(props.playbookRun)}
                        to={0}
                        ago={true}
                    />
                </SmallText>
            </div>
            <div
                className='col-sm-2'
            >
                <NormalText>
                    <Duration
                        from={props.playbookRun.create_at}
                        to={props.playbookRun.end_at}
                    />
                </NormalText>
                <SmallText>
                    {formatDate(props.playbookRun.create_at)}
                </SmallText>
            </div>
            <div className='col-sm-2'>
                <SmallProfile userId={props.playbookRun.owner_user_id}/>
                <SmallText>{participantsText(profilesInChannel)}</SmallText>
            </div>
            <div className='col-sm-2'>
                <NormalText>{completedTasks + ' / ' + totalTasks}</NormalText>
                <ProgressBar
                    completed={completedTasks}
                    total={totalTasks}
                />
            </div>
        </div>
    );
};

const participantsText = (participants: UserProfile[]) => {
    const num = participants.length - 1;
    const suffix = num === 1 ? '' : 's';
    return num + ' participant' + suffix;
};

const tasksCompletedTotal = (checklists: Checklist[]) => {
    let completed = 0;
    let total = 0;

    for (const cl of checklists) {
        for (const item of cl.items) {
            total++;
            if (item.state === ChecklistItemState.Closed) {
                completed++;
            }
        }
    }

    return [completed, total];
};

const formatDate = (millis: number) => {
    const mom = moment(millis);
    if (mom.isAfter(moment().startOf('d').subtract(2, 'd'))) {
        return mom.calendar();
    }

    if (mom.isSame(moment(), 'year')) {
        return mom.format('MMM DD LT');
    }
    return mom.format('MMM DD YYYY LT');
};

export default Row;
