// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';

import ReactSelect from 'react-select';

import './status_filter.scss';

interface Props {
    onChange: (newStatus: string) => void;
}

interface Option {
    value: string;
    label: string;
}

const fixedOptions: Option[] = [
    {value: 'active', label: 'Ongoing'},
    {value: 'ended', label: 'Ended'},
    {value: 'all', label: 'All'},
];

export function StatusFilter(props: Props) {
    const [isOpen, setOpen] = useState(false);
    const toggleOpen = () => {
        setOpen(!isOpen);
    };

    const [selected, setSelected] = useState<Option>(fixedOptions[2]);

    const onSelectedChange = async (val: Option) => {
        toggleOpen();
        if (val !== selected) {
            props.onChange(val.value);
            setSelected(val);
        }
    };

    return (
        <Dropdown
            isOpen={isOpen}
            onClose={toggleOpen}
            target={
                <button
                    onClick={toggleOpen}
                    className='IncidentFilter-button'
                >
                    {selected.value === 'all' ? 'Status' : selected.label}
                    {<i className='icon-chevron-down icon--small ml-2'/>}
                </button>
            }
        >
            <ReactSelect
                autoFocus={true}
                backspaceRemovesValue={false}
                components={{DropdownIndicator: null, IndicatorSeparator: null}}
                controlShouldRenderValue={false}
                hideSelectedOptions={false}
                isClearable={false}
                isSearchable={false}
                menuIsOpen={true}
                options={fixedOptions}
                styles={selectStyles}
                tabSelectsValue={false}
                onChange={(option) => onSelectedChange(option as Option)}
                classNamePrefix='status-filter-select'
                className='status-filter-select'
            />
        </Dropdown>
    );
}

// styles for the select component
const selectStyles = {
    control: (provided) => ({...provided, height: 0, minHeight: 0}),
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
    target: JSX.Element;
    onClose: () => void;
}

const Dropdown = ({children, isOpen, target, onClose}: DropdownProps) => (
    <div
        className={`IncidentFilter status-filter-dropdown${isOpen ? ' IncidentFilter--active status-filter-dropdown--active' : ''}`}
        css={{position: 'relative'}}
    >
        {target}
        {isOpen ? <Menu className='IncidentFilter-select status-filter-select__container'>{children}</Menu> : null}
        {isOpen ? <Blanket onClick={onClose}/> : null}
    </div>
);

const Menu = (props: Record<string, any>) => {
    return (
        <div {...props}/>
    );
};

const Blanket = (props: Record<string, any>) => (
    <div
        css={{
            bottom: 0,
            left: 0,
            top: 0,
            right: 0,
            position: 'fixed',
            zIndex: 1,
        }}
        {...props}
    />
);

