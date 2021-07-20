package sqlstore

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"math"
	"strings"
	"time"

	"github.com/go-sql-driver/mysql"

	"github.com/lib/pq"

	"github.com/jmoiron/sqlx"

	sq "github.com/Masterminds/squirrel"
	"github.com/mattermost/mattermost-plugin-incident-collaboration/server/app"
	"github.com/mattermost/mattermost-plugin-incident-collaboration/server/bot"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/pkg/errors"
)

const (
	legacyEventTypeCommanderChanged = "commander_changed"
)

type sqlPlaybookRun struct {
	app.PlaybookRun
	ChecklistsJSON              json.RawMessage
	ConcatenatedInvitedUserIDs  string
	ConcatenatedInvitedGroupIDs string
}

// playbookRunStore holds the information needed to fulfill the methods in the store interface.
type playbookRunStore struct {
	pluginAPI            PluginAPIClient
	log                  bot.Logger
	store                *SQLStore
	queryBuilder         sq.StatementBuilderType
	playbookRunSelect    sq.SelectBuilder
	statusPostsSelect    sq.SelectBuilder
	timelineEventsSelect sq.SelectBuilder
}

// Ensure playbookRunStore implements the app.PlaybookRunStore interface.
var _ app.PlaybookRunStore = (*playbookRunStore)(nil)

type playbookRunStatusPosts []struct {
	PlaybookRunID string
	app.StatusPost
}

func applyPlaybookRunFilterOptionsSort(builder sq.SelectBuilder, options app.PlaybookRunFilterOptions) (sq.SelectBuilder, error) {
	var sort string
	switch options.Sort {
	case app.SortByCreateAt:
		sort = "CreateAt"
	case app.SortByID:
		sort = "ID"
	case app.SortByName:
		sort = "Name"
	case app.SortByOwnerUserID:
		sort = "OwnerUserID"
	case app.SortByTeamID:
		sort = "TeamID"
	case app.SortByEndAt:
		sort = "EndAt"
	case app.SortByStatus:
		sort = "CurrentStatus"
	case app.SortByLastStatusUpdateAt:
		sort = "LastStatusUpdateAt"
	case "":
		// Default to a stable sort if none explicitly provided.
		sort = "ID"
	default:
		return sq.SelectBuilder{}, errors.Errorf("unsupported sort parameter '%s'", options.Sort)
	}

	var direction string
	switch options.Direction {
	case app.DirectionAsc:
		direction = "ASC"
	case app.DirectionDesc:
		direction = "DESC"
	case "":
		// Default to an ascending sort if none explicitly provided.
		direction = "ASC"
	default:
		return sq.SelectBuilder{}, errors.Errorf("unsupported direction parameter '%s'", options.Direction)
	}

	builder = builder.OrderByClause(fmt.Sprintf("%s %s", sort, direction))

	page := options.Page
	perPage := options.PerPage
	if page < 0 {
		page = 0
	}
	if perPage < 0 {
		perPage = 0
	}

	builder = builder.
		Offset(uint64(page * perPage)).
		Limit(uint64(perPage))

	return builder, nil
}

// NewPlaybookRunStore creates a new store for playbook run ServiceImpl.
func NewPlaybookRunStore(pluginAPI PluginAPIClient, log bot.Logger, sqlStore *SQLStore) app.PlaybookRunStore {
	// When adding a Playbook Run column #1: add to this select
	playbookRunSelect := sqlStore.builder.
		Select("i.ID", "c.DisplayName AS Name", "i.Description", "i.CommanderUserID AS OwnerUserID", "i.TeamID", "i.ChannelID",
			"i.CreateAt", "i.EndAt", "i.DeleteAt", "i.PostID", "i.PlaybookID", "i.ReporterUserID", "i.CurrentStatus", "i.LastStatusUpdateAt",
			"i.ChecklistsJSON", "COALESCE(i.ReminderPostID, '') ReminderPostID", "i.PreviousReminder", "i.BroadcastChannelID",
			"COALESCE(ReminderMessageTemplate, '') ReminderMessageTemplate", "ConcatenatedInvitedUserIDs", "ConcatenatedInvitedGroupIDs", "DefaultCommanderID AS DefaultOwnerID",
			"AnnouncementChannelID", "WebhookOnCreationURL", "Retrospective", "MessageOnJoin", "RetrospectivePublishedAt", "RetrospectiveReminderIntervalSeconds",
			"RetrospectiveWasCanceled", "WebhookOnStatusUpdateURL", "ExportChannelOnArchiveEnabled",
			"CategorizeChannelEnabled").
		From("IR_Incident AS i").
		Join("Channels AS c ON (c.Id = i.ChannelId)")

	statusPostsSelect := sqlStore.builder.
		Select("sp.IncidentID AS PlaybookRunID", "p.ID", "p.CreateAt", "p.DeleteAt", "sp.Status").
		From("IR_StatusPosts as sp").
		Join("Posts as p ON sp.PostID = p.Id")

	timelineEventsSelect := sqlStore.builder.
		Select(
			"te.ID",
			"te.IncidentID AS PlaybookRunID",
			"te.CreateAt",
			"te.DeleteAt",
			"te.EventAt",
		).
		// Map "commander_changed" to "owner_changed", preserving database compatibility
		// without complicating the code.
		Column(
			sq.Alias(
				sq.Case().
					When(sq.Eq{"te.EventType": legacyEventTypeCommanderChanged}, sq.Expr("?", app.OwnerChanged)).
					Else("te.EventType"),
				"EventType",
			),
		).
		Columns(
			"te.Summary",
			"te.Details",
			"te.PostID",
			"te.SubjectUserID",
			"te.CreatorUserID",
		).
		From("IR_TimelineEvent as te")

	return &playbookRunStore{
		pluginAPI:            pluginAPI,
		log:                  log,
		store:                sqlStore,
		queryBuilder:         sqlStore.builder,
		playbookRunSelect:    playbookRunSelect,
		statusPostsSelect:    statusPostsSelect,
		timelineEventsSelect: timelineEventsSelect,
	}
}

