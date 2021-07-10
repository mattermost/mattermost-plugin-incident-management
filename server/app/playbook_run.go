package app

import (
	"encoding/json"
	"strings"
	"time"

	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/pkg/errors"

	"github.com/mattermost/mattermost-plugin-api/cluster"
)

const (
	StatusReported = "Reported"
	StatusActive   = "Active"
	StatusResolved = "Resolved"
	StatusArchived = "Archived"
)

// PlaybookRun holds the detailed information of an playbook run.
//
// NOTE: when adding a column to the db, search for "When adding an Playbook Run column" to see where
// that column needs to be added in the sqlstore code.
type PlaybookRun struct {
	ID                                   string          `json:"id"`
	Name                                 string          `json:"name"` // Retrieved from playbook run channel
	Description                          string          `json:"description"`
	OwnerUserID                          string          `json:"owner_user_id"`
	ReporterUserID                       string          `json:"reporter_user_id"`
	TeamID                               string          `json:"team_id"`
	ChannelID                            string          `json:"channel_id"`
	CreateAt                             int64           `json:"create_at"` // Retrieved from playbook run channel
	EndAt                                int64           `json:"end_at"`
	DeleteAt                             int64           `json:"delete_at"` // Retrieved from playbook run channel
	ActiveStage                          int             `json:"active_stage"`
	ActiveStageTitle                     string          `json:"active_stage_title"`
	PostID                               string          `json:"post_id"`
	PlaybookID                           string          `json:"playbook_id"`
	Checklists                           []Checklist     `json:"checklists"`
	StatusPosts                          []StatusPost    `json:"status_posts"`
	CurrentStatus                        string          `json:"current_status"`
	LastStatusUpdateAt                   int64           `json:"last_status_update_at"`
	ReminderPostID                       string          `json:"reminder_post_id"`
	PreviousReminder                     time.Duration   `json:"previous_reminder"`
	BroadcastChannelID                   string          `json:"broadcast_channel_id"`
	ReminderMessageTemplate              string          `json:"reminder_message_template"`
	InvitedUserIDs                       []string        `json:"invited_user_ids"`
	InvitedGroupIDs                      []string        `json:"invited_group_ids"`
	TimelineEvents                       []TimelineEvent `json:"timeline_events"`
	DefaultOwnerID                       string          `json:"default_owner_id"`
	AnnouncementChannelID                string          `json:"announcement_channel_id"`
	WebhookOnCreationURL                 string          `json:"webhook_on_creation_url"`
	WebhookOnStatusUpdateURL             string          `json:"webhook_on_status_update_url"`
	Retrospective                        string          `json:"retrospective"`
	RetrospectivePublishedAt             int64           `json:"retrospective_published_at"` // The last time a retrospective was published. 0 if never published.
	RetrospectiveWasCanceled             bool            `json:"retrospective_was_canceled"`
	RetrospectiveReminderIntervalSeconds int64           `json:"retrospective_reminder_interval_seconds"`
	MessageOnJoin                        string          `json:"message_on_join"`
	ExportChannelOnArchiveEnabled        bool            `json:"export_channel_on_archive_enabled"`
}

func (i *PlaybookRun) Clone() *PlaybookRun {
	newPlaybookRun := *i
	var newChecklists []Checklist
	for _, c := range i.Checklists {
		newChecklists = append(newChecklists, c.Clone())
	}
	newPlaybookRun.Checklists = newChecklists

	newPlaybookRun.StatusPosts = append([]StatusPost(nil), i.StatusPosts...)
	newPlaybookRun.TimelineEvents = append([]TimelineEvent(nil), i.TimelineEvents...)
	newPlaybookRun.InvitedUserIDs = append([]string(nil), i.InvitedUserIDs...)
	newPlaybookRun.InvitedGroupIDs = append([]string(nil), i.InvitedGroupIDs...)

	return &newPlaybookRun
}

func (i *PlaybookRun) MarshalJSON() ([]byte, error) {
	type Alias PlaybookRun

	old := (*Alias)(i.Clone())
	// replace nils with empty slices for the frontend
	if old.Checklists == nil {
		old.Checklists = []Checklist{}
	}
	for j, cl := range old.Checklists {
		if cl.Items == nil {
			old.Checklists[j].Items = []ChecklistItem{}
		}
	}
	if old.StatusPosts == nil {
		old.StatusPosts = []StatusPost{}
	}
	if old.InvitedUserIDs == nil {
		old.InvitedUserIDs = []string{}
	}
	if old.InvitedGroupIDs == nil {
		old.InvitedGroupIDs = []string{}
	}
	if old.TimelineEvents == nil {
		old.TimelineEvents = []TimelineEvent{}
	}

	return json.Marshal(old)
}

