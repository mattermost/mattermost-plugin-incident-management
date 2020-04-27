// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License for license information.

import React from 'react';

interface Props {
    theme: Record<string, string>;
}

export default class IncidentPostMenuIcon extends React.PureComponent<Props> {
    public render(): JSX.Element {
        const iconStyle = {flex: '0 0 auto', width: '20px', height: '20px', borderRadius: '50px', padding: '2px'};

        return (
            <span className='MenuItem__icon'>
                <svg
                    aria-hidden='true'
                    focusable='false'
                    role='img'
                    viewBox='0 0 16 16'
                    width='16'
                    height='16'
                    fill='none'
                    xmlns='http://www.w3.org/2000/svg'
                    style={iconStyle}
                >
                    <path
                        d='M8 0C6.56 0 5.216 0.368 3.968 1.104C2.76267 1.808 1.808 2.76267 1.104 3.968C0.368 5.216 0 6.56 0 8C0 9.44 0.368 10.784 1.104 12.032C1.808 13.2373 2.76267 14.192 3.968 14.896C5.216 15.632 6.56 16 8 16C9.44 16 10.784 15.632 12.032 14.896C13.2373 14.192 14.192 13.2373 14.896 12.032C15.632 10.784 16 9.44 16 8C16 6.56 15.632 5.216 14.896 3.968C14.192 2.76267 13.2373 1.808 12.032 1.104C10.784 0.368 9.44 0 8 0ZM8 14.4C6.848 14.4 5.776 14.1067 4.784 13.52C3.81333 12.9547 3.04533 12.1867 2.48 11.216C1.89333 10.224 1.6 9.152 1.6 8C1.6 6.848 1.89333 5.776 2.48 4.784C3.04533 3.81333 3.81333 3.04533 4.784 2.48C5.776 1.89333 6.848 1.6 8 1.6C9.152 1.6 10.224 1.89333 11.216 2.48C12.1867 3.04533 12.9547 3.81333 13.52 4.784C14.1067 5.776 14.4 6.848 14.4 8C14.4 9.152 14.1067 10.224 13.52 11.216C12.9547 12.1867 12.1867 12.9547 11.216 13.52C10.224 14.1067 9.152 14.4 8 14.4ZM8.4 8.8H7.6L7.2 4H8.8L8.4 8.8ZM8.8 11.2C8.8 11.424 8.72 11.616 8.56 11.776C8.41067 11.9253 8.224 12 8 12C7.776 12 7.584 11.9253 7.424 11.776C7.27467 11.616 7.2 11.424 7.2 11.2C7.2 10.976 7.27467 10.7893 7.424 10.64C7.584 10.48 7.776 10.4 8 10.4C8.224 10.4 8.41067 10.48 8.56 10.64C8.72 10.7893 8.8 10.976 8.8 11.2Z'
                        fill={this.props.theme.buttonBg}
                    />
                </svg>
            </span>
        );
    }
}