// GetPlaybookRuns returns filtered playbook runs and the total count before paging.
func (s *playbookRunStore) GetPlaybookRuns(requesterInfo app.RequesterInfo, options app.PlaybookRunFilterOptions) (*app.GetPlaybookRunsResults, error) {
	permissionsExpr := s.buildPermissionsExpr(requesterInfo)
	teamLimitExpr := buildTeamLimitExpr(requesterInfo.UserID, options.TeamID, "i")

	queryForResults := s.playbookRunSelect.
		Where(permissionsExpr).
		Where(teamLimitExpr)

	queryForTotal := s.store.builder.
		Select("COUNT(*)").
		From("IR_Incident AS i").
		Join("Channels AS c ON (c.Id = i.ChannelId)").
		Where(permissionsExpr).
		Where(teamLimitExpr)

	if options.Status != "" && len(options.Statuses) != 0 {
		return nil, errors.New("options Status and Statuses cannot both be set")
	}

	if options.Status != "" {
		queryForResults = queryForResults.Where(sq.Eq{"i.CurrentStatus": options.Status})
		queryForTotal = queryForTotal.Where(sq.Eq{"i.CurrentStatus": options.Status})
	}

	if len(options.Statuses) != 0 {
		queryForResults = queryForResults.Where(sq.Eq{"i.CurrentStatus": options.Statuses})
		queryForTotal = queryForTotal.Where(sq.Eq{"i.CurrentStatus": options.Statuses})
	}

	if options.OwnerID != "" {
		queryForResults = queryForResults.Where(sq.Eq{"i.CommanderUserID": options.OwnerID})
		queryForTotal = queryForTotal.Where(sq.Eq{"i.CommanderUserID": options.OwnerID})
	}

	if options.MemberID != "" {
		membershipClause := s.queryBuilder.
			Select("1").
			Prefix("EXISTS(").
			From("ChannelMembers AS cm").
			Where("cm.ChannelId = i.ChannelID").
			Where(sq.Eq{"cm.UserId": strings.ToLower(options.MemberID)}).
			Suffix(")")

		queryForResults = queryForResults.Where(membershipClause)
		queryForTotal = queryForTotal.Where(membershipClause)
	}

	if options.PlaybookID != "" {
		queryForResults = queryForResults.Where(sq.Eq{"i.PlaybookID": options.PlaybookID})
		queryForTotal = queryForTotal.Where(sq.Eq{"i.PlaybookID": options.PlaybookID})
	}

	// TODO: do we need to sanitize (replace any '%'s in the search term)?
	if options.SearchTerm != "" {
		column := "c.DisplayName"
		searchString := options.SearchTerm

		// Postgres performs a case-sensitive search, so we need to lowercase
		// both the column contents and the search string
		if s.store.db.DriverName() == model.DATABASE_DRIVER_POSTGRES {
			column = "LOWER(c.DisplayName)"
			searchString = strings.ToLower(options.SearchTerm)
		}

		queryForResults = queryForResults.Where(sq.Like{column: fmt.Sprint("%", searchString, "%")})
		queryForTotal = queryForTotal.Where(sq.Like{column: fmt.Sprint("%", searchString, "%")})
	}

	queryForResults = queryActiveBetweenTimes(queryForResults, options.ActiveGTE, options.ActiveLT)
	queryForTotal = queryActiveBetweenTimes(queryForTotal, options.ActiveGTE, options.ActiveLT)

	queryForResults = queryStartedBetweenTimes(queryForResults, options.StartedGTE, options.StartedLT)
	queryForTotal = queryStartedBetweenTimes(queryForTotal, options.StartedGTE, options.StartedLT)

	queryForResults, err := applyPlaybookRunFilterOptionsSort(queryForResults, options)
	if err != nil {
		return nil, errors.Wrap(err, "failed to apply sort options")
	}

	tx, err := s.store.db.Beginx()
	if err != nil {
		return nil, errors.Wrap(err, "could not begin transaction")
	}
	defer s.store.finalizeTransaction(tx)

	var rawPlaybookRuns []sqlPlaybookRun
	if err = s.store.selectBuilder(tx, &rawPlaybookRuns, queryForResults); err != nil {
		return nil, errors.Wrap(err, "failed to query for playbook runs")
	}

	var total int
	if err = s.store.getBuilder(tx, &total, queryForTotal); err != nil {
		return nil, errors.Wrap(err, "failed to get total count")
	}
	pageCount := 0
	if options.PerPage > 0 {
		pageCount = int(math.Ceil(float64(total) / float64(options.PerPage)))
	}
	hasMore := options.Page+1 < pageCount

	playbookRuns := make([]app.PlaybookRun, 0, len(rawPlaybookRuns))
	playbookRunIDs := make([]string, 0, len(rawPlaybookRuns))
	for _, rawPlaybookRun := range rawPlaybookRuns {
		var playbookRun *app.PlaybookRun
		playbookRun, err = s.toPlaybookRun(rawPlaybookRun)
		if err != nil {
			return nil, err
		}
		playbookRuns = append(playbookRuns, *playbookRun)
		playbookRunIDs = append(playbookRunIDs, playbookRun.ID)
	}

	var statusPosts playbookRunStatusPosts

	postInfoSelect := s.statusPostsSelect.
		OrderBy("p.CreateAt").
		Where(sq.Eq{"sp.IncidentID": playbookRunIDs})

	err = s.store.selectBuilder(tx, &statusPosts, postInfoSelect)
	if err != nil && err != sql.ErrNoRows {
		return nil, errors.Wrap(err, "failed to get playbook run status posts")
	}

	timelineEvents, err := s.getTimelineEventsForPlaybookRun(tx, playbookRunIDs)
	if err != nil {
		return nil, err
	}

	if err = tx.Commit(); err != nil {
		return nil, errors.Wrap(err, "could not commit transaction")
	}

	addStatusPostsToPlaybookRuns(statusPosts, playbookRuns)
	addTimelineEventsToPlaybookRuns(timelineEvents, playbookRuns)

	return &app.GetPlaybookRunsResults{
		TotalCount: total,
		PageCount:  pageCount,
		HasMore:    hasMore,
		Items:      playbookRuns,
	}, nil
}