func (i *PlaybookRun) IsActive() bool {
	currentStatus := i.CurrentStatus
	return currentStatus != StatusResolved && currentStatus != StatusArchived
}

func (i *PlaybookRun) ResolvedAt() int64 {
	// Backwards compatibility for playbook runs with old status updates
	if len(i.StatusPosts) > 0 && i.StatusPosts[len(i.StatusPosts)-1].Status == "" {
		return i.EndAt
	}

	var resolvedPost *StatusPost
	for j := len(i.StatusPosts) - 1; j >= 0; j-- {
		if i.StatusPosts[j].DeleteAt != 0 {
			continue
		}
		if i.StatusPosts[j].Status != StatusResolved && i.StatusPosts[j].Status != StatusArchived {
			break
		}

		resolvedPost = &i.StatusPosts[j]
	}

	if resolvedPost == nil {
		return 0
	}

	return resolvedPost.CreateAt
}

type StatusPost struct {
	ID       string `json:"id"`
	Status   string `json:"status"`
	CreateAt int64  `json:"create_at"`
	DeleteAt int64  `json:"delete_at"`
}

type UpdateOptions struct {
}

// StatusUpdateOptions encapsulates the fields that can be set when updating an playbook run's status
// NOTE: changes made to this should be reflected in the client package.
type StatusUpdateOptions struct {
	Status      string        `json:"status"`
	Description string        `json:"description"`
	Message     string        `json:"message"`
	Reminder    time.Duration `json:"reminder"`
}

// Metadata tracks ancillary metadata about a playbook run.
type Metadata struct {
	ChannelName        string `json:"channel_name"`
	ChannelDisplayName string `json:"channel_display_name"`
	TeamName           string `json:"team_name"`
	NumMembers         int64  `json:"num_members"`
	TotalPosts         int64  `json:"total_posts"`
}

type timelineEventType string

const (
	PlaybookRunCreated     timelineEventType = "incident_created"
	TaskStateModified      timelineEventType = "task_state_modified"
	StatusUpdated          timelineEventType = "status_updated"
	OwnerChanged           timelineEventType = "owner_changed"
	AssigneeChanged        timelineEventType = "assignee_changed"
	RanSlashCommand        timelineEventType = "ran_slash_command"
	EventFromPost          timelineEventType = "event_from_post"
	UserJoinedLeft         timelineEventType = "user_joined_left"
	PublishedRetrospective timelineEventType = "published_retrospective"
	CanceledRetrospective  timelineEventType = "canceled_retrospective"
)

type TimelineEvent struct {
	ID            string            `json:"id"`
	PlaybookRunID string            `json:"playbook_run_id"`
	CreateAt      int64             `json:"create_at"`
	DeleteAt      int64             `json:"delete_at"`
	EventAt       int64             `json:"event_at"`
	EventType     timelineEventType `json:"event_type"`
	Summary       string            `json:"summary"`
	Details       string            `json:"details"`
	PostID        string            `json:"post_id"`
	SubjectUserID string            `json:"subject_user_id"`
	CreatorUserID string            `json:"creator_user_id"`
}

// GetPlaybookRunsResults collects the results of the GetPlaybookRuns call: the list of PlaybookRuns matching
// the HeaderFilterOptions, and the TotalCount of the matching playbook runs before paging was applied.
type GetPlaybookRunsResults struct {
	TotalCount int           `json:"total_count"`
	PageCount  int           `json:"page_count"`
	HasMore    bool          `json:"has_more"`
	Items      []PlaybookRun `json:"items"`
}

type SQLStatusPost struct {
	PlaybookRunID string
	PostID        string
	Status        string
	EndAt         int64
}

func (r GetPlaybookRunsResults) Clone() GetPlaybookRunsResults {
	newGetPlaybookRunsResults := r

	newGetPlaybookRunsResults.Items = make([]PlaybookRun, 0, len(r.Items))
	for _, i := range r.Items {
		newGetPlaybookRunsResults.Items = append(newGetPlaybookRunsResults.Items, *i.Clone())
	}

	return newGetPlaybookRunsResults
}

