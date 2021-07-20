import React, {useState} from 'react';

import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';
import {ActionFunc} from 'mattermost-redux/types/actions';
import {GlobalState} from 'mattermost-redux/types/store';
import {useSelector} from 'react-redux';

import styled from 'styled-components';

import {Playbook} from 'src/types/playbook';
import {useAllowPlaybookGranularAccess} from 'src/hooks';
import {AdminNotificationType} from 'src/constants';
import UpgradeBadge from 'src/components/backstage/upgrade_badge';

import UpgradeModal from 'src/components/backstage/upgrade_modal';

import SelectUsersBelow from './select_users_below';
import {BackstageSubheader, BackstageSubheaderDescription, RadioContainer, RadioInput, RadioLabel} from './styles';

export interface SharePlaybookProps {
    currentUserId: string;
    onAddUser: (userid: string) => void;
    onRemoveUser: (userid: string) => void;
    onClear: () => void;
    searchProfiles: (term: string) => ActionFunc;
    getProfiles: () => ActionFunc;
    memberIds: Playbook['member_ids'];
}

const UserSelectorWrapper = styled.div`
    margin-left: 24px;
    width: 400px;
    height: 40px;
`;

const selectCurrentTeamName = (state: GlobalState) => getCurrentTeam(state).name;

const SharePlaybook = (props: SharePlaybookProps) => {
    const allowPlaybookGranularAccess = useAllowPlaybookGranularAccess();
    const [showModal, setShowModal] = useState(false);

    const currentTeamName = useSelector<GlobalState, string>(selectCurrentTeamName);

    const enabled = props.memberIds.length > 0;

    const handleDisable = () => {
        props.onClear();
    };

    const handleEnable = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!allowPlaybookGranularAccess) {
            setShowModal(true);
            e.preventDefault();
            return;
        }

        if (!enabled) {
            props.onAddUser(props.currentUserId);
        }
    };

    return (
        <>
            <BackstageSubheader>
                {'Playbook access'}
            </BackstageSubheader>
            <RadioContainer>
                <RadioLabel>
                    <RadioInput
                        type='radio'
                        name='enabled'
                        value='disabled'
                        checked={!enabled}
                        onChange={handleDisable}
                    />
                    {'Everyone on this team ('}
                    <b>{currentTeamName}</b>
                    {') can access.'}
                </RadioLabel>
                <RadioLabel>
                    <RadioInput
                        type='radio'
                        name='enabled'
                        value='enabled'
                        checked={enabled}
                        onChange={handleEnable}
                    />
                    {'Only selected users can access.'}
                    {!allowPlaybookGranularAccess && <PositionedUpgradeBadge/>}
                </RadioLabel>
            </RadioContainer>
            {enabled &&
                <UserSelectorWrapper>
                    <BackstageSubheaderDescription>
                        {'Only users who you select will be able to edit or run this playbook.'}
                    </BackstageSubheaderDescription>
                    <SelectUsersBelow
                        userIds={props.memberIds}
                        onAddUser={props.onAddUser}
                        onRemoveUser={props.onRemoveUser}
                        searchProfiles={props.searchProfiles}
                        getProfiles={props.getProfiles}
                    />
                </UserSelectorWrapper>
            }
            <UpgradeModal
                messageType={AdminNotificationType.PLAYBOOK_GRANULAR_ACCESS}
                show={showModal}
                onHide={() => setShowModal(false)}
            />
        </>
    );
};

const PositionedUpgradeBadge = styled(UpgradeBadge)`
    margin-left: 8px;
    margin-top: 2px;
`;

export default SharePlaybook;