// CreatePlaybookRun creates a new playbook run. If playbook run has an ID, that ID will be used.
func (s *playbookRunStore) CreatePlaybookRun(playbookRun *app.PlaybookRun) (*app.PlaybookRun, error) {
	if playbookRun == nil {
		return nil, errors.New("playbook run is nil")
	}
	playbookRun = playbookRun.Clone()

	if playbookRun.ID == "" {
		playbookRun.ID = model.NewId()
	}

	rawPlaybookRun, err := toSQLPlaybookRun(*playbookRun)
	if err != nil {
		return nil, err
	}

	// When adding an PlaybookRun column #2: add to the SetMap
	_, err = s.store.execBuilder(s.store.db, sq.
		Insert("IR_Incident").
		SetMap(map[string]interface{}{
			"ID":                                   rawPlaybookRun.ID,
			"Name":                                 rawPlaybookRun.Name,
			"Description":                          rawPlaybookRun.Description,
			"CommanderUserID":                      rawPlaybookRun.OwnerUserID,
			"ReporterUserID":                       rawPlaybookRun.ReporterUserID,
			"TeamID":                               rawPlaybookRun.TeamID,
			"ChannelID":                            rawPlaybookRun.ChannelID,
			"CreateAt":                             rawPlaybookRun.CreateAt,
			"EndAt":                                rawPlaybookRun.EndAt,
			"PostID":                               rawPlaybookRun.PostID,
			"PlaybookID":                           rawPlaybookRun.PlaybookID,
			"ChecklistsJSON":                       rawPlaybookRun.ChecklistsJSON,
			"ReminderPostID":                       rawPlaybookRun.ReminderPostID,
			"PreviousReminder":                     rawPlaybookRun.PreviousReminder,
			"BroadcastChannelID":                   rawPlaybookRun.BroadcastChannelID,
			"ReminderMessageTemplate":              rawPlaybookRun.ReminderMessageTemplate,
			"CurrentStatus":                        rawPlaybookRun.CurrentStatus,
			"LastStatusUpdateAt":                   rawPlaybookRun.LastStatusUpdateAt,
			"ConcatenatedInvitedUserIDs":           rawPlaybookRun.ConcatenatedInvitedUserIDs,
			"ConcatenatedInvitedGroupIDs":          rawPlaybookRun.ConcatenatedInvitedGroupIDs,
			"DefaultCommanderID":                   rawPlaybookRun.DefaultOwnerID,
			"AnnouncementChannelID":                rawPlaybookRun.AnnouncementChannelID,
			"WebhookOnCreationURL":                 rawPlaybookRun.WebhookOnCreationURL,
			"Retrospective":                        rawPlaybookRun.Retrospective,
			"RetrospectivePublishedAt":             rawPlaybookRun.RetrospectivePublishedAt,
			"MessageOnJoin":                        rawPlaybookRun.MessageOnJoin,
			"RetrospectiveReminderIntervalSeconds": rawPlaybookRun.RetrospectiveReminderIntervalSeconds,
			"RetrospectiveWasCanceled":             rawPlaybookRun.RetrospectiveWasCanceled,
			"WebhookOnStatusUpdateURL":             rawPlaybookRun.WebhookOnStatusUpdateURL,
			"ExportChannelOnArchiveEnabled":        rawPlaybookRun.ExportChannelOnArchiveEnabled,
			"CategorizeChannelEnabled":             rawPlaybookRun.CategorizeChannelEnabled,
			// Preserved for backwards compatibility with v1.2
			"ActiveStage":      0,
			"ActiveStageTitle": "",
			"IsActive":         true,
			"DeleteAt":         0,
		}))

	if err != nil {
		return nil, errors.Wrapf(err, "failed to store new playbook run")
	}

	return playbookRun, nil
}

