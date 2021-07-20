// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useState} from 'react';
import ReactSelect, {ActionTypes, ControlProps, StylesConfig} from 'react-select';
import classNames from 'classnames';
import styled from 'styled-components';
import {Team} from 'mattermost-redux/types/teams';

import {useClientRect} from 'src/hooks';

import TeamWithIcon from './team_with_icon';

interface Option {
    value: string;
    label: JSX.Element | string;
    teamId: string;
}

interface ActionObj {
    action: ActionTypes;
}

interface Props {
    testId?: string
    selectedTeamId?: string;
    placeholder: React.ReactNode;
    placeholderButtonClass?: string;
    onlyPlaceholder?: boolean;
    enableEdit: boolean;
    isClearable?: boolean;
    customControl?: (props: ControlProps<any>) => React.ReactElement;
    controlledOpenToggle?: boolean;
    teams: Team[];
    onSelectedChange?: (teamId?: string) => void;
    customControlProps?: any;
    showOnRight?: boolean;
}

const dropdownYShift = 27;

export default function TeamSelector(props: Props) {
    const [isOpen, setOpen] = useState(false);
    const toggleOpen = () => {
        if (!isOpen) {
            updateTeamOptions();
        }
        setOpen(!isOpen);
    };

    // Allow the parent component to control the open state -- only after mounting.
    const [oldOpenToggle, setOldOpenToggle] = useState(props.controlledOpenToggle);
    useEffect(() => {
        // eslint-disable-next-line no-undefined
        if (props.controlledOpenToggle !== undefined && props.controlledOpenToggle !== oldOpenToggle) {
            setOpen(!isOpen);
            setOldOpenToggle(props.controlledOpenToggle);
        }
    }, [props.controlledOpenToggle]);

    const [teamOptions, setTeamOptions] = useState<Option[]>([]);

    function updateTeamOptions() {
        const optionList = props.teams.map((team: Team) => {
            return ({
                value: team.display_name,
                label: (
                    <TeamWithIcon
                        team={team}
                        allowed={true}
                    />
                ),
                teamId: team.id,
            } as Option);
        });

        setTeamOptions(optionList);
    }

    // Fill in the userOptions on mount.
    useEffect(() => {
        updateTeamOptions();
    }, []);

    const [selected, setSelected] = useState<Option | null>(null);

    function getTeam(teamId: string) {
        return props.teams.filter((team) => team.id === teamId)[0];
    }

    // Whenever the selectedTeamId changes we have to set the selected, but we can only do this once we
    // have TeamOptions
    useEffect(() => {
        if (teamOptions === []) {
            return;
        }

        const team = teamOptions.find((option: Option) => option.teamId === props.selectedTeamId);
        if (team) {
            setSelected(team);
        } else {
            setSelected(null);
        }
    }, [teamOptions, props.selectedTeamId]);

    const onSelectedChange = async (value: Option | undefined, action: ActionObj) => {
        if (action.action === 'clear') {
            return;
        }
        toggleOpen();
        if (value?.teamId === selected?.teamId) {
            return;
        }
        if (props.onSelectedChange) {
            props.onSelectedChange(value?.teamId);
        }
    };

    // Decide where to open the team selector
    const [rect, ref] = useClientRect();
    const [moveUp, setMoveUp] = useState(0);

    useEffect(() => {
        if (!rect) {
            setMoveUp(0);
            return;
        }

        const innerHeight = window.innerHeight;
        const numTeamsShown = Math.min(6, teamOptions.length);
        const spacePerProfile = 48;
        const dropdownReqSpace = 80;
        const extraSpace = 10;
        const dropdownBottom = rect.top + dropdownYShift + dropdownReqSpace + (numTeamsShown * spacePerProfile) + extraSpace;
        setMoveUp(Math.max(0, dropdownBottom - innerHeight));
    }, [rect, teamOptions.length]);
    let target;
    if (props.selectedTeamId) {
        target = (
            <TeamButton
                onClick={() => {
                    if (props.enableEdit) {
                        toggleOpen();
                    }
                }}
            >
                <TeamWithIcon
                    team={getTeam(props.selectedTeamId)}
                    allowed={true}
                />

                {<i className='icon-chevron-down ml-1 mr-2'/>}
            </TeamButton>
        );
    } else {
        target = (
            <button
                onClick={() => {
                    if (props.enableEdit) {
                        toggleOpen();
                    }
                }}
                className={props.placeholderButtonClass || 'PlaybookRunFilter-button' + (isOpen ? ' active' : '')}
            >
                {selected === null ? props.placeholder : selected.label}
                {<i className='icon-chevron-down icon--small ml-2'/>}
            </button>
        );
    }

    if (props.onlyPlaceholder) {
        target = (
            <div
                onClick={toggleOpen}
            >
                {props.placeholder}
            </div>
        );
    }
    const targetWrapped = (
        <div
            data-testid={props.testId}
            ref={ref}
        >
            {target}
        </div>
    );

    const noDropdown = {DropdownIndicator: null, IndicatorSeparator: null};
    const components = props.customControl ? {
        ...noDropdown,
        Control: props.customControl,
    } : noDropdown;

    return (
        <Dropdown
            isOpen={isOpen}
            onClose={toggleOpen}
            target={targetWrapped}
            showOnRight={props.showOnRight}
            moveUp={moveUp}
        >
            <ReactSelect
                autoFocus={true}
                backspaceRemovesValue={false}
                components={components}
                controlShouldRenderValue={false}
                hideSelectedOptions={false}
                isClearable={props.isClearable}
                menuIsOpen={true}
                options={teamOptions}
                placeholder={'Search'}
                styles={selectStyles}
                tabSelectsValue={false}
                value={selected}
                onChange={(option, action) => onSelectedChange(option as Option, action as ActionObj)}
                classNamePrefix='playbook-run-user-select'
                className='playbook-run-user-select'
                {...props.customControlProps}
            />
        </Dropdown>
    );
}

