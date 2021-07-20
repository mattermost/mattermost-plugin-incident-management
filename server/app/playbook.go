package app

import (
	"encoding/json"
	"strings"

	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/pkg/errors"
)

// Playbook represents a desired business outcome, from which playbook runs are started to solve
// a specific instance.
type Playbook struct {
	ID                                   string      `json:"id"`
	Title                                string      `json:"title"`
	Description                          string      `json:"description"`
	TeamID                               string      `json:"team_id"`
	CreatePublicPlaybookRun              bool        `json:"create_public_playbook_run"`
	CreateAt                             int64       `json:"create_at"`
	UpdateAt                             int64       `json:"update_at"`
	DeleteAt                             int64       `json:"delete_at"`
	NumStages                            int64       `json:"num_stages"`
	NumSteps                             int64       `json:"num_steps"`
	NumRuns                              int64       `json:"num_runs"`
	NumActions                           int64       `json:"num_actions"`
	LastRunAt                            int64       `json:"last_run_at"`
	Checklists                           []Checklist `json:"checklists"`
	MemberIDs                            []string    `json:"member_ids"`
	BroadcastChannelID                   string      `json:"broadcast_channel_id"`
	ReminderMessageTemplate              string      `json:"reminder_message_template"`
	ReminderTimerDefaultSeconds          int64       `json:"reminder_timer_default_seconds"`
	InvitedUserIDs                       []string    `json:"invited_user_ids"`
	InvitedGroupIDs                      []string    `json:"invited_group_ids"`
	InviteUsersEnabled                   bool        `json:"invite_users_enabled"`
	DefaultOwnerID                       string      `json:"default_owner_id"`
	DefaultOwnerEnabled                  bool        `json:"default_owner_enabled"`
	AnnouncementChannelID                string      `json:"announcement_channel_id"`
	AnnouncementChannelEnabled           bool        `json:"announcement_channel_enabled"`
	WebhookOnCreationURL                 string      `json:"webhook_on_creation_url"`
	WebhookOnCreationEnabled             bool        `json:"webhook_on_creation_enabled"`
	MessageOnJoin                        string      `json:"message_on_join"`
	MessageOnJoinEnabled                 bool        `json:"message_on_join_enabled"`
	RetrospectiveReminderIntervalSeconds int64       `json:"retrospective_reminder_interval_seconds"`
	RetrospectiveTemplate                string      `json:"retrospective_template"`
	WebhookOnStatusUpdateURL             string      `json:"webhook_on_status_update_url"`
	WebhookOnStatusUpdateEnabled         bool        `json:"webhook_on_status_update_enabled"`
	ExportChannelOnArchiveEnabled        bool        `json:"export_channel_on_archive_enabled"`
	SignalAnyKeywords                    []string    `json:"signal_any_keywords"`
	SignalAnyKeywordsEnabled             bool        `json:"signal_any_keywords_enabled"`
	CategorizeChannelEnabled             bool        `json:"categorize_channel_enabled"`
}

func (p Playbook) Clone() Playbook {
	newPlaybook := p
	var newChecklists []Checklist
	for _, c := range p.Checklists {
		newChecklists = append(newChecklists, c.Clone())
	}
	newPlaybook.Checklists = newChecklists
	newPlaybook.MemberIDs = append([]string(nil), p.MemberIDs...)
	if len(p.InvitedUserIDs) != 0 {
		newPlaybook.InvitedUserIDs = append([]string(nil), p.InvitedUserIDs...)
	}
	if len(p.InvitedGroupIDs) != 0 {
		newPlaybook.InvitedGroupIDs = append([]string(nil), p.InvitedGroupIDs...)
	}
	if len(p.SignalAnyKeywords) != 0 {
		newPlaybook.SignalAnyKeywords = append([]string(nil), p.SignalAnyKeywords...)
	}
	return newPlaybook
}