func (r GetPlaybookRunsResults) MarshalJSON() ([]byte, error) {
	type Alias GetPlaybookRunsResults

	old := Alias(r.Clone())

	// replace nils with empty slices for the frontend
	if old.Items == nil {
		old.Items = []PlaybookRun{}
	}

	return json.Marshal(old)
}

// OwnerInfo holds the summary information of a owner.
type OwnerInfo struct {
	UserID   string `json:"user_id"`
	Username string `json:"username"`
}

// DialogState holds the start playbook run interactive dialog's state as it appears in the client
// and is submitted back to the server.
type DialogState struct {
	PostID   string `json:"post_id"`
	ClientID string `json:"client_id"`
}

type DialogStateAddToTimeline struct {
	PostID string `json:"post_id"`
}

// PlaybookRunService is the playbook run service interface.
type PlaybookRunService interface {
	// GetPlaybookRuns returns filtered playbook runs and the total count before paging.
	GetPlaybookRuns(requesterInfo RequesterInfo, options PlaybookRunFilterOptions) (*GetPlaybookRunsResults, error)

	// CreatePlaybookRun creates a new playbook run. userID is the user who initiated the CreatePlaybookRun.
	CreatePlaybookRun(playbookRun *PlaybookRun, playbook *Playbook, userID string, public bool) (*PlaybookRun, error)

	// OpenCreatePlaybookRunDialog opens an interactive dialog to start a new playbook run.
	OpenCreatePlaybookRunDialog(teamID, ownerID, triggerID, postID, clientID string, playbooks []Playbook, isMobileApp bool) error

	// OpenUpdateStatusDialog opens an interactive dialog so the user can update the playbook run's status.
	OpenUpdateStatusDialog(playbookRunID, triggerID string) error

	// OpenAddToTimelineDialog opens an interactive dialog so the user can add a post to the playbook run timeline.
	OpenAddToTimelineDialog(requesterInfo RequesterInfo, postID, teamID, triggerID string) error

	// OpenAddChecklistItemDialog opens an interactive dialog so the user can add a post to the playbook run timeline.
	OpenAddChecklistItemDialog(triggerID, playbookRunID string, checklist int) error

	// AddPostToTimeline adds an event based on a post to a playbook run's timeline.
	AddPostToTimeline(playbookRunID, userID, postID, summary string) error

	// RemoveTimelineEvent removes the timeline event (sets the DeleteAt to the current time).
	RemoveTimelineEvent(playbookRunID, userID, eventID string) error

	// UpdateStatus updates a playbook run's status.
	UpdateStatus(playbookRunID, userID string, options StatusUpdateOptions) error

	// GetPlaybookRun gets a playbook run by ID. Returns error if it could not be found.
	GetPlaybookRun(playbookRunID string) (*PlaybookRun, error)

	// GetPlaybookRunMetadata gets ancillary metadata about a playbook run.
	GetPlaybookRunMetadata(playbookRunID string) (*Metadata, error)

	// GetPlaybookRunIDForChannel get the playbookRunID associated with this channel. Returns ErrNotFound
	// if there is no playbook run associated with this channel.
	GetPlaybookRunIDForChannel(channelID string) (string, error)

	// GetOwners returns all the owners of playbook runs selected
	GetOwners(requesterInfo RequesterInfo, options PlaybookRunFilterOptions) ([]OwnerInfo, error)

	// IsOwner returns true if the userID is the owner for playbookRunID.
	IsOwner(playbookRunID string, userID string) bool

	// ChangeOwner processes a request from userID to change the owner for playbookRunID
	// to ownerID. Changing to the same ownerID or to a bot is a no-op.
	ChangeOwner(playbookRunID string, userID string, ownerID string) error

	// ModifyCheckedState modifies the state of the specified checklist item
	// Idempotent, will not perform any actions if the checklist item is already in the specified state
	ModifyCheckedState(playbookRunID, userID, newState string, checklistNumber int, itemNumber int) error

	// ToggleCheckedState checks or unchecks the specified checklist item
	ToggleCheckedState(playbookRunID, userID string, checklistNumber, itemNumber int) error

	// SetAssignee sets the assignee for the specified checklist item
	// Idempotent, will not perform any actions if the checklist item is already assigned to assigneeID
	// or if the assignee is a bot
	SetAssignee(playbookRunID, userID, assigneeID string, checklistNumber, itemNumber int) error

	// RunChecklistItemSlashCommand executes the slash command associated with the specified checklist item.
	RunChecklistItemSlashCommand(playbookRunID, userID string, checklistNumber, itemNumber int) (string, error)

	// AddChecklistItem adds an item to the specified checklist
	AddChecklistItem(playbookRunID, userID string, checklistNumber int, checklistItem ChecklistItem) error

	// RemoveChecklistItem removes an item from the specified checklist
	RemoveChecklistItem(playbookRunID, userID string, checklistNumber int, itemNumber int) error

	// EditChecklistItem changes the title, command and description of a specified checklist item.
	EditChecklistItem(playbookRunID, userID string, checklistNumber int, itemNumber int, newTitle, newCommand, newDescription string) error

	// MoveChecklistItem moves a checklist item from one position to anouther
	MoveChecklistItem(playbookRunID, userID string, checklistNumber int, itemNumber int, newLocation int) error

	// GetChecklistItemAutocomplete returns the list of checklist items for playbookRunID to be used in autocomplete
	GetChecklistItemAutocomplete(playbookRunID string) ([]model.AutocompleteListItem, error)

	// GetChecklistAutocomplete returns the list of checklists for playbookRunID to be used in autocomplete
	GetChecklistAutocomplete(playbookRunID string) ([]model.AutocompleteListItem, error)

	// NukeDB removes all playbook run related data.
	NukeDB() error

	// SetReminder sets a reminder. After timeInMinutes in the future, the owner will be
	// reminded to update the playbook run's status.
	SetReminder(playbookRunID string, timeInMinutes time.Duration) error

	// RemoveReminder removes the pending reminder for playbookRunID (if any).
	RemoveReminder(playbookRunID string)

	// HandleReminder is the handler for all reminder events.
	HandleReminder(key string)

	// RemoveReminderPost will remove the reminder in the playbook run channel (if any).
	RemoveReminderPost(playbookRunID string) error

	// ChangeCreationDate changes the creation date of the specified playbook run.
	ChangeCreationDate(playbookRunID string, creationTimestamp time.Time) error

	// UserHasJoinedChannel is called when userID has joined channelID. If actorID is not blank, userID
	// was invited by actorID.
	UserHasJoinedChannel(userID, channelID, actorID string)

	// UserHasLeftChannel is called when userID has left channelID. If actorID is not blank, userID
	// was removed from the channel by actorID.
	UserHasLeftChannel(userID, channelID, actorID string)

	// UpdateRetrospective updates the retrospective for the given playbook run.
	UpdateRetrospective(playbookRunID, userID, newRetrospective string) error

	// PublishRetrospective publishes the retrospective.
	PublishRetrospective(playbookRunID, text, userID string) error

	// CancelRetrospective cancels the retrospective.
	CancelRetrospective(playbookRunID, userID string) error

	// CheckAndSendMessageOnJoin checks if userID has viewed channelID and sends
	// playbooRun.MessageOnJoin if it exists. Returns true if the message was sent.
	CheckAndSendMessageOnJoin(userID, playbookRunID, channelID string) bool
}

