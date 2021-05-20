// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import styled, {css} from 'styled-components';

import {PrimaryButton, TertiaryButton} from 'src/components/assets/buttons';
import StatusBadge from 'src/components/backstage/incidents/status_badge';

export const Container = styled.div`
    display: flex;
`;

export const Left = styled.div`
    flex: 2;
`;

export const Right = styled.div`
    flex: 1;
    margin-left: 20px;
`;

export const TabPageContainer = styled.div`
    font-size: 12px;
    font-weight: normal;
    margin-top: 20px;
`;

export const Title = styled.div`
    color: var(--button-bg);
    font-size: 18px;
    font-weight: 600;
`;

export const Content = styled.div`
    background: var(--center-channel-bg);
    color: var(--center-channel-color);
    margin: 8px 0 0 0;
    padding: 0 8px 4px;
    border: 1px solid var(--center-channel-color-08);
    border-radius: 8px;
`;

export const Heading = styled.div`
    margin: 10px 0 0 0;
    font-weight: 600;
`;

export const Body = styled.p`
    margin: 8px 0;
`;

export const EmptyBody = styled.div`
    margin: 16px 0 24px 0;
    font-size: 14px;
`;

export const SecondaryButton = styled(TertiaryButton)`
    background: var(--button-color-rgb);
    border: 1px solid var(--button-bg);
    padding: 0 20px;
    height: 26px;
    font-size: 12px;
    margin-left: 20px;
`;

export const SecondaryButtonRight = styled(SecondaryButton)`
    margin-left: auto;
`;

export const SecondaryButtonLarger = styled(SecondaryButton)`
    padding: 0 16px;
    height: 36px;
`;

export const SecondaryButtonLargerRight = styled(SecondaryButtonLarger)`
    margin-left: auto;
`;

export const PrimaryButtonRight = styled(PrimaryButton)`
    height: 26px;
    padding: 0 14px;
    margin-left: auto;
    font-size: 12px;
`;

export const Badge = styled(StatusBadge)`
    display: unset;
    position: unset;
    height: unset;
    white-space: nowrap;
`;

export const SpacedSmallBadge = styled(Badge)<{space?: number}>`
    line-height: 18px;
    margin-left: ${(props) => (props.space ? props.space : 10)}px;
`;

