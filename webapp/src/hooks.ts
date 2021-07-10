import {MutableRefObject, useCallback, useEffect, useRef, useState} from 'react';
import {useDispatch, useSelector, useStore} from 'react-redux';

import {haveITeamPermission} from 'mattermost-redux/selectors/entities/roles';
import {PermissionsOptions} from 'mattermost-redux/selectors/entities/roles_helpers';
import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';
import {GlobalState} from 'mattermost-redux/types/store';
import {Team} from 'mattermost-redux/types/teams';
import {
    getProfilesInCurrentChannel,
    getCurrentUserId, getUser,
} from 'mattermost-redux/selectors/entities/users';
import {getCurrentChannelId} from 'mattermost-redux/selectors/entities/channels';
import {DispatchFunc} from 'mattermost-redux/types/actions';
import {getProfilesByIds, getProfilesInChannel} from 'mattermost-redux/actions/users';
import {Client4} from 'mattermost-redux/client';
import {Post} from 'mattermost-redux/types/posts';
import {getPost as getPostFromState} from 'mattermost-redux/selectors/entities/posts';
import {UserProfile} from 'mattermost-redux/types/users';

import {PlaybookRun, StatusPost} from 'src/types/playbook_run';

import {PROFILE_CHUNK_SIZE} from 'src/constants';
import {getProfileSetForChannel} from 'src/selectors';
import {clientFetchPlaybooksCount} from 'src/client';
import {receivedTeamNumPlaybooks} from 'src/actions';

import {isCloud, isE10LicensedOrDevelopment, isE20LicensedOrDevelopment} from './license';
import {currentTeamNumPlaybooks, globalSettings, isCurrentUserAdmin} from './selectors';

export function useCurrentTeamPermission(options: PermissionsOptions): boolean {
    const currentTeam = useSelector<GlobalState, Team>(getCurrentTeam);
    options.team = currentTeam.id;
    return useSelector<GlobalState, boolean>((state) => haveITeamPermission(state, options));
}

/**
 * Hook that calls handler when targetKey is pressed.
 */
export function useKeyPress(targetKey: string, handler: () => void) {
    // Add event listeners
    useEffect(() => {
        // If pressed key is our target key then set to true
        function downHandler({key}: KeyboardEvent) {
            if (key === targetKey) {
                handler();
            }
        }

        window.addEventListener('keydown', downHandler);

        // Remove event listeners on cleanup
        return () => {
            window.removeEventListener('keydown', downHandler);
        };
    }, [handler, targetKey]);
}

/**
 * Hook that alerts clicks outside of the passed ref.
 */
export function useClickOutsideRef(ref: MutableRefObject<HTMLElement | null>, handler: () => void) {
    useEffect(() => {
        function onMouseDown(event: MouseEvent) {
            const target = event.target as any;
            if (ref.current && target instanceof Node && !ref.current.contains(target)) {
                handler();
            }
        }

        // Bind the event listener
        document.addEventListener('mousedown', onMouseDown);
        return () => {
            // Unbind the event listener on clean up
            document.removeEventListener('mousedown', onMouseDown);
        };
    }, [ref, handler]);
}

/**
 * Hook that sets a timeout and will cleanup after itself. Adapted from Dan Abramov's code:
 * https://overreacted.io/making-setinterval-declarative-with-react-hooks/
 */
export function useTimeout(callback: () => void, delay: number | null) {
    const timeoutRef = useRef<number>();
    const callbackRef = useRef(callback);

    // Remember the latest callback:
    //
    // Without this, if you change the callback, when setTimeout kicks in, it
    // will still call your old callback.
    //
    // If you add `callback` to useEffect's deps, it will work fine but the
    // timeout will be reset.
    useEffect(() => {
        callbackRef.current = callback;
    }, [callback]);

    // Set up the timeout:
    useEffect(() => {
        if (typeof delay === 'number') {
            timeoutRef.current = window.setTimeout(() => callbackRef.current(), delay);

            // Clear timeout if the component is unmounted or the delay changes:
            return () => window.clearTimeout(timeoutRef.current);
        }
        return () => false;
    }, [delay]);

    // In case you want to manually clear the timeout from the consuming component...:
    return timeoutRef;
}

