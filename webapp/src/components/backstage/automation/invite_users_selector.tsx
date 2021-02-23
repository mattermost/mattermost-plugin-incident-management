import React, {FC, useState, useEffect} from 'react';

import ReactSelect, {GroupType, ControlProps, OptionsType, MenuListComponentProps} from 'react-select';

import {Scrollbars} from 'react-custom-scrollbars';

import styled from 'styled-components';
import {ActionFunc} from 'mattermost-redux/types/actions';
import {UserProfile} from 'mattermost-redux/types/users';

import Profile from 'src/components/profile/profile';

interface Props {
    userIds: string[];
    onAddUser: (userid: string) => void;
    onRemoveUser: (userid: string) => void;
    searchProfiles: (term: string) => ActionFunc;
    getProfiles: () => ActionFunc;
    isDisabled: boolean;
}

const InviteUsersSelector: FC<Props> = (props: Props) => {
    // When there are no users invited, options is UserProfile[], a plain list. When there is at least one user invited,
    // options contains two groups: the first with invited members, the second with non invited members. This is needed
    // because groups are rendered in the selector list only when there is at least one user invited.
    const [options, setOptions] = useState<UserProfile[] | GroupType<UserProfile>[]>([]);
    const [searchTerm, setSearchTerm] = useState('');

    // Update the options whenever the passed user IDs or the search term are updated
    useEffect(() => {
        const updateOptions = async (term: string) => {
            let profiles;
            if (term.trim().length === 0) {
                profiles = props.getProfiles();
            } else {
                profiles = props.searchProfiles(term);
            }

            //@ts-ignore
            profiles.then(({data}: { data: UserProfile[] }) => {
                const invitedProfiles: UserProfile[] = [];
                const nonInvitedProfiles: UserProfile[] = [];

                data.forEach((profile: UserProfile) => {
                    if (props.userIds.includes(profile.id)) {
                        invitedProfiles.push(profile);
                    } else {
                        nonInvitedProfiles.push(profile);
                    }
                });

                if (invitedProfiles.length === 0) {
                    setOptions(nonInvitedProfiles);
                } else {
                    setOptions([
                        {label: 'INVITED MEMBERS', options: invitedProfiles},
                        {label: 'NON INVITED MEMBERS', options: nonInvitedProfiles},
                    ]);
                }
            }).catch(() => {
                // eslint-disable-next-line no-console
                console.error('Error searching user profiles in custom attribute settings dropdown.');
            });
        };

        updateOptions(searchTerm);
    }, [props.userIds, searchTerm]);

    let badgeContent = '';
    const numInvitedMembers = props.userIds.length;
    if (numInvitedMembers > 0) {
        badgeContent = `${numInvitedMembers} MEMBER${numInvitedMembers > 1 ? 'S' : ''}`;
    }

    // Type guard to check whether the current options is a group or a plain list
    const isGroup = (option: UserProfile | GroupType<UserProfile>): option is GroupType<UserProfile> => (
        (option as GroupType<UserProfile>).label
    );

    return (
        <StyledReactSelect
            badgeContent={badgeContent}
            closeMenuOnSelect={false}
            onInputChange={setSearchTerm}
            options={options}
            filterOption={() => true}
            isDisabled={props.isDisabled}
            isMulti={false}
            controlShouldRenderValue={false}
            onChange={(userAdded: UserProfile) => props.onAddUser(userAdded.id)}
            getOptionValue={(user: UserProfile) => user.id}
            formatOptionLabel={(option: UserProfile) => (
                <UserLabel
                    onRemove={() => props.onRemoveUser(option.id)}
                    id={option.id}
                    invitedUsers={(options.length > 0 && isGroup(options[0])) ? options[0].options : []}
                />
            )}
            defaultMenuIsOpen={false}
            openMenuOnClick={true}
            isClearable={false}
            placeholder={'Search for member'}
            components={{DropdownIndicator: () => null, IndicatorSeparator: () => null, MenuList}}
            styles={{
                control: (provided: ControlProps<UserProfile>) => ({
                    ...provided,
                    minHeight: 34,
                }),
            }}
            classNamePrefix='invite-users-selector'
            captureMenuScroll={false}
        />
    );
};

export default InviteUsersSelector;

interface UserLabelProps {
    onRemove: () => void;
    id: string;
    invitedUsers: OptionsType<UserProfile>;
}

const UserLabel: FC<UserLabelProps> = (props: UserLabelProps) => {
    let icon = <PlusIcon/>;
    if (props.invitedUsers.find((user: UserProfile) => user.id === props.id)) {
        icon = <Remove onClick={props.onRemove}>{'Remove'}</Remove>;
    }

    return (
        <>
            <StyledProfile userId={props.id}/>
            {icon}
        </>
    );
};

