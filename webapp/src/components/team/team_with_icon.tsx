// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {Team} from 'mattermost-redux/types/teams';
import {Client4} from 'mattermost-redux/client';
import styled from 'styled-components';
interface Props {
    team: Team;
    allowed: boolean;
}

/**
 * An icon representing a Team. If team has an icon - shows the image,
 * otherwise shows team initials
 */
const TeamWithIcon = (props: Props) => {
    function imageURLForTeam(team: any) {
        return team.last_team_icon_update ? Client4.getTeamIconUrl(team.id, team.last_team_icon_update) : null;
    }

    const teamIconUrl = imageURLForTeam(props.team);
    let icon;
    if (teamIconUrl) {
        icon = (
            <ImageWrapper
                data-testid='teamIconImage'
                aria-label={'Team Icon'}
                style={{backgroundImage: `url('${teamIconUrl}')`}}
            />
        );
    } else {
        icon = (
            <InitialWrapper
                data-testid='teamIconInitial'
                aria-label={'Team Initials'}
            >
                {props.team.display_name ? props.team.display_name.replace(/\s/g, '').substring(0, 2) : '??'}
            </InitialWrapper>
        );
    }

    return (
        <TeamWrapper>
            <IconWrapper>
                {icon}
            </IconWrapper>
            <NameWrapper>
                {props.team.display_name}
            </NameWrapper>
            {props.allowed ? '' : <NotAllowedIcon className='icon icon-key-variant-circle'/>}
        </TeamWrapper>
    );
};

export default TeamWithIcon;

const TeamWrapper = styled.div`
    display: flex;
    flex-direction: row;
    align-items: center;
    
    &.active {
        cursor: pointer;
        color: var(--center-channel-color);
    }
`;

const NameWrapper = styled.div`
    padding: 0 0 0 8px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;

    .description {
        color: var(--center-channel-color-56);
        margin-left: 4px;
    }
`;

const IconWrapper = styled.div`
    height: 24px;
    width: 24px;
    left: 0px;
    top: 0px;
    border-radius: 4px;

    box-sizing: content-box;
    transform-origin: center center;
    position: relative;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    justify-content: center;
    transition: none;
`;

const ImageWrapper = styled.div`
    background-color: white;
    background-repeat: unset;
    background-size: 100% 100%;
    width: 100%;
    height: 100%;
    border: none;
`;

const InitialWrapper = styled.div`
    font-size: 14px;
    font-weight: 600;
    color: #3D3C40;    
    text-align: center;
    text-transform: uppercase;
    display: flex;
    justify-content: center;
    align-items: center;
    background: #7E96C8;
    width: 100%;
    height: 100%;
    border: none;
`;

const NotAllowedIcon = styled.i`
    position: absolute;
    right: 10px;
`;