// UpdatePlaybookRun updates a playbook run.
func (s *playbookRunStore) UpdatePlaybookRun(playbookRun *app.PlaybookRun) error {
	if playbookRun == nil {
		return errors.New("playbook run is nil")
	}
	if playbookRun.ID == "" {
		return errors.New("ID should not be empty")
	}

	rawPlaybookRun, err := toSQLPlaybookRun(*playbookRun)
	if err != nil {
		return err
	}

	// When adding an PlaybookRun column #3: add to this SetMap (if it is a column that can be updated)
	_, err = s.store.execBuilder(s.store.db, sq.
		Update("IR_Incident").
		SetMap(map[string]interface{}{
			"Name":                                 "",
			"Description":                          rawPlaybookRun.Description,
			"CommanderUserID":                      rawPlaybookRun.OwnerUserID,
			"LastStatusUpdateAt":                   rawPlaybookRun.LastStatusUpdateAt,
			"ChecklistsJSON":                       rawPlaybookRun.ChecklistsJSON,
			"ReminderPostID":                       rawPlaybookRun.ReminderPostID,
			"PreviousReminder":                     rawPlaybookRun.PreviousReminder,
			"BroadcastChannelID":                   rawPlaybookRun.BroadcastChannelID,
			"EndAt":                                rawPlaybookRun.ResolvedAt(),
			"ConcatenatedInvitedUserIDs":           rawPlaybookRun.ConcatenatedInvitedUserIDs,
			"ConcatenatedInvitedGroupIDs":          rawPlaybookRun.ConcatenatedInvitedGroupIDs,
			"DefaultCommanderID":                   rawPlaybookRun.DefaultOwnerID,
			"AnnouncementChannelID":                rawPlaybookRun.AnnouncementChannelID,
			"WebhookOnCreationURL":                 rawPlaybookRun.WebhookOnCreationURL,
			"Retrospective":                        rawPlaybookRun.Retrospective,
			"RetrospectivePublishedAt":             rawPlaybookRun.RetrospectivePublishedAt,
			"MessageOnJoin":                        rawPlaybookRun.MessageOnJoin,
			"RetrospectiveReminderIntervalSeconds": rawPlaybookRun.RetrospectiveReminderIntervalSeconds,
			"RetrospectiveWasCanceled":             rawPlaybookRun.RetrospectiveWasCanceled,
			"WebhookOnStatusUpdateURL":             rawPlaybookRun.WebhookOnStatusUpdateURL,
			"ExportChannelOnArchiveEnabled":        rawPlaybookRun.ExportChannelOnArchiveEnabled,
		}).
		Where(sq.Eq{"ID": rawPlaybookRun.ID}))

	if err != nil {
		return errors.Wrapf(err, "failed to update playbook run with id '%s'", rawPlaybookRun.ID)
	}

	return nil
}