// PlaybookRunStore defines the methods the PlaybookRunServiceImpl needs from the interfaceStore.
type PlaybookRunStore interface {
	// GetPlaybookRuns returns filtered playbook runs and the total count before paging.
	GetPlaybookRuns(requesterInfo RequesterInfo, options PlaybookRunFilterOptions) (*GetPlaybookRunsResults, error)

	// CreatePlaybookRun creates a new playbook run. If playbook run has an ID, that ID will be used.
	CreatePlaybookRun(playbookRun *PlaybookRun) (*PlaybookRun, error)

	// UpdatePlaybookRun updates a playbook run.
	UpdatePlaybookRun(playbookRun *PlaybookRun) error

	// UpdateStatus updates the status of a playbook run.
	UpdateStatus(statusPost *SQLStatusPost) error

	// GetTimelineEvent returns the timeline event for playbookRunID by the timeline event ID.
	GetTimelineEvent(playbookRunID, eventID string) (*TimelineEvent, error)

	// CreateTimelineEvent inserts the timeline event into the DB and returns the new event ID
	CreateTimelineEvent(event *TimelineEvent) (*TimelineEvent, error)

	// UpdateTimelineEvent updates an existing timeline event
	UpdateTimelineEvent(event *TimelineEvent) error

	// GetPlaybookRun gets a playbook run by ID.
	GetPlaybookRun(playbookRunID string) (*PlaybookRun, error)

	// GetPlaybookRunByChannel gets a playbook run associated with the given channel id.
	GetPlaybookRunIDForChannel(channelID string) (string, error)

	// GetAllPlaybookRunMembersCount returns the count of all members of the
	// playbook run associated with the given channel id since the beginning of the
	// playbook run, excluding bots.
	GetAllPlaybookRunMembersCount(channelID string) (int64, error)

	// GetOwners returns the owners of the playbook runs selected by options
	GetOwners(requesterInfo RequesterInfo, options PlaybookRunFilterOptions) ([]OwnerInfo, error)

	// NukeDB removes all playbook run related data.
	NukeDB() error

	// ChangeCreationDate changes the creation date of the specified playbook run.
	ChangeCreationDate(playbookRunID string, creationTimestamp time.Time) error

	// HasViewedChannel returns true if userID has viewed channelID
	HasViewedChannel(userID, channelID string) bool

	// SetViewedChannel records that userID has viewed channelID. NOTE: does not check if there is already a
	// record of that userID/channelID (i.e., will create duplicate rows)
	SetViewedChannel(userID, channelID string) error
}

