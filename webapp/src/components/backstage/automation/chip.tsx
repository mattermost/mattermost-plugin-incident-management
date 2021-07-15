// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React, {FC} from 'react';

import styled from 'styled-components';

interface Props {
    text: string;
    onDelete: () => void;
}

const closeIcon = (
    <svg
        width='16px'
        height='16px'
        viewBox='0 0 16 16'
        role='img'
        aria-label={'Close Icon'}
    >
        <path
            d='m 8,0 c 4.424,0 8,3.576 8,8 0,4.424 -3.576,8 -8,8 C 3.576,16 0,12.424 0,8 0,3.576 3.576,0 8,0 Z M 10.872,4 8,6.872 5.128,4 4,5.128 6.872,8 4,10.872 5.128,12 8,9.128 10.872,12 12,10.872 9.128,8 12,5.128 Z'
        />
    </svg>
);

export const Chip: FC<Props> = (props: Props) => (
    <StyledChip>
        {props.text}
        <span
            className='close-icon'
            onClick={props.onDelete}
        >
            {closeIcon}
        </span>
    </StyledChip>
);

const StyledChip = styled.div`
    background: rgba(var(--center-channel-color-rgb), 0.08 );
    color: var(--center-channel-color);
    align-items: center;
    border-radius: 32px;
    margin: 4px 4px 4px 0;
    display: flex;
    font-size: 14px;
    font-weight: 400;
    padding: 4px;

    .close-icon {
        cursor: pointer;
        height: 16px;
        width: 16px;
        display: flex;
   
        &:hover {
            background: none;
        }

        svg {
            height: 16px;
            width: 16px;
            fill: rgba(var(--sys-center-channel-color-rgb), 0.64);

            &:hover {
                fill: rgba(var(--sys-center-channel-color-rgb), 0.80);
            }

            .app__body & {
                fill: rgba(var(--center-channel-color-rgb), 0.64);

                &:hover {
                    fill: rgba(var(--center-channel-color-rgb), 0.80);
                }
            }

            opacity: .6;
        }
    }
`;