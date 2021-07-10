// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import Scrollbars from 'react-custom-scrollbars';
import {useSelector} from 'react-redux';

import {
    renderThumbHorizontal,
    renderThumbVertical, renderView,
    RHSContainer,
    RHSContent,
} from 'src/components/rhs/rhs_shared';
import {currentPlaybookRun} from 'src/selectors';
import RHSAbout from 'src/components/rhs/rhs_about';
import RHSChecklists from 'src/components/rhs/rhs_checklists';
import {useProfilesInCurrentChannel} from 'src/hooks';

const RHSRunDetails = () => {
    const playbookRun = useSelector(currentPlaybookRun);
    useProfilesInCurrentChannel();

    if (!playbookRun) {
        return null;
    }

    return (
        <RHSContainer>
            <RHSContent>
                <Scrollbars
                    autoHide={true}
                    autoHideTimeout={500}
                    autoHideDuration={500}
                    renderThumbHorizontal={renderThumbHorizontal}
                    renderThumbVertical={renderThumbVertical}
                    renderView={renderView}
                    style={{position: 'absolute'}}
                >
                    <RHSAbout playbookRun={playbookRun}/>
                    <RHSChecklists playbookRun={playbookRun}/>
                </Scrollbars>
            </RHSContent>
        </RHSContainer>
    );
};

export default RHSRunDetails;
