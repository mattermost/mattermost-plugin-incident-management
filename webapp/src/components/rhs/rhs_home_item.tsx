// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useRef} from 'react';
import {useSelector, useDispatch} from 'react-redux';
import styled from 'styled-components';
import {useIntl} from 'react-intl';
import {Link} from 'react-router-dom';
import {GlobalState} from 'mattermost-redux/types/store';
import {Team} from 'mattermost-redux/types/teams';

import Icon from '@mdi/react';
import {mdiClipboardPlayOutline, mdiCheckAll, mdiSync, mdiOpenInNew} from '@mdi/js';

import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';

import {SubtlePrimaryButton} from 'src/components/assets/buttons';

import {Playbook, DraftPlaybookWithChecklist} from 'src/types/playbook';
import {usePlaybooksRouting, useAllowPlaybookCreationInCurrentTeam} from 'src/hooks';
import {startPlaybookRunById} from 'src/actions';
import {PillBox} from 'src/components/widgets/pill';
import {Timestamp} from 'src/webapp_globals';
import TextWithTooltipWhenEllipsis from 'src/components/widgets/text_with_tooltip_when_ellipsis';

const Item = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1.5rem 0 2rem;
    margin: 0 2.75rem;
    box-shadow: 0px 1px 0px rgba(var(--center-channel-color-rgb), 0.08);

    &:last-of-type {
        box-shadow: none;
    }

    > div {
        display: flex;
        overflow: hidden;
        flex-direction: column;
    }
`;

const Title = styled.h5`
    font-family: Open Sans;
    font-style: normal;
    font-weight: 600;
    font-size: 14px;
    line-height: 20px;
    margin-top: 0;
    margin-bottom: 0.25rem;

    a {
        display: flex;
        max-width: 100%;
        overflow: hidden;
        padding-right: 1rem;
        span {
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            display: inline-block;
        }
        svg {
            opacity: 0;
            flex-shrink: 0;
            color: rgba(var(--center-channel-color-rgb), 0.72);
            margin: 3px 0 0 3px;
            transition: opacity 0.15s ease-out;
        }
    }
    .app__body & a:hover,
    .app__body & a:focus {
        svg {
            opacity: 1;
        }
    }
    .app__body & a,
    .app__body & a:hover,
    .app__body & a:focus {
        color: var(--center-channel-color);
    }
`;

const Sub = styled.span`
    font-family: Open Sans;
    font-size: 12px;
    line-height: 16px;
    color: rgba(var(--center-channel-color-rgb), 0.72);
    margin-bottom: 1rem;

    .separator {
        margin: 0 0.5rem;
        font-size: 2rem;
        line-height: 12px;
        vertical-align: middle;
        font-weight: 700;
    }
`;

const Meta = styled.div`

`;

const MetaItem = styled(PillBox)`
    font-family: Open Sans;
    font-weight: 600;
    font-size: 11px;
    line-height: 10px;
    height: 20px;
    padding: 3px 8px;
    margin-right: 4px;
    margin-bottom: 4px;
    display: inline-flex;
    align-items: center;
    border-radius: 4px;
    color: rgba(var(--center-channel-color-rgb), 0.72);
    svg {
        margin-right: 4px;
    }
    .separator {
        margin: 0 0.35rem;
        font-size: 2rem;
        line-height: 10px;
        vertical-align: middle;
        font-weight: 700;
    }
`;

const RunButton = styled(SubtlePrimaryButton)`
    width: 7.25rem;
    height: 7.25rem;
    justify-content: center;
    flex-direction: column;
    flex-shrink: 0;

    svg {
        margin-bottom: 0.5rem;
    }