func (p Playbook) MarshalJSON() ([]byte, error) {
	type Alias Playbook

	old := Alias(p.Clone())
	// replace nils with empty slices for the frontend
	if old.Checklists == nil {
		old.Checklists = []Checklist{}
	}
	for j, cl := range old.Checklists {
		if cl.Items == nil {
			old.Checklists[j].Items = []ChecklistItem{}
		}
	}
	if old.MemberIDs == nil {
		old.MemberIDs = []string{}
	}
	if old.InvitedUserIDs == nil {
		old.InvitedUserIDs = []string{}
	}
	if old.InvitedGroupIDs == nil {
		old.InvitedGroupIDs = []string{}
	}
	if old.SignalAnyKeywords == nil {
		old.SignalAnyKeywords = []string{}
	}

	return json.Marshal(old)
}

// Checklist represents a checklist in a playbook
type Checklist struct {
	ID    string          `json:"id"`
	Title string          `json:"title"`
	Items []ChecklistItem `json:"items"`
}

func (c Checklist) Clone() Checklist {
	newChecklist := c
	newChecklist.Items = append([]ChecklistItem(nil), c.Items...)
	return newChecklist
}

// ChecklistItem represents an item in a checklist
type ChecklistItem struct {
	ID                     string `json:"id"`
	Title                  string `json:"title"`
	State                  string `json:"state"`
	StateModified          int64  `json:"state_modified"`
	StateModifiedPostID    string `json:"state_modified_post_id"`
	AssigneeID             string `json:"assignee_id"`
	AssigneeModified       int64  `json:"assignee_modified"`
	AssigneeModifiedPostID string `json:"assignee_modified_post_id"`
	Command                string `json:"command"`
	CommandLastRun         int64  `json:"command_last_run"`
	Description            string `json:"description"`
}

type GetPlaybooksResults struct {
	TotalCount int        `json:"total_count"`
	PageCount  int        `json:"page_count"`
	HasMore    bool       `json:"has_more"`
	Items      []Playbook `json:"items"`
}

// MarshalJSON customizes the JSON marshalling for GetPlaybooksResults by rendering a nil Items as
// an empty slice instead.
func (r GetPlaybooksResults) MarshalJSON() ([]byte, error) {
	type Alias GetPlaybooksResults

	if r.Items == nil {
		r.Items = []Playbook{}
	}

	aux := &struct {
		*Alias
	}{
		Alias: (*Alias)(&r),
	}

	return json.Marshal(aux)
}

// PlaybookService is the playbook service for managing playbooks
// userID is the user initiating the event.
type PlaybookService interface {
	// Get retrieves a playbook. Returns ErrNotFound if not found.
	Get(id string) (Playbook, error)

	// Create creates a new playbook
	Create(playbook Playbook, userID string) (string, error)

	// GetPlaybooks retrieves all playbooks
	GetPlaybooks() ([]Playbook, error)

	// GetPlaybooksForTeam retrieves all playbooks on the specified team given the provided options
	GetPlaybooksForTeam(requesterInfo RequesterInfo, teamID string, opts PlaybookFilterOptions) (GetPlaybooksResults, error)

	// GetNumPlaybooksForTeam retrieves the number of playbooks in a given team
	GetNumPlaybooksForTeam(teamID string) (int, error)

	// GetSuggestedPlaybooks returns suggested playbooks and triggers for the user message
	GetSuggestedPlaybooks(teamID, userID, message string) ([]*CachedPlaybook, []string)

	// Update updates a playbook
	Update(playbook Playbook, userID string) error

	// Delete deletes a playbook
	Delete(playbook Playbook, userID string) error

	// MessageHasBeenPosted suggests playbooks to the user if triggered
	MessageHasBeenPosted(sessionID string, post *model.Post)
}

