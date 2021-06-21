// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {Bar} from 'react-chartjs-2';
import styled from 'styled-components';

const GraphBoxContainer = styled.div`
    padding: 10px;
`;

interface BarGraphProps {
    title: string
    xlabel?: string
    data?: number[]
    labels?: string[]
    className?: string
    color?: string
    tooltipTitleCallback?: (xLabel: string) => string
    tooltipLabelCallback?: (yLabel: number) => string
    onClick?: (index: number) => void
}

const BarGraph = (props: BarGraphProps) => {
    const style = getComputedStyle(document.body);
    const centerChannelFontColor = style.getPropertyValue('--center-channel-color');
    const colorName = props.color ? props.color : '--button-bg';
    const color = style.getPropertyValue(colorName);
    return (
        <GraphBoxContainer className={props.className}>
            <Bar
                legend={{display: false}}
                options={{
                    title: {
                        display: true,
                        text: props.title,
                        fontColor: centerChannelFontColor,
                    },
                    scales: {
                        yAxes: [{
                            ticks: {
                                beginAtZero: true,
                                fontColor: centerChannelFontColor,
                            },
                        }],
                        xAxes: [{
                            scaleLabel: {
                                display: Boolean(props.xlabel),
                                labelString: props.xlabel,
                                fontColor: centerChannelFontColor,
                            },
                            ticks: {
                                callback: (val: any, index: number) => {
                                    return (index % 2) === 0 ? val : '';
                                },
                                fontColor: centerChannelFontColor,
                                maxRotation: 0,
                            },
                        }],
                    },
                    tooltips: {
                        callbacks: {
                            title(tooltipItems: any) {
                                if (props.tooltipTitleCallback) {
                                    return props.tooltipTitleCallback(tooltipItems[0].xLabel);
                                }
                                return tooltipItems[0].xLabel;
                            },
                            label(tooltipItem: any) {
                                if (props.tooltipLabelCallback) {
                                    return props.tooltipLabelCallback(tooltipItem.yLabel);
                                }
                                return tooltipItem.yLabel;
                            },
                        },
                        displayColors: false,
                    },
                    onClick(event: any, element: any) {
                        if (!props.onClick) {
                            return;
                        } else if (element.length === 0) {
                            props.onClick(-1);
                            return;
                        }
                        // eslint-disable-next-line no-underscore-dangle
                        props.onClick(element[0]._index);
                    },
                    maintainAspectRatio: false,
                    responsive: true,
                }}
                data={{
                    labels: props.labels,
                    datasets: [{
                        fill: false,
                        tension: 0,
                        backgroundColor: color,
                        borderColor: color,
                        pointBackgroundColor: color,
                        pointBorderColor: '#fff',
                        pointHoverBackgroundColor: '#fff',
                        pointHoverBorderColor: color,
                        data: props.data,
                    }],
                }}
            />
        </GraphBoxContainer>
    );
};

export default BarGraph;