func (s *playbookRunStore) UpdateStatus(statusPost *app.SQLStatusPost) error {
	if statusPost == nil {
		return errors.New("status post is nil")
	}
	if statusPost.PlaybookRunID == "" {
		return errors.New("needs playbook run ID")
	}
	if statusPost.PostID == "" {
		return errors.New("needs post ID")
	}
	if statusPost.Status == "" {
		return errors.New("needs status")
	}

	if _, err := s.store.execBuilder(s.store.db, sq.
		Insert("IR_StatusPosts").
		SetMap(map[string]interface{}{
			"IncidentID": statusPost.PlaybookRunID,
			"PostID":     statusPost.PostID,
			"Status":     statusPost.Status,
		})); err != nil {
		return errors.Wrap(err, "failed to add new status post")
	}

	if _, err := s.store.execBuilder(s.store.db, sq.
		Update("IR_Incident").
		SetMap(map[string]interface{}{
			"CurrentStatus": statusPost.Status,
			"EndAt":         statusPost.EndAt,
		}).
		Where(sq.Eq{"ID": statusPost.PlaybookRunID})); err != nil {
		return errors.Wrap(err, "failed to update current status")
	}

	return nil
}

// CreateTimelineEvent creates the timeline event
func (s *playbookRunStore) CreateTimelineEvent(event *app.TimelineEvent) (*app.TimelineEvent, error) {
	if event.PlaybookRunID == "" {
		return nil, errors.New("needs playbook run ID")
	}
	if event.EventType == "" {
		return nil, errors.New("needs event type")
	}
	if event.CreateAt == 0 {
		event.CreateAt = model.GetMillis()
	}
	event.ID = model.NewId()

	eventType := string(event.EventType)
	if event.EventType == app.OwnerChanged {
		eventType = legacyEventTypeCommanderChanged
	}

	_, err := s.store.execBuilder(s.store.db, sq.
		Insert("IR_TimelineEvent").
		SetMap(map[string]interface{}{
			"ID":            event.ID,
			"IncidentID":    event.PlaybookRunID,
			"CreateAt":      event.CreateAt,
			"DeleteAt":      event.DeleteAt,
			"EventAt":       event.EventAt,
			"EventType":     eventType,
			"Summary":       event.Summary,
			"Details":       event.Details,
			"PostID":        event.PostID,
			"SubjectUserID": event.SubjectUserID,
			"CreatorUserID": event.CreatorUserID,
		}))

	if err != nil {
		return nil, errors.Wrap(err, "failed to insert timeline event")
	}

	return event, nil
}

// UpdateTimelineEvent updates (or inserts) the timeline event
func (s *playbookRunStore) UpdateTimelineEvent(event *app.TimelineEvent) error {
	if event.ID == "" {
		return errors.New("needs event ID")
	}
	if event.PlaybookRunID == "" {
		return errors.New("needs playbook run ID")
	}
	if event.EventType == "" {
		return errors.New("needs event type")
	}

	eventType := string(event.EventType)
	if event.EventType == app.OwnerChanged {
		eventType = legacyEventTypeCommanderChanged
	}

	_, err := s.store.execBuilder(s.store.db, sq.
		Update("IR_TimelineEvent").
		SetMap(map[string]interface{}{
			"IncidentID":    event.PlaybookRunID,
			"CreateAt":      event.CreateAt,
			"DeleteAt":      event.DeleteAt,
			"EventAt":       event.EventAt,
			"EventType":     eventType,
			"Summary":       event.Summary,
			"Details":       event.Details,
			"PostID":        event.PostID,
			"SubjectUserID": event.SubjectUserID,
			"CreatorUserID": event.CreatorUserID,
		}).
		Where(sq.Eq{"ID": event.ID}))

	if err != nil {
		return errors.Wrap(err, "failed to update timeline event")
	}

	return nil
}

// GetPlaybookRun gets a playbook run by ID.
func (s *playbookRunStore) GetPlaybookRun(playbookRunID string) (*app.PlaybookRun, error) {
	if playbookRunID == "" {
		return nil, errors.New("ID cannot be empty")
	}

	tx, err := s.store.db.Beginx()
	if err != nil {
		return nil, errors.Wrap(err, "could not begin transaction")
	}
	defer s.store.finalizeTransaction(tx)

	var rawPlaybookRun sqlPlaybookRun
	err = s.store.getBuilder(tx, &rawPlaybookRun, s.playbookRunSelect.Where(sq.Eq{"i.ID": playbookRunID}))
	if err == sql.ErrNoRows {
		return nil, errors.Wrapf(app.ErrNotFound, "playbook run with id '%s' does not exist", playbookRunID)
	} else if err != nil {
		return nil, errors.Wrapf(err, "failed to get playbook run by id '%s'", playbookRunID)
	}

	playbookRun, err := s.toPlaybookRun(rawPlaybookRun)
	if err != nil {
		return nil, err
	}

	var statusPosts playbookRunStatusPosts

	postInfoSelect := s.statusPostsSelect.
		Where(sq.Eq{"sp.IncidentID": playbookRunID}).
		OrderBy("p.CreateAt")

	err = s.store.selectBuilder(tx, &statusPosts, postInfoSelect)
	if err != nil && err != sql.ErrNoRows {
		return nil, errors.Wrapf(err, "failed to get playbook run status posts for playbook run with id '%s'", playbookRunID)
	}

	timelineEvents, err := s.getTimelineEventsForPlaybookRun(tx, []string{playbookRunID})
	if err != nil {
		return nil, err
	}

	if err = tx.Commit(); err != nil {
		return nil, errors.Wrap(err, "could not commit transaction")
	}

	for _, p := range statusPosts {
		playbookRun.StatusPosts = append(playbookRun.StatusPosts, p.StatusPost)
	}

	playbookRun.TimelineEvents = append(playbookRun.TimelineEvents, timelineEvents...)

	return playbookRun, nil
}

