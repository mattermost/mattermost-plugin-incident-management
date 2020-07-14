// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';
import moment from 'moment';

import {ChecklistItem} from 'src/types/playbook';
import {MAX_NAME_LENGTH} from 'src/constants';

import Spinner from './assets/icons/spinner';

interface ChecklistItemDetailsProps {
    checklistItem: ChecklistItem;
    disabled: boolean;
    onChange?: (item: boolean) => void;
    onRedirect?: () => void;
}

// @ts-ignore
const {formatText, messageHtmlToComponent} = window.PostUtils;

const markdownOptions = {singleline: true, mentionHighlight: false, atMentions: true};

export const ChecklistItemDetails = ({checklistItem, disabled, onChange, onRedirect}: ChecklistItemDetailsProps): React.ReactElement => {
    const [spinner, setSpinner] = useState(false);

    let timestamp = '';
    let title = checklistItem.title;
    if (checklistItem.checked) {
        const checkedModified = moment(checklistItem.checked_modified);

        // Avoid times before 2020 since those are errors
        if (checkedModified.isSameOrAfter('2020-01-01')) {
            timestamp = '(' + checkedModified.calendar(undefined, {sameDay: 'LT'}) + ')'; //eslint-disable-line no-undefined
        }
        title += ' ';
    }

    let activation = (
        <input
            className='checkbox'
            type='checkbox'
            disabled={disabled}
            readOnly={!onChange}
            checked={checklistItem.checked}
            onClick={() => {
                if (!disabled && onChange) {
                    onChange(!checklistItem.checked);
                }
            }}
        />
    );
    if (checklistItem.command) {
        if (checklistItem.checked) {
            activation = (
                <button
                    type='button'
                    disabled={true}
                >
                    {'Done'}
                </button>
            );
        } else {
            activation = (
                <button
                    type='button'
                    onClick={() => {
                        if (onChange && !disabled) {
                            onChange(true);
                            setSpinner(true);
                        }
                    }}
                >
                    {spinner ? <Spinner/> : 'Run'}
                </button>
            );
        }
    }

    return (
        <div
            className={'checkbox-container live' + (disabled ? ' light' : '')}
        >
            {activation}
            <label>
                {messageHtmlToComponent(formatText(title, markdownOptions), true, {})}
            </label>
            <a
                className={'timestamp small'}
                href={`/_redirect/pl/${checklistItem.checked_post_id}`}
                onClick={(e) => {
                    e.preventDefault();
                    if (!checklistItem.checked_post_id) {
                        return;
                    }

                    // @ts-ignore
                    window.WebappUtils.browserHistory.push(`/_redirect/pl/${checklistItem.checked_post_id}`);
                    if (onRedirect) {
                        onRedirect();
                    }
                }}
            >
                {timestamp}
            </a>
        </div>
    );
};

interface ChecklistItemDetailsEditProps {
    checklistItem: ChecklistItem;
    onEdit: (newvalue: ChecklistItem) => void;
    onRemove: () => void;
}

export const ChecklistItemDetailsEdit = ({checklistItem, onEdit, onRemove}: ChecklistItemDetailsEditProps): React.ReactElement => {
    const [title, setTitle] = useState(checklistItem.title);
    const [command, setCommand] = useState(checklistItem.command);

    const submit = () => {
        const trimmedTitle = title.trim();
        const trimmedCommand = command.trim();
        if (trimmedTitle === '') {
            setTitle(checklistItem.title);
            return;
        }
        if (trimmedTitle !== checklistItem.title || trimmedCommand !== checklistItem.command) {
            onEdit({...checklistItem, ...{title: trimmedTitle, command: trimmedCommand}});
        }
    };

    return (
        <div
            className='checkbox-container'
        >
            <i
                className='icon icon-menu pr-2'
            />
            <div className='checkbox-textboxes'>
                <input
                    className='form-control'
                    type='text'
                    value={title}
                    maxLength={MAX_NAME_LENGTH}
                    onClick={(e) => e.stopPropagation()}
                    onBlur={submit}
                    placeholder={'Title'}
                    onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                            submit();
                        }
                    }}
                    onChange={(e) => {
                        setTitle(e.target.value);
                    }}
                />
                <input
                    className='form-control'
                    type='text'
                    value={command}
                    onBlur={submit}
                    placeholder={'/Slash Command'}
                    onClick={(e) => e.stopPropagation()}
                    onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                            submit();
                        }
                    }}
                    onChange={(e) => {
                        setCommand(e.target.value);
                    }}
                />
            </div>
            <span
                onClick={onRemove}
                className='checkbox-container__close'
            >
                <i className='icon icon-close'/>
            </span>
        </div>
    );
};
