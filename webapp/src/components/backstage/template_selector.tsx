// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import styled from 'styled-components';

import {Team} from 'mattermost-redux/types/teams';

import {Playbook, emptyPlaybook, newChecklistItem, defaultMessageOnJoin} from 'src/types/playbook';
import FileIcon from 'src/components/assets/icons/file_icon';
import AlertIcon from 'src/components/assets/icons/alert_icon';
import {useAllowPlaybookCreationInCurrentTeam} from 'src/hooks';

import UpgradeBadge from 'src/components/backstage/upgrade_badge';

import CreatePlaybookTeamSelector from 'src/components/team/create_playbook_team_selector';

export interface PresetTemplate {
    title: string;
    icon: JSX.Element;
    template: Playbook;
}

export const PresetTemplates: PresetTemplate[] = [
    {
        title: 'Blank',
        icon: <FileIcon/>,
        template: emptyPlaybook(),
    },
    {
        title: 'Service Outage Incident',
        icon: <AlertIcon/>,
        template: {
            ...emptyPlaybook(),
            title: 'Service Outage Incident',
            description: '### Summary\n\nDescribe the incident so that someone without prior knowledge can ramp up quickly. Two sentences is the ideal length.\n\n' +
                '### Impact\n\nDescribe the customer and organizational impact of this incident.',
            reminder_message_template: '### Incident update\n\nDescribe progress and changes to the incident since the last update.\n\n' +
                '### Change to customer impact\n\nDescribe any changes to customer impact since the last update.',
            message_on_join: defaultMessageOnJoin,
            checklists: [
                {
                    title: 'Triage',
                    items: [
                        newChecklistItem('Announce incident type and resources', '', '/echo ""'),
                        newChecklistItem('Acknowledge alert'),
                        newChecklistItem('Get alert info'),
                        newChecklistItem('Invite escalators'),
                        newChecklistItem('Determine priority'),
                        newChecklistItem('Update alert priority'),
                        newChecklistItem('Create a JIRA ticket', '', '/jira create'),
                        newChecklistItem('Find out who’s on call', '', '/genie whoisoncall'),
                        newChecklistItem('Announce incident'),
                        newChecklistItem('Invite on-call lead'),
                    ],
                },
                {
                    title: 'Investigation',
                    items: [
                        newChecklistItem('Perform initial investigation'),
                        newChecklistItem('Escalate to other on-call members (optional)'),
                        newChecklistItem('Escalate to other engineering teams (optional)'),
                    ],
                },
                {
                    title: 'Resolution',
                    items: [
                        newChecklistItem('Close alert'),
                        newChecklistItem('End the incident', '', '/playbook end'),
                        newChecklistItem('Schedule a post-mortem'),
                        newChecklistItem('Record post-mortem action items'),
                        newChecklistItem('Update playbook with learnings'),
                        newChecklistItem('Export channel message history', '', '/export'),
                        newChecklistItem('Archive this channel', '', ''),
                    ],
                },
            ],
        },
    },
];

const RootContainer = styled.div`
    display: flex;
    flex-direction: column;
    overflow-x: auto;
    padding: 32px 20px;
    background: rgba(var(--center-channel-color-rgb), 0.03);
`;

// BackgroundColorContainer hides the left dots from showing over the template selector.
const BackgroundColorContainer = styled.div`
    position: relative;
    background: var(--center-channel-bg);
`;

const InnerContainer = styled.div`
    max-width: 1120px;
    width: 100%;
    margin: 0 auto;
`;

const Title = styled.div`
    display: flex;
    align-items: center;

    font-family: Open Sans;
    font-style: normal;
    font-weight: 600;
    font-size: 16px;
    line-height: 24px;
    color: var(--center-channel-color);
`;

const TemplateItemContainer = styled.div`
    display: flex;
    flex-direction: column;
    cursor: pointer;
    min-width: 198px;
`;

const TemplateItemDiv = styled.div`
    display: flex;
    flex-direction: row;
    overflow-x: auto;
    padding: 20px 0;
    > ${TemplateItemContainer.selector}:nth-child(n+1) {
        margin-right: 32px;
    }
`;

const PositionedUpgradeBadge = styled(UpgradeBadge)`
    margin-left: 8px;
`;

interface Props {
    templates?: PresetTemplate[];
    teams: Team[];
    allowPlaybookCreationInTeams: Map<string, boolean>;
    onSelect: (team: Team, t: PresetTemplate) => void
}

const TemplateSelector = ({templates = PresetTemplates, onSelect, teams, allowPlaybookCreationInTeams}: Props) => {
    const allowPlaybookCreation = useAllowPlaybookCreationInCurrentTeam();

    return (
        <BackgroundColorContainer>
            <RootContainer>
                <InnerContainer>
                    <Title>
                        {'Create a playbook'}
                        {!allowPlaybookCreation && <PositionedUpgradeBadge/>}
                    </Title>
                    <TemplateItemDiv>
                        {
                            templates.map((template: PresetTemplate) => (
                                <CreatePlaybookTeamSelector
                                    key={template.title}
                                    testId={'template-item-team-selector'}
                                    enableEdit={true}
                                    teams={teams}
                                    allowPlaybookCreationInTeams={allowPlaybookCreationInTeams}
                                    onSelectedChange={(team) => {
                                        onSelect(team, template);
                                    }}
                                    withButton={false}
                                >
                                    <TemplateItem
                                        title={template.title}
                                    >
                                        {template.icon}
                                    </TemplateItem>
                                </CreatePlaybookTeamSelector>
                            ))
                        }
                    </TemplateItemDiv>
                </InnerContainer>
            </RootContainer>
        </BackgroundColorContainer>
    );
};

interface TemplateItemProps {
    title: string;
    children: JSX.Element[] | JSX.Element;
}

const IconContainer = styled.div`
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--center-channel-bg);
    height: 156px;
    border: 1px solid rgba(var(--center-channel-color-rgb), 0.16);
    box-sizing: border-box;
    border-radius: 8px;
`;

const TemplateTitle = styled.div`
    font-family: Open Sans;
    font-style: normal;
    font-weight: 600;
    font-size: 14px;
    line-height: 20px;
    color: var(--center-channel-color);
    padding: 20px 0 0 0;
    text-align: center;
`;

const TemplateItem = (props: TemplateItemProps) => {
    return (
        <TemplateItemContainer>
            <IconContainer>{props.children}</IconContainer>
            <TemplateTitle>{props.title}</TemplateTitle>
        </TemplateItemContainer>
    );
};

export default TemplateSelector;
