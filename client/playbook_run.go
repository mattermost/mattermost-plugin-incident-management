package client

import "time"

// PlaybookRun represents a playbook run.
type PlaybookRun struct {
	ID                            string          `json:"id"`
	Name                          string          `json:"name"`
	Description                   string          `json:"description"`
	OwnerUserID                   string          `json:"owner_user_id"`
	ReporterUserID                string          `json:"reporter_user_id"`
	TeamID                        string          `json:"team_id"`
	ChannelID                     string          `json:"channel_id"`
	CreateAt                      int64           `json:"create_at"`
	EndAt                         int64           `json:"end_at"`
	DeleteAt                      int64           `json:"delete_at"`
	ActiveStage                   int             `json:"active_stage"`
	ActiveStageTitle              string          `json:"active_stage_title"`
	PostID                        string          `json:"post_id"`
	PlaybookID                    string          `json:"playbook_id"`
	Checklists                    []Checklist     `json:"checklists"`
	StatusPosts                   []StatusPost    `json:"status_posts"`
	ReminderPostID                string          `json:"reminder_post_id"`
	PreviousReminder              time.Duration   `json:"previous_reminder"`
	BroadcastChannelID            string          `json:"broadcast_channel_id"`
	ReminderMessageTemplate       string          `json:"reminder_message_template"`
	InvitedUserIDs                []string        `json:"invited_user_ids"`
	InvitedGroupIDs               []string        `json:"invited_group_ids"`
	TimelineEvents                []TimelineEvent `json:"timeline_events"`
	ExportChannelOnArchiveEnabled bool            `json:"export_channel_on_archive_enabled"`
}

// StatusPost is information added to the playbook run when selecting from the db and sent to the
// client; it is not saved to the db.
type StatusPost struct {
	ID       string `json:"id"`
	CreateAt int64  `json:"create_at"`
	DeleteAt int64  `json:"delete_at"`
}

// PlaybookRunMetadata tracks ancillary metadata about a playbook run.
type PlaybookRunMetadata struct {
	ChannelName        string `json:"channel_name"`
	ChannelDisplayName string `json:"channel_display_name"`
	TeamName           string `json:"team_name"`
	NumMembers         int64  `json:"num_members"`
	TotalPosts         int64  `json:"total_posts"`
}

// TimelineEventType describes a type of timeline event.
type TimelineEventType string

const (
	PlaybookRunCreated TimelineEventType = "incident_created"
	TaskStateModified  TimelineEventType = "task_state_modified"
	StatusUpdated      TimelineEventType = "status_updated"
	OwnerChanged       TimelineEventType = "owner_changed"
	AssigneeChanged    TimelineEventType = "assignee_changed"
	RanSlashCommand    TimelineEventType = "ran_slash_command"
)

// TimelineEvent represents an event recorded to a playbook run's timeline.
type TimelineEvent struct {
	ID            string            `json:"id"`
	PlaybookRunID string            `json:"playbook_run"`
	CreateAt      int64             `json:"create_at"`
	DeleteAt      int64             `json:"delete_at"`
	EventAt       int64             `json:"event_at"`
	EventType     TimelineEventType `json:"event_type"`
	Summary       string            `json:"summary"`
	Details       string            `json:"details"`
	PostID        string            `json:"post_id"`
	SubjectUserID string            `json:"subject_user_id"`
	CreatorUserID string            `json:"creator_user_id"`
}

// PlaybookRunCreateOptions specifies the parameters for PlaybookRunService.Create method.
type PlaybookRunCreateOptions struct {
	Name        string `json:"name"`
	OwnerUserID string `json:"owner_user_id"`
	TeamID      string `json:"team_id"`
	Description string `json:"description"`
	PostID      string `json:"post_id"`
	PlaybookID  string `json:"playbook_id"`
}

// Sort enumerates the available fields we can sort on.
type Sort string

const (
	// SortByCreateAt sorts by the "create_at" field. It is the default.
	SortByCreateAt Sort = "create_at"

	// SortByID sorts by the "id" field.
	SortByID Sort = "id"

	// SortByName sorts by the "name" field.
	SortByName Sort = "name"

	// SortByOwnerUserID sorts by the "owner_user_id" field.
	SortByOwnerUserID Sort = "owner_user_id"

	// SortByTeamID sorts by the "team_id" field.
	SortByTeamID Sort = "team_id"

	// SortByEndAt sorts by the "end_at" field.
	SortByEndAt Sort = "end_at"

	// SortBySteps sorts playbooks by the number of steps in the playbook.
	SortBySteps Sort = "steps"

	// SortByStages sorts playbooks by the number of stages in the playbook.
	SortByStages Sort = "stages"

	// SortByTitle sorts by the "title" field.
	SortByTitle Sort = "title"

	// SortByRuns sorts by the number of times a playbook has been run.
	SortByRuns Sort = "runs"
)

// SortDirection determines whether results are sorted ascending or descending.
type SortDirection string

const (
	// Desc sorts the results in descending order.
	SortDesc SortDirection = "desc"

	// Asc sorts the results in ascending order.
	SortAsc SortDirection = "asc"
)

// PlaybookRunListOptions specifies the optional parameters to the
// PlaybookRunService.List method.
type PlaybookRunListOptions struct {
	// TeamID filters playbook runs to those in the given team.
	TeamID string `url:"team_id,omitempty"`

	Sort      Sort          `url:"sort,omitempty"`
	Direction SortDirection `url:"direction,omitempty"`

	// Status filters by All, Ongoing, or Ended; defaults to All.
	Status Status `url:"status,omitempty"`

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

// PlaybookRunList contains the paginated result.
type PlaybookRunList struct {
	TotalCount int  `json:"total_count"`
	PageCount  int  `json:"page_count"`
	HasMore    bool `json:"has_more"`
	Items      []*PlaybookRun
}

// Status is the type used to specify the activity status of the playbook run.
type Status string

const (
	StatusReported Status = "Reported"
	StatusActive   Status = "Active"
	StatusResolved Status = "Resolved"
	StatusArchived Status = "Archived"
)

type GetPlaybookRunsResults struct {
	TotalCount int           `json:"total_count"`
	PageCount  int           `json:"page_count"`
	HasMore    bool          `json:"has_more"`
	Items      []PlaybookRun `json:"items"`
	Disabled   bool          `json:"disabled"`
}

// StatusUpdateOptions are the fields required to update a playbook run's status
type StatusUpdateOptions struct {
	Status            Status `json:"status"`
	Description       string `json:"description"`
	Message           string `json:"message"`
	ReminderInSeconds int64  `json:"reminder"`
}
