// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import styled from 'styled-components';

import {Chip} from 'src/components/backstage/automation/chip';
import {AutomationHeader, AutomationTitle, SelectorWrapper} from 'src/components/backstage/automation/styles';
import {Toggle} from 'src/components/backstage/automation/toggle';

interface Props {
    enabled: boolean;
    textOnToggle: string;
    onToggle: () => void;
    placeholderText: string;
    keywords: string[];
    onAppendKeyword: (keyword: string) => void;
    onRemoveKeyword: (i: number) => void;
}

export const InputKeywords = (props: Props) => {
    const inputKeyDown = (e: React.KeyboardEvent) => {
        const input = e.target as HTMLInputElement;
        const val = input.value;
        if (e.key === 'Enter' && val) {
            if (!props.keywords.includes(val)) {
                props.onAppendKeyword(val);
                input.scrollIntoView({behavior: 'smooth', block: 'nearest', inline: 'nearest'});
            }
            input.value = '';
        } else if (e.key === 'Backspace' && !val) {
            props.onRemoveKeyword(props.keywords.length - 1);
        }
    };

    return (
        <AutomationHeader>
            <AutomationTitle>
                <Toggle
                    isChecked={props.enabled}
                    onChange={props.onToggle}
                />
                <div>{props.textOnToggle}</div>
            </AutomationTitle>
            <SelectorWrapper>
                <StyledInputKeywords
                    enabled={props.enabled}
                >
                    <StyledKeywords>
                        {props.enabled ? props.keywords.map((keyword, i) => (
                            <li key={keyword}>
                                <Chip
                                    onDelete={() => {
                                        props.onRemoveKeyword(i);
                                    }}
                                    text={keyword}
                                />
                            </li>
                        )) : ''}
                        <TextBox
                            disabled={!props.enabled}
                            enabled={props.enabled}
                            key={'keywords-input'}
                            type='text'
                            onKeyDown={inputKeyDown}
                            placeholder={props.placeholderText}
                        />
                    </StyledKeywords>
                </StyledInputKeywords>
            </SelectorWrapper>
        </AutomationHeader>
    );
};

interface StyledInputKeywordsProps {
    enabled: boolean;
}

const StyledInputKeywords = styled.div<StyledInputKeywordsProps>`
    display: flex;
    height: 100%;
    width: 100%;
    overflow-x: auto;
    overflow-y: hidden;
    background-color: ${(props) => (props.enabled ? 'var(--center-channel-bg)' : 'rgba(var(--center-channel-bg-rgb), 0.16)')};
    color: var(--center-channel-color);
    box-shadow: inset 0 0 0 1px var(--center-channel-color-16);
`;

const StyledKeywords = styled.ul`
    display: inline-flex;
    margin: 0;
    padding-left: 16px;
    width: 100%;
    align-items: center;

    li {
        list-style: none;
    }
`;

interface TextBoxProps {
    enabled: boolean;
}

const TextBox = styled.input<TextBoxProps>`
    ::placeholder {
        color: var(--center-channel-color);
        opacity: 0.64;
    }

    height: 95%;
    width: 95%;
    min-width: 150px;

    background-color: ${(props) => (props.enabled ? 'var(--center-channel-bg)' : 'rgba(var(--center-channel-bg-rgb), 0.16)')};
    color: var(--center-channel-color);
    border: none;
    font-size: 14px;
    margin: 1px 1px 1px 1px;
`;