// PlaybookStore is an interface for storing playbooks
type PlaybookStore interface {
	// Get retrieves a playbook
	Get(id string) (Playbook, error)

	// Create creates a new playbook
	Create(playbook Playbook) (string, error)
	// GetPlaybooks retrieves all playbooks
	GetPlaybooks() ([]Playbook, error)

	// GetPlaybooksForTeam retrieves all playbooks on the specified team
	GetPlaybooksForTeam(requesterInfo RequesterInfo, teamID string, opts PlaybookFilterOptions) (GetPlaybooksResults, error)

	// GetNumPlaybooksForTeam retrieves the number of playbooks in a given team
	GetNumPlaybooksForTeam(teamID string) (int, error)

	// GetPlaybooksWithKeywords retrieves all playbooks with keywords enabled
	GetPlaybooksWithKeywords(opts PlaybookFilterOptions) ([]Playbook, error)

	// GetTimeLastUpdated retrieves time last playbook was updated at.
	// Passed argument determins whether to include playbooks with
	// SignalAnyKeywordsEnabled flag or not.
	GetTimeLastUpdated(onlyPlaybooksWithKeywordsEnabled bool) (int64, error)

	// GetPlaybookIDsForUser retrieves playbooks user can access
	GetPlaybookIDsForUser(userID, teamID string) ([]string, error)

	// Update updates a playbook
	Update(playbook Playbook) error

	// Delete deletes a playbook
	Delete(id string) error
}

// PlaybookTelemetry defines the methods that the Playbook service needs from the RudderTelemetry.
// userID is the user initiating the event.
type PlaybookTelemetry interface {
	// CreatePlaybook tracks the creation of a playbook.
	CreatePlaybook(playbook Playbook, userID string)

	// UpdatePlaybook tracks the update of a playbook.
	UpdatePlaybook(playbook Playbook, userID string)

	// DeletePlaybook tracks the deletion of a playbook.
	DeletePlaybook(playbook Playbook, userID string)

	// FrontendTelemetryForPlaybook tracks an event originating from the frontend
	FrontendTelemetryForPlaybook(playbook Playbook, userID, action string)
}

const (
	ChecklistItemStateOpen       = ""
	ChecklistItemStateInProgress = "in_progress"
	ChecklistItemStateClosed     = "closed"
)

func IsValidChecklistItemState(state string) bool {
	return state == ChecklistItemStateClosed ||
		state == ChecklistItemStateInProgress ||
		state == ChecklistItemStateOpen
}

func IsValidChecklistItemIndex(checklists []Checklist, checklistNum, itemNum int) bool {
	return checklists != nil && checklistNum >= 0 && itemNum >= 0 && checklistNum < len(checklists) && itemNum < len(checklists[checklistNum].Items)
}

// PlaybookFilterOptions specifies the parameters when getting playbooks.
type PlaybookFilterOptions struct {
	Sort      SortField
	Direction SortDirection

	// Pagination options.
	Page    int
	PerPage int
}

// Clone duplicates the given options.
func (o *PlaybookFilterOptions) Clone() PlaybookFilterOptions {
	return *o
}

// Validate returns a new, validated filter options or returns an error if invalid.
func (o PlaybookFilterOptions) Validate() (PlaybookFilterOptions, error) {
	options := o.Clone()

	if options.PerPage <= 0 {
		options.PerPage = PerPageDefault
	}

	options.Sort = SortField(strings.ToLower(string(options.Sort)))
	switch options.Sort {
	case SortByID:
	case SortByTitle:
	case SortByStages:
	case SortBySteps:
	case "": // default
		options.Sort = SortByID
	default:
		return PlaybookFilterOptions{}, errors.Errorf("unsupported sort '%s'", options.Sort)
	}

	options.Direction = SortDirection(strings.ToUpper(string(options.Direction)))
	switch options.Direction {
	case DirectionAsc:
	case DirectionDesc:
	case "": //default
		options.Direction = DirectionAsc
	default:
		return PlaybookFilterOptions{}, errors.Errorf("unsupported direction '%s'", options.Direction)
	}

	return options, nil
}
