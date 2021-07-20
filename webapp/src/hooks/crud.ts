import {useEffect, useState} from 'react';

import {clientFetchPlaybook, clientFetchPlaybooks, deletePlaybook as clientDeletePlaybook} from 'src/client';
import {FetchPlaybooksParams, Playbook} from 'src/types/playbook';

type ParamsState = Required<FetchPlaybooksParams>;

export async function getPlaybookOrFetch(id: string, playbooks: Playbook[] | null) {
    return playbooks?.find((p) => p.id === id) ?? clientFetchPlaybook(id);
}

export function usePlaybooksCrud(
    defaultParams: Partial<FetchPlaybooksParams>,
    {infinitePaging} = {infinitePaging: false},
) {
    const [playbooks, setPlaybooks] = useState<Playbook[] | null>(null);
    const [isLoading, setLoading] = useState(true);
    const [hasMore, setHasMore] = useState(false);
    const [totalCount, setTotalCount] = useState(0);
    const [selectedPlaybook, setSelectedPlaybookState] = useState<Playbook | null>();
    const [params, setParamsState] = useState<ParamsState>({
        team_id: '',
        sort: 'title',
        direction: 'asc',
        page: 0,
        per_page: 10,
        ...defaultParams,
    });

    const setParams = (newParams: Partial<ParamsState>) => {
        setParamsState({...params, ...newParams});
    };

    useEffect(() => {
        fetchPlaybooks();
    }, [params]);

    const setSelectedPlaybook = async (nextSelected: Playbook | string | null) => {
        if (typeof nextSelected !== 'string') {
            return setSelectedPlaybookState(nextSelected);
        }

        if (!nextSelected) {
            return setSelectedPlaybookState(null);
        }

        return setSelectedPlaybookState(await getPlaybookOrFetch(nextSelected, playbooks) ?? null);
    };

    /**
     * Go to specific or next page
     * @param page - defaults to next page if there is one
     */
    const setPage = (page = (hasMore && params.page + 1) || 0) => {
        setParams({page});
    };

    const fetchPlaybooks = async () => {
        setLoading(true);
        const result = await clientFetchPlaybooks(params.team_id, params);
        if (result) {
            setPlaybooks(infinitePaging && playbooks ? [...playbooks, ...result.items] : result.items);
            setTotalCount(result.total_count);
            setHasMore(result.has_more);
        }
        setLoading(false);
    };

    const deletePlaybook = async (playbookId: Playbook['id']) => {
        await clientDeletePlaybook(playbookId);

        // Fetch latest count
        const result = await clientFetchPlaybooks(params.team_id, params);

        if (result) {
            // Go back to previous page if the last item on this page was just deleted
            // Setting the page here results in fetching playbooks through the params dependency of the effect above
            setPage(Math.max(Math.min(result.page_count - 1, params.page), 0));
        }
    };

    const sortBy = (colName: FetchPlaybooksParams['sort']) => {
        if (params.sort === colName) {
            // we're already sorting on this column; reverse the direction
            const newSortDirection = params.direction === 'asc' ? 'desc' : 'asc';
            setParams({direction: newSortDirection});
            return;
        }

        setParams({sort: colName, direction: 'asc'});
    };

    return [
        playbooks,
        {isLoading, totalCount, hasMore, params, selectedPlaybook},
        {setPage, setParams, sortBy, setSelectedPlaybook, deletePlaybook},
    ] as const;
}
