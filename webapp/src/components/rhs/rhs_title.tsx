// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useDispatch, useSelector} from 'react-redux';
import styled from 'styled-components';

import {GlobalState} from 'mattermost-redux/types/store';

import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';

import {Team} from 'mattermost-redux/types/teams';

import {PlaybookRun, playbookRunCurrentStatus} from 'src/types/playbook_run';

import StatusBadge from 'src/components/backstage/playbook_runs/status_badge';

import LeftChevron from 'src/components/assets/icons/left_chevron';
import {RHSState} from 'src/types/rhs';
import {setRHSViewingList} from 'src/actions';
import {currentPlaybookRun, currentRHSState} from 'src/selectors';
import {teamPluginUrl} from 'src/browser_routing';

const RHSTitleContainer = styled.div`
    display: flex;
    justify-content: space-between;
    overflow: hidden;
`;

const RHSTitleText = styled.div`
    overflow: hidden;
    text-overflow: ellipsis;
    margin-right: 8px;
`;

const Button = styled.button`
    display: flex;
    border: none;
    background: none;
    padding: 0px 11px 0 0;
    align-items: center;
`;

// @ts-ignore
const {Link} = window.ReactRouterDom;

const RHSTitle = () => {
    const dispatch = useDispatch();
    const playbookRun = useSelector<GlobalState, PlaybookRun | undefined>(currentPlaybookRun);
    const rhsState = useSelector<GlobalState, RHSState>(currentRHSState);
    const currentTeam = useSelector<GlobalState, Team>(getCurrentTeam);

    if (rhsState === RHSState.ViewingPlaybookRun) {
        return (
            <RHSTitleContainer>
                <Button
                    onClick={() => dispatch(setRHSViewingList())}
                    data-testid='back-button'
                >
                    <LeftChevron/>
                </Button>
                <RHSTitleText data-testid='rhs-title'>{playbookRun?.name || 'Runs'}</RHSTitleText>
                {playbookRun && (
                    <StatusBadge
                        status={playbookRunCurrentStatus(playbookRun)}
                        compact={true}
                    />
                )}
            </RHSTitleContainer>
        );
    }

    return (
        <RHSTitleText>
            {'Playbooks'}
        </RHSTitleText>
    );
};

export default RHSTitle;
