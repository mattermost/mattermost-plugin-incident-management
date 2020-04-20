// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {UserProfile} from 'mattermost-redux/types/users';
import {Client4} from 'mattermost-redux/client';

import classNames from 'classnames';

import './profile_button.scss';
import {getDisplayName} from 'src/utils/utils';

interface Props {
    user?: UserProfile;
    enableEdit: boolean;
    onClick: () => void;
}

export default function ProfileButton(props: Props) {
    if (!props.user) {
        return null;
    }

    const profileUri = Client4.getProfilePictureUrl(props.user.id, props.user.last_picture_update);
    const name = getDisplayName(props.user);
    const profileClass = classNames('profile', {
        active: props.enableEdit,
    });

    return (
        <button
            onClick={props.onClick}
            className={'profile-button'}
        >
            <div className={profileClass}>
                <img
                    className='image'
                    src={profileUri}
                />
                <div className='name'>{name}</div>
                {
                    props.enableEdit &&
                    <i className='icon-chevron-down ml-2 mr-3'/>
                }
            </div>
        </button>
    );
}