const Remove = styled.span`
    display: inline-block;

    font-weight: 600;
    font-size: 12px;
    line-height: 9px;
    color: rgba(var(--center-channel-color-rgb), 0.56);

    :hover {
    cursor: pointer;
    }
`;

const StyledProfile = styled(Profile)`
    && .image {
        width: 24px;
        height: 24px;
    }
`;

const PlusIcon = styled.i`
    // Only shows on hover, controlled in the style from
    // .invite-users-selector__option--is-focused
    display: none;

    :before {
        font-family: compass-icons;
        font-size: 14.4px;
        line-height: 17px;
        color: var(--button-bg);
        content: "\f415";
        font-style: normal;
    }
`;

const StyledReactSelect = styled(ReactSelect)`
    flex-grow: 1;
    background-color: ${(props) => (props.isDisabled ? 'rgba(var(--center-channel-bg-rgb), 0.16)' : 'var(--center-channel-bg)')};

    .invite-users-selector__input {
        color: var(--center-channel-color);
    }

    .invite-users-selector__menu {
        background-color: transparent;
        box-shadow: 0px 8px 24px rgba(0, 0, 0, 0.12);
    }


    .invite-users-selector__option {
        height: 36px;
        padding: 6px 21px 6px 12px;
        display: flex;
        flex-direction: row;
        justify-content: space-between;
        align-items: center;
    }

    .invite-users-selector__option--is-selected {
        background-color: var(--center-channel-bg);
        color: var(--center-channel-color);
    }

    .invite-users-selector__option--is-focused {
        background-color: rgba(var(--button-bg-rgb), 0.04);

        ${PlusIcon} {
            display: inline-block;
        }
    }

    .invite-users-selector__control {
        -webkit-transition: all 0.15s ease;
        -webkit-transition-delay: 0s;
        -moz-transition: all 0.15s ease;
        -o-transition: all 0.15s ease;
        transition: all 0.15s ease;
        transition-delay: 0s;
        background-color: transparent;
        border-radius: 4px;
        border: none;
        box-shadow: inset 0 0 0 1px var(--center-channel-color-16);
        width: 100%;
        height: 4rem;
        font-size: 14px;
        padding-left: 3.2rem;
        padding-right: 16px;

        &--is-focused {
            box-shadow: inset 0 0 0px 2px var(--button-bg);
        }

        &:before {
            left: 16px;
            top: 8px;
            position: absolute;
            color: var(--center-channel-color-56);
            content: '\f349';
            font-size: 18px;
            font-family: 'compass-icons', mattermosticons;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
        }

        &:after {
            padding: 0px 4px;

            /* Light / 8% Center Channel Text */
            background: rgba(var(--center-channel-color-rgb), 0.08);
            border-radius: 4px;


            content: '${(props) => !props.isDisabled && props.badgeContent}';

            font-weight: 600;
            font-size: 10px;
            line-height: 16px;
        }
    }

    .invite-users-selector__option {
        &:active {
            background-color: var(--center-channel-color-08);
        }
    }

    .invite-users-selector__group-heading {
        height: 32px;
        padding: 8px 12px 8px;
        font-size: 12px;
        font-weight: 600;
        line-height: 16px;
        color: rgba(var(--center-channel-color-rgb), 0.56);
    }
`;

const MenuListWrapper = styled.div`
    background-color: var(--center-channel-bg);
    border: 1px solid rgba(var(--center-channel-color-rgb), 0.16);
    border-radius: 4px;

    max-height: 280px;
`;

const MenuHeaderHeight = 44;

const MenuHeader = styled.div`
    height: ${MenuHeaderHeight}px;
    padding: 16px 0 12px 14px;
    font-size: 14px;
    font-weight: 600;
    border-bottom: 1px solid rgba(var(--center-channel-color-rgb), 0.08);
    line-height: 16px;
`;

const StyledScrollbars = styled(Scrollbars)`
    height: ${300 - MenuHeaderHeight}px;
`;

const ThumbVertical = styled.div`
    background-color: rgba(var(--center-channel-color-rgb), 0.24);
    border-radius: 2px;
    width: 4px;
    min-height: 45px;
    margin-left: -2px;
    margin-top: 6px;
`;

const MenuList = (props: MenuListComponentProps<UserProfile>) => {
    return (
        <MenuListWrapper>
            <MenuHeader>{'Invite Members'}</MenuHeader>
            <StyledScrollbars
                autoHeight={true}
                renderThumbVertical={({style, ...thumbProps}) => <ThumbVertical {...thumbProps}/>}
            >
                {props.children}
            </StyledScrollbars>
        </MenuListWrapper>
    );
};
