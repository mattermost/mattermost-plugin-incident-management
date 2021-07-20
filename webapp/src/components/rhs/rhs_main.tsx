// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useState} from 'react';
import {useDispatch, useSelector} from 'react-redux';

import {GlobalState} from 'mattermost-redux/types/store';
import {getCurrentChannelId} from 'mattermost-redux/selectors/entities/channels';

import {setRHSOpen, setRHSViewingPlaybookRun, setRHSViewingList} from 'src/actions';
import RHSHome from 'src/components/rhs/rhs_home';
import {currentRHSState, inPlaybookRunChannel} from 'src/selectors';
import {RHSState} from 'src/types/rhs';
import RHSWelcomeView from 'src/components/rhs/rhs_welcome_view';
import RHSDetailsView from 'src/components/rhs/rhs_details_view';

const RightHandSidebar = () => {
    const dispatch = useDispatch();
    const currentChannelId = useSelector<GlobalState, string>(getCurrentChannelId);
    const inPlaybookRun = useSelector<GlobalState, boolean>(inPlaybookRunChannel);
    const rhsState = useSelector<GlobalState, RHSState>(currentRHSState);
    const [seenChannelId, setSeenChannelId] = useState('');

    useEffect(() => {
        dispatch(setRHSOpen(true));
        return () => {
            dispatch(setRHSOpen(false));
        };
    }, [dispatch]);

    // Update the rhs state when the channel changes
    if (currentChannelId !== seenChannelId) {
        setSeenChannelId(currentChannelId);

        if (inPlaybookRun) {
            dispatch(setRHSViewingPlaybookRun());
        } else {
            dispatch(setRHSViewingList());
        }
    }

    if (rhsState === RHSState.ViewingPlaybookRun) {
        if (inPlaybookRun) {
            return <RHSDetailsView/>;
        }
        return <RHSWelcomeView/>;
    }

    return <RHSHome/>;
};

export default RightHandSidebar;