func (s *playbookRunStore) getTimelineEventsForPlaybookRun(q sqlx.Queryer, playbookRunIDs []string) ([]app.TimelineEvent, error) {
	var timelineEvents []app.TimelineEvent

	timelineEventsSelect := s.timelineEventsSelect.
		OrderBy("te.EventAt ASC").
		Where(sq.And{sq.Eq{"te.IncidentID": playbookRunIDs}, sq.Eq{"te.DeleteAt": 0}})

	err := s.store.selectBuilder(q, &timelineEvents, timelineEventsSelect)
	if err != nil && err != sql.ErrNoRows {
		return nil, errors.Wrap(err, "failed to get timelineEvents")
	}

	return timelineEvents, nil
}

// GetTimelineEvent returns the timeline event by id for the given playbook run.
func (s *playbookRunStore) GetTimelineEvent(playbookRunID, eventID string) (*app.TimelineEvent, error) {
	var event app.TimelineEvent

	timelineEventSelect := s.timelineEventsSelect.
		Where(sq.And{sq.Eq{"te.IncidentID": playbookRunID}, sq.Eq{"te.ID": eventID}})

	err := s.store.getBuilder(s.store.db, &event, timelineEventSelect)
	if err == sql.ErrNoRows {
		return nil, errors.Wrapf(app.ErrNotFound, "timeline event with id (%s) does not exist for playbook run with id (%s)", eventID, playbookRunID)
	} else if err != nil {
		return nil, errors.Wrapf(err, "failed to get timeline event with id (%s) for playbook run with id (%s)", eventID, playbookRunID)
	}

	return &event, nil
}

// GetPlaybookRunIDForChannel gets the playbook run ID associated with the given channel ID.
func (s *playbookRunStore) GetPlaybookRunIDForChannel(channelID string) (string, error) {
	query := s.queryBuilder.
		Select("i.ID").
		From("IR_Incident i").
		Where(sq.Eq{"i.ChannelID": channelID})

	var id string
	err := s.store.getBuilder(s.store.db, &id, query)
	if err == sql.ErrNoRows {
		return "", errors.Wrapf(app.ErrNotFound, "channel with id (%s) does not have a playbook run", channelID)
	} else if err != nil {
		return "", errors.Wrapf(err, "failed to get playbook run by channelID '%s'", channelID)
	}

	return id, nil
}

// GetAllPlaybookRunMembersCount returns the count of all members of an playbook run's channel
// since the beginning of the playbook run, excluding bots.
func (s *playbookRunStore) GetAllPlaybookRunMembersCount(channelID string) (int64, error) {
	query := s.queryBuilder.
		Select("COUNT(DISTINCT cmh.UserId)").
		From("ChannelMemberHistory AS cmh").
		Where(sq.Eq{"cmh.ChannelId": channelID}).
		Where(sq.Expr("cmh.UserId NOT IN (SELECT UserId FROM Bots)"))

	var numMembers int64
	err := s.store.getBuilder(s.store.db, &numMembers, query)
	if err != nil {
		return 0, errors.Wrap(err, "failed to query database")
	}

	return numMembers, nil
}

// GetOwners returns the owners of the playbook runs selected by options
func (s *playbookRunStore) GetOwners(requesterInfo app.RequesterInfo, options app.PlaybookRunFilterOptions) ([]app.OwnerInfo, error) {
	permissionsExpr := s.buildPermissionsExpr(requesterInfo)
	teamLimitExpr := buildTeamLimitExpr(requesterInfo.UserID, options.TeamID, "i")

	// At the moment, the options only includes teamID
	query := s.queryBuilder.
		Select("DISTINCT u.Id AS UserID", "u.Username").
		From("IR_Incident AS i").
		Join("Users AS u ON i.CommanderUserID = u.Id").
		Where(teamLimitExpr).
		Where(permissionsExpr)

	var owners []app.OwnerInfo
	err := s.store.selectBuilder(s.store.db, &owners, query)
	if err != nil {
		return nil, errors.Wrap(err, "failed to query database")
	}

	return owners, nil
}