// PlaybookRunTelemetry defines the methods that the PlaybookRunServiceImpl needs from the RudderTelemetry.
// Unless otherwise noted, userID is the user initiating the event.
type PlaybookRunTelemetry interface {
	// CreatePlaybookRun tracks the creation of a new playbook run.
	CreatePlaybookRun(playbookRun *PlaybookRun, userID string, public bool)

	// EndPlaybookRun tracks the end of a playbook run.
	EndPlaybookRun(playbookRun *PlaybookRun, userID string)

	// RestartPlaybookRun tracks the restart of a playbook run.
	RestartPlaybookRun(playbookRun *PlaybookRun, userID string)

	// ChangeOwner tracks changes in owner.
	ChangeOwner(playbookRun *PlaybookRun, userID string)

	// UpdateStatus tracks when a playbook run's status has been updated
	UpdateStatus(playbookRun *PlaybookRun, userID string)

	// FrontendTelemetryForPlaybookRun tracks an event originating from the frontend
	FrontendTelemetryForPlaybookRun(playbookRun *PlaybookRun, userID, action string)

	// AddPostToTimeline tracks userID creating a timeline event from a post.
	AddPostToTimeline(playbookRun *PlaybookRun, userID string)

	// RemoveTimelineEvent tracks userID removing a timeline event.
	RemoveTimelineEvent(playbookRun *PlaybookRun, userID string)

	// ModifyCheckedState tracks the checking and unchecking of items.
	ModifyCheckedState(playbookRunID, userID string, task ChecklistItem, wasOwner bool)

	// SetAssignee tracks the changing of an assignee on an item.
	SetAssignee(playbookRunID, userID string, task ChecklistItem)

	// AddTask tracks the creation of a new checklist item.
	AddTask(playbookRunID, userID string, task ChecklistItem)

	// RemoveTask tracks the removal of a checklist item.
	RemoveTask(playbookRunID, userID string, task ChecklistItem)

	// RenameTask tracks the update of a checklist item.
	RenameTask(playbookRunID, userID string, task ChecklistItem)

	// MoveTask tracks the unchecking of checked item.
	MoveTask(playbookRunID, userID string, task ChecklistItem)

	// RunTaskSlashCommand tracks the execution of a slash command attached to
	// a checklist item.
	RunTaskSlashCommand(playbookRunID, userID string, task ChecklistItem)

	// UpdateRetrospective event
	UpdateRetrospective(playbookRun *PlaybookRun, userID string)

	// PublishRetrospective event
	PublishRetrospective(playbookRun *PlaybookRun, userID string)
}

type JobOnceScheduler interface {
	Start() error
	SetCallback(callback func(string)) error
	ListScheduledJobs() ([]cluster.JobOnceMetadata, error)
	ScheduleOnce(key string, runAt time.Time) (*cluster.JobOnce, error)
	Cancel(key string)
}

const PerPageDefault = 1000

