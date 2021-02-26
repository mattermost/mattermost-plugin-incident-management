// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {FC, useState} from 'react';

import styled from 'styled-components';

import {ActionFunc} from 'mattermost-redux/types/actions';

import Profile from 'src/components/profile/profile';
import {AutomationHeader, AutomationTitle} from 'src/components/backstage/automation/styles';
import AssignCommanderSelector from 'src/components/backstage/automation/assign_commander_selector';
import {Toggle} from 'src/components/backstage/automation/toggle';
import {fetchUsersInTeam} from 'src/client';

interface Props {
    enabled: boolean;
    onToggle: () => void;
    searchProfiles: (term: string) => ActionFunc;
    getProfiles: () => ActionFunc;
    commanderID: string;
    onAssignCommander: (userId: string | undefined) => void;
    teamID: string;
}

export const AutoAssignCommander: FC<Props> = (props: Props) => {
    return (
        <>
            <AutomationHeader>
                <AutomationTitle>
                    <Toggle
                        isChecked={props.enabled}
                        onChange={props.onToggle}
                    />
                    <div>{'Assign commander'}</div>
                </AutomationTitle>
                <ProfileAutocompleteWrapper>
                    <AssignCommanderSelector
                        commanderID={props.commanderID}
                        onAddUser={props.onAssignCommander}
                        searchProfiles={props.searchProfiles}
                        getProfiles={props.getProfiles}
                        isDisabled={!props.enabled}
                    />
                </ProfileAutocompleteWrapper>
            </AutomationHeader>
        </>
    );
};

interface UserRowProps {
    isEnabled: boolean;
}

const UserRow = styled.div<UserRowProps>`
    margin: 12px 0 0 auto;

    padding: 0;

    display: flex;
    flex-direction: row;
`;

const Cross = styled.i`
    position: absolute;
    cursor: pointer;
    top: 0;
    left: 50%;

    color: var(--button-bg);
    // Filling the transparent X in the icon: this sets a background gradient,
    // which is effectively a circle with color --button-color that fills only
    // 50% of the background, transparent outside of it. If we simply add a
    // background color, the icon is misplaced and a weird border appears at the bottom
    background-image: radial-gradient(circle, var(--button-color) 50%, rgba(0, 0, 0, 0) 50%);

    visibility: hidden;
`;

const UserPic = styled.div`
    .IncidentProfile {
        flex-direction: column;

        .name {
            display: none;
            position: absolute;
            bottom: -24px;
            margin-left: auto;
        }
    }

    :not(:first-child) {
        margin-left: -16px;
    }

    position: relative;
    transition: transform .4s;
    :hover {
        z-index: 1;
        transform: translateY(-8px);

        ${Cross} {
            visibility: visible;
        }

        .name {
            display: block;
        }
    }

    && img {
        // We need both background-color and border color to imitate the color in the background
        background-color: var(--center-channel-bg);
        border: 2px solid var(--center-channel-color-04);
    }

`;

const ProfileAutocompleteWrapper = styled.div`
    margin: 0;
    width: 300px;
`;

interface UserProps {
    userIds: string[];
    onRemoveUser: (userId: string) => void;
    isEnabled: boolean;
}

const Users: FC<UserProps> = (props: UserProps) => {
    return (
        <UserRow isEnabled={props.isEnabled}>
            {props.userIds.map((userId: string) => (
                <UserPic key={userId}>
                    <Profile userId={userId}/>
                    <Cross
                        className='fa fa-times-circle'
                        onClick={() => props.onRemoveUser(userId)}
                    />
                </UserPic>
            ))}
        </UserRow>
    );
};