// useClientRect will be called only when the component mounts and unmounts, so changes to the
// component's size will not cause rect to change. If you want to be notified of changes after
// mounting, you will need to add ResizeObserver to this hook.
export function useClientRect() {
    const [rect, setRect] = useState(new DOMRect());

    const ref = useCallback((node) => {
        if (node !== null) {
            setRect(node.getBoundingClientRect());
        }
    }, []);

    return [rect, ref] as const;
}

export function useProfilesInCurrentChannel() {
    const dispatch = useDispatch() as DispatchFunc;
    const profilesInChannel = useSelector(getProfilesInCurrentChannel);
    const currentChannelId = useSelector(getCurrentChannelId);

    useEffect(() => {
        if (profilesInChannel.length > 0) {
            return;
        }

        dispatch(getProfilesInChannel(currentChannelId, 0, PROFILE_CHUNK_SIZE));
    }, [currentChannelId, profilesInChannel]);

    return profilesInChannel;
}

export function useCanCreatePlaybooks() {
    const settings = useSelector(globalSettings);
    const currentUserID = useSelector(getCurrentUserId);

    // This is really a loading state so just assume yes
    if (!settings) {
        return true;
    }

    // No restrictions if length is zero
    if (settings.playbook_creators_user_ids.length === 0) {
        return true;
    }

    return settings.playbook_creators_user_ids.includes(currentUserID);
}

export function useCanRestrictPlaybookCreation() {
    const settings = useSelector(globalSettings);
    const isAdmin = useSelector(isCurrentUserAdmin);
    const currentUserID = useSelector(getCurrentUserId);

    // This is really a loading state so just assume no.
    if (!settings) {
        return false;
    }

    // No restrictions if user is a system administrator.
    if (isAdmin) {
        return true;
    }

    return settings.playbook_creators_user_ids.includes(currentUserID);
}

const selectExperimentalFeatures = (state: GlobalState) => Boolean(globalSettings(state)?.enable_experimental_features);

export function useExperimentalFeaturesEnabled() {
    return useSelector(selectExperimentalFeatures);
}

export function useProfilesInChannel(channelId: string) {
    const dispatch = useDispatch() as DispatchFunc;
    const profilesInChannel = useSelector((state) => getProfileSetForChannel(state as GlobalState, channelId));
    const [fetched, setFetched] = useState(false);

    useEffect(() => {
        if (profilesInChannel.length > 0) {
            return;
        }

        if (!fetched) {
            dispatch(getProfilesInChannel(channelId, 0, PROFILE_CHUNK_SIZE));
            setFetched(true);
        }
    }, [channelId, profilesInChannel, fetched]);

    return profilesInChannel;
}

function getLatestPostId(statusPosts: StatusPost[]) {
    const sortedPosts = [...statusPosts]
        .filter((a) => a.delete_at === 0)
        .sort((a, b) => b.create_at - a.create_at);

    return sortedPosts[0]?.id;
}

export function usePost(postId: string) {
    const postFromState = useSelector<GlobalState, Post | null>((state) => getPostFromState(state, postId || ''));
    const [post, setPost] = useState<Post | null>(null);

    useEffect(() => {
        const updateLatestUpdate = async () => {
            if (postFromState) {
                setPost(postFromState);
                return;
            }

            if (postId) {
                const fromServer = await Client4.getPost(postId);
                setPost(fromServer);
                return;
            }

            setPost(null);
        };

        updateLatestUpdate();
    }, [postFromState, postId]);

    return post;
}

export function useLatestUpdate(playbookRun: PlaybookRun) {
    const postId = getLatestPostId(playbookRun.status_posts);
    return usePost(postId);
}