// PlaybookRunFilterOptions specifies the optional parameters when getting playbook runs.
type PlaybookRunFilterOptions struct {
	// Gets all the headers with this TeamID.
	TeamID string `url:"team_id,omitempty"`

	// Pagination options.
	Page    int `url:"page,omitempty"`
	PerPage int `url:"per_page,omitempty"`

	// Sort sorts by this header field in json format (eg, "create_at", "end_at", "name", etc.);
	// defaults to "create_at".
	Sort SortField `url:"sort,omitempty"`

	// Direction orders by ascending or descending, defaulting to ascending.
	Direction SortDirection `url:"direction,omitempty"`

	// Status filters by current status
	Status string

	// Statuses filters by all statuses in the list (inclusive)
	Statuses []string

	// OwnerID filters by owner's Mattermost user ID. Defaults to blank (no filter).
	OwnerID string `url:"owner_user_id,omitempty"`

	// MemberID filters playbook runs that have this member. Defaults to blank (no filter).
	MemberID string `url:"member_id,omitempty"`

	// SearchTerm returns results of the search term and respecting the other header filter options.
	// The search term acts as a filter and respects the Sort and Direction fields (i.e., results are
	// not returned in relevance order).
	SearchTerm string `url:"search_term,omitempty"`

	// PlaybookID filters playbook runs that are derived from this playbook id.
	// Defaults to blank (no filter).
	PlaybookID string `url:"playbook_id,omitempty"`

	// ActiveGTE filters playbook runs that were active after (or equal) to the unix time given (in millis).
	// A value of 0 means the filter is ignored (which is the default).
	ActiveGTE int64 `url:"active_gte,omitempty"`

	// ActiveLT filters playbook runs that were active before the unix time given (in millis).
	// A value of 0 means the filter is ignored (which is the default).
	ActiveLT int64 `url:"active_lt,omitempty"`

	// StartedGTE filters playbook runs that were started after (or equal) to the unix time given (in millis).
	// A value of 0 means the filter is ignored (which is the default).
	StartedGTE int64 `url:"started_gte,omitempty"`

	// StartedLT filters playbook runs that were started before the unix time given (in millis).
	// A value of 0 means the filter is ignored (which is the default).
	StartedLT int64 `url:"started_lt,omitempty"`
}

// Clone duplicates the given options.
func (o *PlaybookRunFilterOptions) Clone() PlaybookRunFilterOptions {
	newPlaybookRunFilterOptions := *o
	newPlaybookRunFilterOptions.Statuses = append([]string{}, o.Statuses...)

	return newPlaybookRunFilterOptions
}

// Validate returns a new, validated filter options or returns an error if invalid.
func (o PlaybookRunFilterOptions) Validate() (PlaybookRunFilterOptions, error) {
	options := o.Clone()

	if options.PerPage <= 0 {
		options.PerPage = PerPageDefault
	}

	options.Sort = SortField(strings.ToLower(string(options.Sort)))
	switch options.Sort {
	case SortByCreateAt:
	case SortByID:
	case SortByName:
	case SortByOwnerUserID:
	case SortByTeamID:
	case SortByEndAt:
	case SortByStatus:
	case SortByLastStatusUpdateAt:
	case "": // default
		options.Sort = SortByCreateAt
	default:
		return PlaybookRunFilterOptions{}, errors.Errorf("unsupported sort '%s'", options.Sort)
	}

	options.Direction = SortDirection(strings.ToUpper(string(options.Direction)))
	switch options.Direction {
	case DirectionAsc:
	case DirectionDesc:
	case "": //default
		options.Direction = DirectionAsc
	default:
		return PlaybookRunFilterOptions{}, errors.Errorf("unsupported direction '%s'", options.Direction)
	}

	if options.TeamID != "" && !model.IsValidId(options.TeamID) {
		return PlaybookRunFilterOptions{}, errors.New("bad parameter 'team_id': must be 26 characters or blank")
	}

	if options.OwnerID != "" && !model.IsValidId(options.OwnerID) {
		return PlaybookRunFilterOptions{}, errors.New("bad parameter 'owner_id': must be 26 characters or blank")
	}

	if options.MemberID != "" && !model.IsValidId(options.MemberID) {
		return PlaybookRunFilterOptions{}, errors.New("bad parameter 'member_id': must be 26 characters or blank")
	}

	if options.PlaybookID != "" && !model.IsValidId(options.PlaybookID) {
		return PlaybookRunFilterOptions{}, errors.New("bad parameter 'playbook_id': must be 26 characters or blank")
	}

	if options.ActiveGTE < 0 {
		options.ActiveGTE = 0
	}
	if options.ActiveLT < 0 {
		options.ActiveLT = 0
	}
	if options.StartedGTE < 0 {
		options.StartedGTE = 0
	}
	if options.StartedLT < 0 {
		options.StartedLT = 0
	}

	return options, nil
}
