// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License for license information.

import React from 'react';
import styled from 'styled-components';

import UpgradeBadge from 'src/components/backstage/upgrade_badge';

export const Button = styled.button`
    display: inline-flex;
    align-items: center;
    height: 40px;
    background: rgba(var(--center-channel-color-rgb), 0.08);
    color: rgba(var(--center-channel-color-rgb), 0.72);
    border-radius: 4px;
    border: 0px;
    font-weight: 600;
    font-size: 14px;
    align-items: center;
    padding: 0 20px;
    position: relative;

    &:hover{
        background: rgba(var(--center-channel-color-rgb), 0.12);
    }

    &:disabled {
        color: rgba(var(--center-channel-color-rgb), 0.32);
        background: rgba(var(--center-channel-color-rgb), 0.08);
    }

    i {
        display: flex;
        font-size: 18px;
    }
`;

export const PrimaryButton = styled(Button)`
    background: var(--button-bg);
    color: var(--button-color);
    transition: background 0.15s ease-out;

    &:active  {
        background: rgba(var(--button-bg-rgb), 0.8);
    }

    &:before {
        content: '';
        left: 0;
        top: 0;
        width: 100%;
        height: 100%;
        transition: all 0.15s ease-out;
        position: absolute;
        background: var(--center-channel-color-16);
        opacity: 0;
        border-radius: 4px;
    }

    &:hover:enabled {
        background: var(--button-bg);
        &:before {
            opacity: 1;
        }
    }
`;

export const SubtlePrimaryButton = styled(Button)`
    background: rgba(var(--button-bg-rgb), 0.08);
    color: var(--button-bg);
    &:hover,
    &:active {
        background: rgba(var(--button-bg-rgb), 0.12);
    }
`;

export const TertiaryButton = styled.button`
    background: transparent;
    display: inline-flex;
    align-items: center;
    height: 40px;
    color: var(--button-bg);
    border-radius: 4px;
    border: 0px;
    font-weight: 600;
    font-size: 14px;
    align-items: center;
    padding: 0 20px;
    transition: all 0.15s ease-out;

    &:hover:enabled {
        background: rgba(var(--button-bg-rgb), 0.08);
    }

    &:active  {
        background: rgba(var(--button-bg-rgb), 0.16);
    }

    &:disabled {
        color: rgba(var(--center-channel-color-rgb), 0.32);
    }

    i {
        display: flex;
        font-size: 18px;

        &:before {
            margin: 0 7px 0 0;
        }
    }
`;

export const GrayTertiaryButton = styled.button`
    border: none;
    background: none;
    font-size: 12px;
    font-weight: normal;
    line-height: 16px;
    color: rgba(var(--center-channel-color-rgb), 0.64);
    text-align: left;

    &:hover {
        color: rgba(var(--center-channel-color-rgb));
    }
`;

export const SecondaryButton = styled(TertiaryButton)`
    background: var(--button-color-rgb);
    border: 1px solid var(--button-bg);
`;

export type UpgradeButtonProps = React.ComponentProps<typeof PrimaryButton>;

export const UpgradeButton = (props: UpgradeButtonProps) => {
    const {children, ...rest} = props;
    return (
        <PrimaryButton {...rest}>
            {children}
            <PositionedUpgradeBadge/>
        </PrimaryButton>
    );
};

const PositionedUpgradeBadge = styled(UpgradeBadge)`
    position: absolute;
    top: -4px;
    right: -6px;
`;