// NukeDB removes all playbook run related data.
func (s *playbookRunStore) NukeDB() (err error) {
	tx, err := s.store.db.Beginx()
	if err != nil {
		return errors.Wrap(err, "could not begin transaction")
	}
	defer s.store.finalizeTransaction(tx)

	if _, err := tx.Exec("DROP TABLE IF EXISTS IR_PlaybookMember,  IR_StatusPosts, IR_Incident, IR_Playbook, IR_System, IR_TimelineEvent"); err != nil {
		return errors.Wrap(err, "could not delete all IR tables")
	}

	if err := tx.Commit(); err != nil {
		return errors.Wrap(err, "could not commit")
	}

	return s.store.RunMigrations()
}

func (s *playbookRunStore) ChangeCreationDate(playbookRunID string, creationTimestamp time.Time) error {
	updateQuery := s.queryBuilder.Update("IR_Incident").
		Where(sq.Eq{"ID": playbookRunID}).
		Set("CreateAt", model.GetMillisForTime(creationTimestamp))

	sqlResult, err := s.store.execBuilder(s.store.db, updateQuery)
	if err != nil {
		return errors.Wrapf(err, "unable to execute the update query")
	}

	numRows, err := sqlResult.RowsAffected()
	if err != nil {
		return errors.Wrapf(err, "unable to check how many rows were updated")
	}

	if numRows == 0 {
		return app.ErrNotFound
	}

	return nil
}

// HasViewed returns true if userID has viewed channelID
func (s *playbookRunStore) HasViewedChannel(userID, channelID string) bool {
	query := sq.Expr(
		`SELECT EXISTS(SELECT *
                         FROM IR_ViewedChannel as vc
                        WHERE vc.ChannelID = ?
                          AND vc.UserID = ?)
             `, channelID, userID)

	var exists bool
	err := s.store.getBuilder(s.store.db, &exists, query)
	if err != nil {
		return false
	}

	return exists
}

// SetViewed records that userID has viewed channelID.
func (s *playbookRunStore) SetViewedChannel(userID, channelID string) error {
	if s.HasViewedChannel(userID, channelID) {
		return nil
	}

	_, err := s.store.execBuilder(s.store.db, sq.
		Insert("IR_ViewedChannel").
		SetMap(map[string]interface{}{
			"ChannelID": channelID,
			"UserID":    userID,
		}))

	if err != nil {
		if s.store.db.DriverName() == model.DATABASE_DRIVER_MYSQL {
			me, ok := err.(*mysql.MySQLError)
			if ok && me.Number == 1062 {
				return errors.Wrap(app.ErrDuplicateEntry, err.Error())
			}
		} else {
			pe, ok := err.(*pq.Error)
			if ok && pe.Code == "23505" {
				return errors.Wrap(app.ErrDuplicateEntry, err.Error())
			}
		}

		return errors.Wrapf(err, "failed to store userID and channelID")
	}

	return nil
}

func (s *playbookRunStore) buildPermissionsExpr(info app.RequesterInfo) sq.Sqlizer {
	if info.IsAdmin {
		return nil
	}

	// Guests must be channel members
	if info.IsGuest {
		return sq.Expr(`
			  EXISTS(SELECT 1
						 FROM ChannelMembers as cm
						 WHERE cm.ChannelId = i.ChannelID
						   AND cm.UserId = ?)
		`, info.UserID)
	}

	// is the requester a channel member, or is the channel public?
	return sq.Expr(`
		  (
			  -- If requester is a channel member
			  EXISTS(SELECT 1
						 FROM ChannelMembers as cm
						 WHERE cm.ChannelId = i.ChannelID
						   AND cm.UserId = ?)
			  -- Or if channel is public
			  OR EXISTS(SELECT 1
							FROM Channels as c
							WHERE c.Id = i.ChannelID
							  AND c.Type = 'O')
		  )`, info.UserID)
}

func buildTeamLimitExpr(userID, teamID, tableName string) sq.Sqlizer {
	if teamID != "" {
		return sq.Eq{fmt.Sprintf("%s.TeamID", tableName): teamID}
	}

	return sq.Expr(fmt.Sprintf(`
		EXISTS(SELECT 1
					FROM TeamMembers as tm
					WHERE tm.TeamId = %s.TeamID
					  AND tm.DeleteAt = 0  
		  	  		  AND tm.UserId = ?)
		`, tableName), userID)
}

func (s *playbookRunStore) toPlaybookRun(rawPlaybookRun sqlPlaybookRun) (*app.PlaybookRun, error) {
	playbookRun := rawPlaybookRun.PlaybookRun
	if err := json.Unmarshal(rawPlaybookRun.ChecklistsJSON, &playbookRun.Checklists); err != nil {
		return nil, errors.Wrapf(err, "failed to unmarshal checklists json for playbook run id: %s", rawPlaybookRun.ID)
	}

	playbookRun.InvitedUserIDs = []string(nil)
	if rawPlaybookRun.ConcatenatedInvitedUserIDs != "" {
		playbookRun.InvitedUserIDs = strings.Split(rawPlaybookRun.ConcatenatedInvitedUserIDs, ",")
	}

	playbookRun.InvitedGroupIDs = []string(nil)
	if rawPlaybookRun.ConcatenatedInvitedGroupIDs != "" {
		playbookRun.InvitedGroupIDs = strings.Split(rawPlaybookRun.ConcatenatedInvitedGroupIDs, ",")
	}

	return &playbookRun, nil
}

