// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';
import styled from 'styled-components';
import {useSelector} from 'react-redux';

import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';
import {GlobalState} from 'mattermost-redux/types/store';
import {UserProfile} from 'mattermost-redux/types/users';
import {getUser} from 'mattermost-redux/selectors/entities/users';

import ProfileWithPosition
    from 'src/components/backstage/playbook_runs/playbook_run_backstage/overview/profile_w_position';
import {PlaybookRun} from 'src/types/playbook_run';
import {
    Content,
    SecondaryButtonRight,
    TabPageContainer,
    Title,
} from 'src/components/backstage/playbook_runs/shared';
import {useEnsureProfiles} from 'src/hooks';
import {navigateToUrl} from 'src/browser_routing';

const StyledContent = styled(Content)`
    padding: 8px 20px 24px 24px;
`;

const Heading = styled.div`
    margin: 16px 0 0 0;
    font-weight: 600;
`;

const ParticipantRow = styled.div`
    display: flex;
    align-items: center;
    margin: 8px 0 0 0;
`;

interface Props {
    playbookRun: PlaybookRun;
}

const Participants = (
    {
        playbookRun,
        playbookRun: {participant_ids},
    }: Props) => {
    useEnsureProfiles(participant_ids);

    const profilesExceptTwoMains = participant_ids
        .filter((id) => id !== playbookRun.owner_user_id && id !== playbookRun.reporter_user_id);

    return (
        <TabPageContainer>
            <Title>{`Participants (${participant_ids.length})`}</Title>
            <StyledContent>
                <Heading>{'Owner'}</Heading>
                <Participant
                    userId={playbookRun.owner_user_id}
                    isOwner={true}
                />
                <Heading>{'Reporter'}</Heading>
                <Participant userId={playbookRun.reporter_user_id}/>
                {
                    profilesExceptTwoMains.length > 0 &&
                    <>
                        <Heading>{'Channel members'}</Heading>
                        {profilesExceptTwoMains.map((id) => (
                            <Participant
                                key={id}
                                userId={id}
                            />
                        ))}
                    </>
                }
            </StyledContent>
        </TabPageContainer>
    );
};

export default Participants;

interface ParticipantProps {
    userId: string;
    isOwner?: boolean;
}

function Participant({userId, isOwner}: ParticipantProps) {
    const [showMessage, setShowMessage] = useState(Boolean(isOwner));
    const team = useSelector(getCurrentTeam);
    const user = useSelector<GlobalState, UserProfile>((state) => getUser(state, userId));

    return (
        <ParticipantRow
            onMouseEnter={() => setShowMessage(true)}
            onMouseLeave={() => !isOwner && setShowMessage(false)}
        >
            <ProfileWithPosition userId={userId}/>
            {showMessage && (
                <SecondaryButtonRight
                    onClick={() => navigateToUrl(`/${team.name}/messages/@${user.username}`)}
                >
                    {'Message'}
                </SecondaryButtonRight>
            )}
        </ParticipantRow>
    );
}
