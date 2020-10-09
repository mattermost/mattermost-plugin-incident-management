import moment from 'moment';

import {renderDuration} from './duration';

it('renderDuration', () => {
    expect(renderDuration(moment.duration({seconds: 0}))).toEqual('< 1m');
    expect(renderDuration(moment.duration({seconds: 59}))).toEqual('< 1m');
    expect(renderDuration(moment.duration({minutes: 1}))).toEqual('1m');
    expect(renderDuration(moment.duration({minutes: 1, seconds: 30}))).toEqual('1m');
    expect(renderDuration(moment.duration({minutes: 59}))).toEqual('59m');
    expect(renderDuration(moment.duration({hours: 1}))).toEqual('1h');
    expect(renderDuration(moment.duration({hours: 1, minutes: 30}))).toEqual('1h 30m');
    expect(renderDuration(moment.duration({hours: 23}))).toEqual('23h');
    expect(renderDuration(moment.duration({days: 1}))).toEqual('1d');
    expect(renderDuration(moment.duration({days: 1, minutes: 5}))).toEqual('1d 5m');
    expect(renderDuration(moment.duration({days: 1, hours: 2, minutes: 5}))).toEqual('1d 2h 5m');
    expect(renderDuration(moment.duration({days: 1, hours: 2, minutes: 5, seconds: 30}))).toEqual('1d 2h 5m');
    expect(renderDuration(moment.duration({days: 36}))).toEqual('36d');
    expect(renderDuration(moment.duration({days: 99, hours: 10, minutes: 45}))).toEqual('99d 10h 45m');
    expect(renderDuration(moment.duration({weeks: 6}))).toEqual('42d');
    expect(renderDuration(moment.duration({weeks: 2, days: 6, minutes: 12}))).toEqual('20d 12m');
});