`;

const TIME_SPEC = {
    units: [
        'now',
        'minute',
        ['hour', -48],
        ['day', -30],
        'month',
        'year',
    ],
    useTime: false,
    day: 'numeric',
    style: 'narrow',
};

type RHSHomePlaybookProps = {
    playbook: Playbook;
}

export const RHSHomePlaybook = ({
    playbook: {
        id,
        title,
        num_runs,
        num_stages,
        num_actions,
        last_run_at,
    },
}: RHSHomePlaybookProps) => {
    const dispatch = useDispatch();
    const {formatMessage} = useIntl();
    const currentTeam = useSelector<GlobalState, Team>(getCurrentTeam);
    const {view} = usePlaybooksRouting(currentTeam.name, {urlOnly: true});
    const linkRef = useRef(null);
    return (
        <Item>
            <div>
                <Title>
                    <Link
                        to={view(id)}
                        ref={linkRef}
                    >
                        <TextWithTooltipWhenEllipsis
                            id={`${id})_playbook_item`}
                            text={title}
                            parentRef={linkRef}

                        />
                        <Icon
                            path={mdiOpenInNew}
                            size={0.85}
                        />
                    </Link>
                </Title>
                <Sub>
                    {num_runs > 0 ? (
                        <>
                            <span>
                                {'Last run was '}
                                <Timestamp
                                    value={last_run_at}
                                    {...TIME_SPEC}
                                />
                                <span className='separator'>{'·'}</span>
                            </span>
                        </>
                    ) : null}
                    <span>
                        {formatMessage({
                            id: 'plugin-ic.rhs_home.rhs_home_item.num_runs',
                            defaultMessage: '{num_runs, plural, =0 {Not run yet} one {# run} other {# total runs}}',
                        }, {num_runs})}
                    </span>
                </Sub>
                <Meta>
                    <MetaItem>
                        <Icon
                            path={mdiCheckAll}
                            size={1}
                        />
                        {formatMessage({
                            id: 'plugin-ic.rhs_home.rhs_home_item.num_checklists',
                            defaultMessage: '{num_checklists, plural, =0 {no checklists} one {# checklist} other {# checklists}}',
                        }, {num_checklists: num_stages})}
                    </MetaItem>
                    <MetaItem>
                        <Icon
                            path={mdiSync}
                            size={1}
                        />
                        {formatMessage({
                            id: 'plugin-ic.rhs_home.rhs_home_item.num_actions',
                            defaultMessage: '{num_actions, plural, =0 {no actions} one {# action} other {# actions}}',
                        }, {num_actions})}
                    </MetaItem>
                </Meta>
            </div>
            <RunButton onClick={() => dispatch(startPlaybookRunById(id))}>
                <Icon
                    path={mdiClipboardPlayOutline}
                    size={1.5}
                />
                {'Run'}
            </RunButton>
        </Item>
    );
};

type RHSHomeTemplateProps = {
    title: string;
    template: DraftPlaybookWithChecklist;
    onUse: (template: DraftPlaybookWithChecklist) => void;
}

export const RHSHomeTemplate = ({
    title,
    template,
    onUse,
}: RHSHomeTemplateProps) => {
    const {formatMessage} = useIntl();
    const currentTeam = useSelector(getCurrentTeam);
    const allowPlaybookCreation = useAllowPlaybookCreationInCurrentTeam();
    const {create} = usePlaybooksRouting(currentTeam.name, {urlOnly: true});
    const linkRef = useRef(null);
    return (
        <Item>
            <div>
                <Title ref={linkRef}>
                    <Link
                        to={allowPlaybookCreation ? create(template.title) : ''}
                        onClick={(e) => {
                            e.preventDefault();
                            onUse(template);
                        }}
                        ref={linkRef}
                    >
                        <TextWithTooltipWhenEllipsis
                            id={`${title})_template_item`}
                            text={title}
                            parentRef={linkRef}

                        />
                        <Icon
                            path={mdiOpenInNew}
                            size={0.85}
                        />
                    </Link>
                </Title>
                <Sub/>
                <Meta>
                    <MetaItem>
                        <Icon
                            path={mdiCheckAll}
                            size={1}
                        />
                        {formatMessage({
                            id: 'plugin-ic.rhs_home.rhs_home_item.num_checklists',
                            defaultMessage: '{num_checklists, plural, =0 {no checklists} one {# checklist} other {# checklists}}',
                        }, {num_checklists: template.num_stages})}
                    </MetaItem>
                    <MetaItem>
                        <Icon
                            path={mdiSync}
                            size={1}
                        />
                        {formatMessage({
                            id: 'plugin-ic.rhs_home.rhs_home_item.num_actions',
                            defaultMessage: '{num_actions, plural, =0 {no actions} one {# action} other {# actions}}',
                        }, {num_actions: template.num_actions})}
                    </MetaItem>
                </Meta>
            </div>
            <RunButton onClick={() => onUse(template)}>
                <Icon
                    path={mdiOpenInNew}
                    size={1.5}
                />
                {'Use'}
            </RunButton>
        </Item>
    );
};