export function useNumPlaybooksInCurrentTeam() {
    const dispatch = useDispatch();
    const team = useSelector(getCurrentTeam);
    const numPlaybooks = useSelector(currentTeamNumPlaybooks);

    useEffect(() => {
        const fetch = async () => {
            const response = await clientFetchPlaybooksCount(team.id);
            dispatch(receivedTeamNumPlaybooks(team.id, response.count));
        };

        fetch();
    }, [team.id]);

    return numPlaybooks;
}

// useAllowPlaybookCreationInCurrentTeam returns whether a user can create
// a playbook in the current team
export function useAllowPlaybookCreationInCurrentTeam() {
    const numPlaybooks = useNumPlaybooksInCurrentTeam();
    const isLicensed = useSelector(isE10LicensedOrDevelopment);

    return isLicensed || numPlaybooks === 0;
}

// useAllowTimelineViewInCurrentTeam returns whether a user can view the RHS
// timeline in the current team
export function useAllowTimelineViewInCurrentTeam() {
    return useSelector(isE10LicensedOrDevelopment);
}

// useAllowAddMessageToTimelineInCurrentTeam returns whether a user can add a
// post to the timeline in the current team
export function useAllowAddMessageToTimelineInCurrentTeam() {
    return useSelector(isE10LicensedOrDevelopment);
}

// useAllowPlaybookGranularAccess returns whether the access to specific playbooks
// can be restricted to a subset of users
export function useAllowPlaybookGranularAccess() {
    return useSelector(isE20LicensedOrDevelopment);
}

// useAllowPlaybookCreationRestriction returns whether the global feature to
// restrict the playbook creation to a subset of users is allowed
export function useAllowPlaybookCreationRestriction() {
    return useSelector(isE20LicensedOrDevelopment);
}

// useAllowChannelExport returns whether exporting the channel is allowed
export function useAllowChannelExport() {
    return useSelector(isE20LicensedOrDevelopment);
}

// useAllowPlaybookStatsView returns whether the server is licensed to show
// the stats in the playbook backstage dashboard
export function useAllowPlaybookStatsView() {
    return useSelector(isE20LicensedOrDevelopment);
}

// useAllowRetrospectiveAccess returns whether the server is licenced for
// the retrospective feature.
export function useAllowRetrospectiveAccess() {
    return useSelector(isE10LicensedOrDevelopment);
}

export function useEnsureProfiles(userIds: string[]) {
    const dispatch = useDispatch();
    type StringToUserProfileFn = (id: string) => UserProfile;
    const getUserFromStore = useSelector<GlobalState, StringToUserProfileFn>((state) => (id: string) => getUser(state, id));

    const unknownIds = [];
    for (const id of userIds) {
        const user = getUserFromStore(id);
        if (!user) {
            unknownIds.push(id);
        }
    }

    if (unknownIds.length > 0) {
        dispatch(getProfilesByIds(userIds));
    }
}

export function useOpenCloudModal() {
    const dispatch = useDispatch();
    const isServerCloud = useSelector(isCloud);

    if (!isServerCloud) {
        return () => { /*do nothing*/ };
    }

    // @ts-ignore
    if (!window.WebappUtils?.modals?.openModal || !window.WebappUtils?.modals?.ModalIdentifiers?.CLOUD_PURCHASE || !window.Components?.PurchaseModal) {
        // eslint-disable-next-line no-console
        console.error('unable to open cloud modal');

        return () => { /*do nothing*/ };
    }

    // @ts-ignore
    const {openModal, ModalIdentifiers} = window.WebappUtils.modals;

    // @ts-ignore
    const PurchaseModal = window.Components.PurchaseModal;

    return () => {
        dispatch(openModal({
            modalId: ModalIdentifiers.CLOUD_PURCHASE,
            dialogType: PurchaseModal,
        }));
    };
}