func toSQLPlaybookRun(playbookRun app.PlaybookRun) (*sqlPlaybookRun, error) {
	newChecklists := populateChecklistIDs(playbookRun.Checklists)
	checklistsJSON, err := checklistsToJSON(newChecklists)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to marshal checklist json for playbook run id: '%s'", playbookRun.ID)
	}

	return &sqlPlaybookRun{
		PlaybookRun:                 playbookRun,
		ChecklistsJSON:              checklistsJSON,
		ConcatenatedInvitedUserIDs:  strings.Join(playbookRun.InvitedUserIDs, ","),
		ConcatenatedInvitedGroupIDs: strings.Join(playbookRun.InvitedGroupIDs, ","),
	}, nil
}

// populateChecklistIDs returns a cloned slice with ids entered for checklists and checklist items.
func populateChecklistIDs(checklists []app.Checklist) []app.Checklist {
	if len(checklists) == 0 {
		return nil
	}

	newChecklists := make([]app.Checklist, len(checklists))
	for i, c := range checklists {
		newChecklists[i] = c.Clone()
		if newChecklists[i].ID == "" {
			newChecklists[i].ID = model.NewId()
		}
		for j, item := range newChecklists[i].Items {
			if item.ID == "" {
				newChecklists[i].Items[j].ID = model.NewId()
			}
		}
	}

	return newChecklists
}

// A playbook run needs to assign unique ids to its checklist items
func checklistsToJSON(checklists []app.Checklist) (json.RawMessage, error) {
	checklistsJSON, err := json.Marshal(checklists)
	if err != nil {
		return nil, errors.Wrap(err, "failed to marshal checklist json")
	}

	return checklistsJSON, nil
}

func addStatusPostsToPlaybookRuns(statusIDs playbookRunStatusPosts, playbookRuns []app.PlaybookRun) {
	iToPosts := make(map[string][]app.StatusPost)
	for _, p := range statusIDs {
		iToPosts[p.PlaybookRunID] = append(iToPosts[p.PlaybookRunID], p.StatusPost)
	}
	for i, playbookRun := range playbookRuns {
		playbookRuns[i].StatusPosts = iToPosts[playbookRun.ID]
	}
}

func addTimelineEventsToPlaybookRuns(timelineEvents []app.TimelineEvent, playbookRuns []app.PlaybookRun) {
	iToTe := make(map[string][]app.TimelineEvent)
	for _, te := range timelineEvents {
		iToTe[te.PlaybookRunID] = append(iToTe[te.PlaybookRunID], te)
	}
	for i, playbookRun := range playbookRuns {
		playbookRuns[i].TimelineEvents = iToTe[playbookRun.ID]
	}
}

// queryActiveBetweenTimes will modify the query only if one (or both) of start and end are non-zero.
// If both are non-zero, return the playbook runs active between those two times.
// If start is zero, return the playbook run active before the end (not active after the end).
// If end is zero, return the playbook run active after start.
func queryActiveBetweenTimes(query sq.SelectBuilder, start int64, end int64) sq.SelectBuilder {
	if start > 0 && end > 0 {
		return queryActive(query, start, end)
	} else if start > 0 {
		return queryActive(query, start, model.GetMillis())
	} else if end > 0 {
		return queryActive(query, 0, end)
	}

	// both were zero, don't apply a filter:
	return query
}

func queryActive(query sq.SelectBuilder, start int64, end int64) sq.SelectBuilder {
	return query.Where(
		sq.And{
			sq.Or{
				sq.GtOrEq{"i.EndAt": start},
				sq.Eq{"i.EndAt": 0},
			},
			sq.Lt{"i.CreateAt": end},
		})
}

// queryStartedBetweenTimes will modify the query only if one (or both) of start and end are non-zero.
// If both are non-zero, return the playbook runs started between those two times.
// If start is zero, return the playbook run started before the end
// If end is zero, return the playbook run started after start.
func queryStartedBetweenTimes(query sq.SelectBuilder, start int64, end int64) sq.SelectBuilder {
	if start > 0 && end > 0 {
		return queryStarted(query, start, end)
	} else if start > 0 {
		return queryStarted(query, start, model.GetMillis())
	} else if end > 0 {
		return queryStarted(query, 0, end)
	}

	// both were zero, don't apply a filter:
	return query
}

func queryStarted(query sq.SelectBuilder, start int64, end int64) sq.SelectBuilder {
	return query.Where(
		sq.And{
			sq.GtOrEq{"i.CreateAt": start},
			sq.Lt{"i.CreateAt": end},
		})
}
