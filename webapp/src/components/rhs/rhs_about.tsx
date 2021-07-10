// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import styled from 'styled-components';
import {useDispatch, useSelector} from 'react-redux';

import {getProfilesInCurrentChannel} from 'mattermost-redux/selectors/entities/users';

import {PlaybookRun} from 'src/types/playbook_run';
import {setOwner} from 'src/client';
import ProfileSelector from 'src/components/profile/profile_selector';
import './playbook_run_details.scss';
import PostCard from 'src/components/rhs/post_card';
import {useLatestUpdate} from 'src/hooks';
import PostText from 'src/components/post_text';
import {updateStatus} from 'src/actions';
import Duration from '../duration';

interface Props {
    playbookRun: PlaybookRun;
}

const RHSAbout = (props: Props) => {
    const dispatch = useDispatch();
    const profilesInChannel = useSelector(getProfilesInCurrentChannel);
    const latestUpdatePost = useLatestUpdate(props.playbookRun);

    let description = <PostText text={props.playbookRun.description}/>;
    if (props.playbookRun.status_posts.length === 0) {
        description = (
            <NoDescription>
                {'No description yet. '}
                <a onClick={() => dispatch(updateStatus())}>{'Click here'}</a>
                {' to update status.'}
            </NoDescription>
        );
    }

    const fetchUsers = async () => {
        return profilesInChannel.filter((p) => !p.is_bot);
    };

    const onSelectedProfileChange = async (userId?: string) => {
        if (!userId) {
            return;
        }
        const response = await setOwner(props.playbookRun.id, userId);
        if (response.error) {
            // TODO: Should be presented to the user? https://mattermost.atlassian.net/browse/MM-24271
            console.log(response.error); // eslint-disable-line no-console
        }
    };

    return (
        <div className='PlaybookRunDetails'>
            <Description>
                <div className='title'>
                    {'Description'}
                </div>
                {description}
            </Description>
            <Row>
                <div className='side-by-side'>
                    <div className='inner-container first-container'>
                        <div className='first-title'>{'Owner'}</div>
                        <ProfileSelector
                            selectedUserId={props.playbookRun.owner_user_id}
                            placeholder={'Assign the owner role'}
                            placeholderButtonClass={'NoAssignee-button'}
                            profileButtonClass={'Assigned-button'}
                            enableEdit={true}
                            getUsers={fetchUsers}
                            onSelectedChange={onSelectedProfileChange}
                            selfIsFirstOption={true}
                        />
                    </div>
                    <div className='first-title'>
                        {'Duration'}
                        <Duration
                            from={props.playbookRun.create_at}
                            to={props.playbookRun.end_at}
                        />
                    </div>
                </div>
            </Row>
            <div id={'playbookRunRHSUpdates'}>
                <div className='title'>
                    {'Recent update:'}
                </div>
                <PostCard post={latestUpdatePost}/>
            </div>
        </div>
    );
};

const Description = styled.div`
    padding: 0 0 14px 0;
`;

const Row = styled.div`
    padding: 0 0 24px 0;
`;

const NoDescription = styled.div`
    color: rgba(var(--center-channel-color-rgb), 0.64);
    margin-bottom: 10px;
`;

export default RHSAbout;
