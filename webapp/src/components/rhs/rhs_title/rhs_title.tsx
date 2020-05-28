// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import Spinner from 'src/components/spinner';
import {Incident} from 'src/types/incident';
import {BackstageArea} from 'src/types/backstage';
import {SetBackstageModalSettings} from 'src/types/actions';
import {RHSState} from 'src/types/rhs';

import './rhs_title.scss';

interface Props {
    rhsState: RHSState;
    incident: Incident;
    isLoading: boolean;
    actions: {
        startIncident: () => void;
        setRHSState: (state: RHSState) => void;
        setRHSOpen: (open: boolean) => void;
        openBackstageModal: (selectedArea: BackstageArea) => SetBackstageModalSettings;
    };
}

export default function RHSTitle(props: Props) {
    const goBack = () => {
        props.actions.setRHSState(RHSState.List);
    };

    return (
        <div className='rhs-incident-title'>
            {
                props.isLoading &&
                <Spinner/>
            }
            {
                props.rhsState === RHSState.List && !props.isLoading &&
                <React.Fragment>
                    <div>
                        <div className='title'>{'Incident List'}</div>
                    </div>
                </React.Fragment>
            }
            {
                props.rhsState !== RHSState.List && !props.isLoading &&
                <React.Fragment>
                    <div className='incident-details'>
                        <i
                            className='fa fa-angle-left'
                            onClick={goBack}
                        />
                        <div className='title'>{props.incident.name}</div>
                    </div>
                </React.Fragment>
            }
        </div>
    );
}