// styles for the select component
const selectStyles: StylesConfig = {
    control: (provided) => ({...provided, minWidth: 240, margin: 8}),
    menu: () => ({boxShadow: 'none'}),
    option: (provided, state) => {
        const hoverColor = 'rgba(20, 93, 191, 0.08)';
        const bgHover = state.isFocused ? hoverColor : 'transparent';
        return {
            ...provided,
            backgroundColor: state.isSelected ? hoverColor : bgHover,
            color: 'unset',
        };
    },
};

// styled components
interface DropdownProps {
    children: JSX.Element;
    isOpen: boolean;
    showOnRight?: boolean;
    moveUp?: number;
    target: JSX.Element;
    onClose: () => void;
}

const ProfileDropdown = styled.div`
    position: relative;
`;

const Blanket = styled.div`
    bottom: 0;
    left: 0;
    top: 0;
    right: 0;
    position: fixed;
    z-index: 1;
`;

interface ChildContainerProps {
    moveUp?: number
}

const ChildContainer = styled.div<ChildContainerProps>`
    top: ${(props) => dropdownYShift - (props.moveUp || 0)}px;
`;

const Dropdown = ({children, isOpen, showOnRight, moveUp, target, onClose}: DropdownProps) => {
    if (!isOpen) {
        return target;
    }

    const classes = classNames('PlaybookRunFilter', 'profile-dropdown',
        'PlaybookRunFilter--active', 'profile-dropdown--active', {'show-on-right': showOnRight});

    return (
        <ProfileDropdown className={classes}>
            {target}
            <ChildContainer
                className='PlaybookRunFilter-select playbook-run-user-select__container'
                moveUp={moveUp}
            >
                {children}
            </ChildContainer>
            <Blanket onClick={onClose}/>
        </ProfileDropdown>
    );
};

const TeamButton = styled.button`
    font-weight: 600;
    height: 40px;
    padding: 0 4px 0 12px;
    border-radius: 4px;
    color: var(--center-channel-color);

    -webkit-transition: all 0.15s ease;
    -webkit-transition-delay: 0s;
    -moz-transition: all 0.15s ease;
    -o-transition: all 0.15s ease;
    transition: all 0.15s ease;

    border: none;
    background-color: unset;
    cursor: unset;
    display: flex;
    align-items: center;
    text-align: center;

    &:hover {
        background: var(--center-channel-color-08);
        color: var(--center-channel-color-72);
    }

    .PlaybookRunProfile {
        &:active {
            background: var(--button-bg-08);
            color: var(--button-bg);
        }

        &.active {
            cursor: pointer;
            color: var(--center-channel-color);
        }
    }
    

    .NoAssignee-button, .Assigned-button {
        background-color: transparent;
        border: none;
        padding: 4px;
        margin-top: 4px;
        border-radius: 100px;
        color: var(--center-channel-color-64);
        cursor: pointer;
        font-weight: normal;
        font-size: 12px;
        line-height: 16px;

        -webkit-transition: all 0.15s ease;
        -moz-transition: all 0.15s ease;
        -o-transition: all 0.15s ease;
        transition: all 0.15s ease;

        &:hover {
            background: var(--center-channel-color-08);
            color: var(--center-channel-color-72);
        }

        &:active {
            background: var(--button-bg-08);
            color: var(--button-bg);
        }

        &.active {
            cursor: pointer;
        }

        .icon-chevron-down {
            &:before {
                margin: 0;
            }
        }
    }

    .first-container .Assigned-button {
        margin-top: 0;
        padding: 2px 0;
        font-size: 14px;
        line-height: 20px;
        color: var(--center-channel-color);
    }
`;