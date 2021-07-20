package sqlstore

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"math"
	"strings"

	sq "github.com/Masterminds/squirrel"
	"github.com/mattermost/mattermost-plugin-incident-collaboration/server/app"
	"github.com/mattermost/mattermost-plugin-incident-collaboration/server/bot"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/pkg/errors"
)

type sqlPlaybook struct {
	app.Playbook
	ChecklistsJSON                json.RawMessage
	ConcatenatedInvitedUserIDs    string
	ConcatenatedInvitedGroupIDs   string
	ConcatenatedSignalAnyKeywords string
}

// playbookStore is a sql store for playbooks. Use NewPlaybookStore to create it.
type playbookStore struct {
	pluginAPI       PluginAPIClient
	log             bot.Logger
	store           *SQLStore
	queryBuilder    sq.StatementBuilderType
	playbookSelect  sq.SelectBuilder
	memberIDsSelect sq.SelectBuilder
}

// Ensure playbookStore implements the playbook.Store interface.
var _ app.PlaybookStore = (*playbookStore)(nil)

type playbookMembers []struct {
	PlaybookID string
	MemberID   string
}

func applyPlaybookFilterOptionsSort(builder sq.SelectBuilder, options app.PlaybookFilterOptions) (sq.SelectBuilder, error) {
	var sort string
	switch options.Sort {
	case app.SortByID:
		sort = "ID"
	case app.SortByTitle:
		sort = "Title"
	case app.SortByStages:
		sort = "NumStages"
	case app.SortBySteps:
		sort = "NumSteps"
	case app.SortByRuns:
		sort = "NumRuns"
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

// NewPlaybookStore creates a new store for playbook service.
func NewPlaybookStore(pluginAPI PluginAPIClient, log bot.Logger, sqlStore *SQLStore) app.PlaybookStore {
	playbookSelect := sqlStore.builder.
		Select(
			"ID",
			"Title",
			"Description",
			"TeamID",
			"CreatePublicIncident AS CreatePublicPlaybookRun",
			"CreateAt",
			"UpdateAt",
			"DeleteAt",
			"NumStages",
			"NumSteps",
			"BroadcastChannelID",
			"COALESCE(ReminderMessageTemplate, '') ReminderMessageTemplate",
			"ReminderTimerDefaultSeconds",
			"ConcatenatedInvitedUserIDs",
			"ConcatenatedInvitedGroupIDs",
			"InviteUsersEnabled",
			"DefaultCommanderID AS DefaultOwnerID",
			"DefaultCommanderEnabled AS DefaultOwnerEnabled",
			"AnnouncementChannelID",
			"AnnouncementChannelEnabled",
			"WebhookOnCreationURL",
			"WebhookOnCreationEnabled",
			"MessageOnJoin",
			"MessageOnJoinEnabled",
			"RetrospectiveReminderIntervalSeconds",
			"RetrospectiveTemplate",
			"WebhookOnStatusUpdateURL",
			"WebhookOnStatusUpdateEnabled",
			"ExportChannelOnArchiveEnabled",
			"ConcatenatedSignalAnyKeywords",
			"SignalAnyKeywordsEnabled",
			"CategorizeChannelEnabled",
		).
		From("IR_Playbook")

	memberIDsSelect := sqlStore.builder.
		Select("PlaybookID", "MemberID").
		From("IR_PlaybookMember")

	newStore := &playbookStore{
		pluginAPI:       pluginAPI,
		log:             log,
		store:           sqlStore,
		queryBuilder:    sqlStore.builder,
		playbookSelect:  playbookSelect,
		memberIDsSelect: memberIDsSelect,
	}
	return newStore
}

// Create creates a new playbook
func (p *playbookStore) Create(playbook app.Playbook) (id string, err error) {
	if playbook.ID != "" {
		return "", errors.New("ID should be empty")
	}
	playbook.ID = model.NewId()

	rawPlaybook, err := toSQLPlaybook(playbook)
	if err != nil {
		return "", err
	}

	tx, err := p.store.db.Beginx()
	if err != nil {
		return "", errors.Wrap(err, "could not begin transaction")
	}
	defer p.store.finalizeTransaction(tx)

	_, err = p.store.execBuilder(tx, sq.
		Insert("IR_Playbook").
		SetMap(map[string]interface{}{
			"ID":                                   rawPlaybook.ID,
			"Title":                                rawPlaybook.Title,
			"Description":                          rawPlaybook.Description,
			"TeamID":                               rawPlaybook.TeamID,
			"CreatePublicIncident":                 rawPlaybook.CreatePublicPlaybookRun,
			"CreateAt":                             rawPlaybook.CreateAt,
			"UpdateAt":                             rawPlaybook.UpdateAt,
			"DeleteAt":                             rawPlaybook.DeleteAt,
			"ChecklistsJSON":                       rawPlaybook.ChecklistsJSON,
			"NumStages":                            len(rawPlaybook.Checklists),
			"NumSteps":                             getSteps(rawPlaybook.Playbook),
			"BroadcastChannelID":                   rawPlaybook.BroadcastChannelID,
			"ReminderMessageTemplate":              rawPlaybook.ReminderMessageTemplate,
			"ReminderTimerDefaultSeconds":          rawPlaybook.ReminderTimerDefaultSeconds,
			"ConcatenatedInvitedUserIDs":           rawPlaybook.ConcatenatedInvitedUserIDs,
			"ConcatenatedInvitedGroupIDs":          rawPlaybook.ConcatenatedInvitedGroupIDs,
			"InviteUsersEnabled":                   rawPlaybook.InviteUsersEnabled,
			"DefaultCommanderID":                   rawPlaybook.DefaultOwnerID,
			"DefaultCommanderEnabled":              rawPlaybook.DefaultOwnerEnabled,
			"AnnouncementChannelID":                rawPlaybook.AnnouncementChannelID,
			"AnnouncementChannelEnabled":           rawPlaybook.AnnouncementChannelEnabled,
			"WebhookOnCreationURL":                 rawPlaybook.WebhookOnCreationURL,
			"WebhookOnCreationEnabled":             rawPlaybook.WebhookOnCreationEnabled,
			"MessageOnJoin":                        rawPlaybook.MessageOnJoin,
			"MessageOnJoinEnabled":                 rawPlaybook.MessageOnJoinEnabled,
			"RetrospectiveReminderIntervalSeconds": rawPlaybook.RetrospectiveReminderIntervalSeconds,
			"RetrospectiveTemplate":                rawPlaybook.RetrospectiveTemplate,
			"WebhookOnStatusUpdateURL":             rawPlaybook.WebhookOnStatusUpdateURL,
			"WebhookOnStatusUpdateEnabled":         rawPlaybook.WebhookOnStatusUpdateEnabled,
			"ExportChannelOnArchiveEnabled":        rawPlaybook.ExportChannelOnArchiveEnabled,
			"ConcatenatedSignalAnyKeywords":        rawPlaybook.ConcatenatedSignalAnyKeywords,
			"SignalAnyKeywordsEnabled":             rawPlaybook.SignalAnyKeywordsEnabled,
			"CategorizeChannelEnabled":             rawPlaybook.CategorizeChannelEnabled,
		}))
	if err != nil {
		return "", errors.Wrap(err, "failed to store new playbook")
	}

	if err = p.replacePlaybookMembers(tx, rawPlaybook.Playbook); err != nil {
		return "", errors.Wrap(err, "failed to replace playbook members")
	}

	if err = tx.Commit(); err != nil {
		return "", errors.Wrap(err, "could not commit transaction")
	}

	return rawPlaybook.ID, nil
}

// Get retrieves a playbook
func (p *playbookStore) Get(id string) (app.Playbook, error) {
	if id == "" {
		return app.Playbook{}, errors.New("ID cannot be empty")
	}

	tx, err := p.store.db.Beginx()
	if err != nil {
		return app.Playbook{}, errors.Wrap(err, "could not begin transaction")
	}
	defer p.store.finalizeTransaction(tx)

	withChecklistsSelect := p.playbookSelect.
		Columns("ChecklistsJSON").
		From("IR_Playbook")

	var rawPlaybook sqlPlaybook
	err = p.store.getBuilder(tx, &rawPlaybook, withChecklistsSelect.Where(sq.Eq{"ID": id}))
	if err == sql.ErrNoRows {
		return app.Playbook{}, errors.Wrapf(app.ErrNotFound, "playbook does not exist for id '%s'", id)
	} else if err != nil {
		return app.Playbook{}, errors.Wrapf(err, "failed to get playbook by id '%s'", id)
	}

	playbook, err := toPlaybook(rawPlaybook)
	if err != nil {
		return app.Playbook{}, err
	}

	var memberIDs playbookMembers
	err = p.store.selectBuilder(tx, &memberIDs, p.memberIDsSelect.Where(sq.Eq{"PlaybookID": id}))
	if err != nil && err != sql.ErrNoRows {
		return app.Playbook{}, errors.Wrapf(err, "failed to get memberIDs for playbook with id '%s'", id)
	}

	if err = tx.Commit(); err != nil {
		return app.Playbook{}, errors.Wrap(err, "could not commit transaction")
	}

	for _, m := range memberIDs {
		playbook.MemberIDs = append(playbook.MemberIDs, m.MemberID)
	}

	return playbook, nil
}

// GetPlaybooks retrieves all playbooks that are not deleted.
func (p *playbookStore) GetPlaybooks() ([]app.Playbook, error) {
	tx, err := p.store.db.Beginx()
	if err != nil {
		return nil, errors.Wrap(err, "could not begin transaction")
	}
	defer p.store.finalizeTransaction(tx)

	var playbooks []app.Playbook
	err = p.store.selectBuilder(tx, &playbooks, p.store.builder.
		Select(
			"p.ID",
			"p.Title",
			"p.Description",
			"p.TeamID",
			"p.CreatePublicIncident AS CreatePublicPlaybookRun",
			"p.CreateAt",
			"p.DeleteAt",
			"p.NumStages",
			"p.NumSteps",
			"COUNT(i.ID) AS NumRuns",
			"COALESCE(MAX(i.CreateAt), 0) AS LastRunAt",
			`(
				CASE WHEN p.InviteUsersEnabled THEN 1 ELSE 0 END +
				CASE WHEN p.DefaultCommanderEnabled THEN 1 ELSE 0 END +
				CASE WHEN p.AnnouncementChannelEnabled THEN 1 ELSE 0 END +
				CASE WHEN p.WebhookOnCreationEnabled THEN 1 ELSE 0 END +
				CASE WHEN p.MessageOnJoinEnabled THEN 1 ELSE 0 END +
				CASE WHEN p.WebhookOnStatusUpdateEnabled THEN 1 ELSE 0 END +
				CASE WHEN p.SignalAnyKeywordsEnabled THEN 1 ELSE 0 END
			) AS NumActions`,
		).
		From("IR_Playbook AS p").
		LeftJoin("IR_Incident AS i ON p.ID = i.PlaybookID").
		Where(sq.Eq{"p.DeleteAt": 0}).
		GroupBy("p.ID"))

	if err == sql.ErrNoRows {
		return nil, errors.Wrap(app.ErrNotFound, "no playbooks found")
	} else if err != nil {
		return nil, errors.Wrap(err, "failed to get playbooks")
	}

	var memberIDs playbookMembers
	err = p.store.selectBuilder(tx, &memberIDs, p.memberIDsSelect)
	if err != nil && err != sql.ErrNoRows {
		return nil, errors.Wrapf(err, "failed to get memberIDs")
	}

	if err = tx.Commit(); err != nil {
		return nil, errors.Wrap(err, "could not commit transaction")
	}

	addMembersToPlaybooks(memberIDs, playbooks)

	return playbooks, nil
}

// GetPlaybooksForTeam retrieves all playbooks on the specified team given the provided options.
func (p *playbookStore) GetPlaybooksForTeam(requesterInfo app.RequesterInfo, teamID string, opts app.PlaybookFilterOptions) (app.GetPlaybooksResults, error) {
	// Check that you are a playbook member or there are no restrictions.
	permissionsAndFilter := sq.Expr(`(
			EXISTS(SELECT 1
					FROM IR_PlaybookMember as pm
					WHERE pm.PlaybookID = p.ID
					AND pm.MemberID = ?)
			OR NOT EXISTS(SELECT 1
					FROM IR_PlaybookMember as pm
					WHERE pm.PlaybookID = p.ID)
		)`, requesterInfo.UserID)

	queryForResults := p.store.builder.
		Select(
			"p.ID",
			"p.Title",
			"p.Description",
			"p.TeamID",
			"p.CreatePublicIncident AS CreatePublicPlaybookRun",
			"p.CreateAt",
			"p.DeleteAt",
			"p.NumStages",
			"p.NumSteps",
			"COUNT(i.ID) AS NumRuns",
			"COALESCE(MAX(i.CreateAt), 0) AS LastRunAt",
			`(
				CASE WHEN p.InviteUsersEnabled THEN 1 ELSE 0 END +
				CASE WHEN p.DefaultCommanderEnabled THEN 1 ELSE 0 END +
				CASE WHEN p.AnnouncementChannelEnabled THEN 1 ELSE 0 END +
				CASE WHEN p.WebhookOnCreationEnabled THEN 1 ELSE 0 END +
				CASE WHEN p.MessageOnJoinEnabled THEN 1 ELSE 0 END +
				CASE WHEN p.WebhookOnStatusUpdateEnabled THEN 1 ELSE 0 END +
				CASE WHEN p.SignalAnyKeywordsEnabled THEN 1 ELSE 0 END
			) AS NumActions`,
		).
		From("IR_Playbook AS p").
		LeftJoin("IR_Incident AS i ON p.ID = i.PlaybookID").
		GroupBy("p.ID").
		Where(sq.Eq{"p.DeleteAt": 0}).
		Where(sq.Eq{"p.TeamID": teamID}).
		Where(permissionsAndFilter)

	queryForResults, err := applyPlaybookFilterOptionsSort(queryForResults, opts)
	if err != nil {
		return app.GetPlaybooksResults{}, errors.Wrap(err, "failed to apply sort options")
	}

	var playbooks []app.Playbook
	err = p.store.selectBuilder(p.store.db, &playbooks, queryForResults)
	if err == sql.ErrNoRows {
		return app.GetPlaybooksResults{}, errors.Wrap(app.ErrNotFound, "no playbooks found")
	} else if err != nil {
		return app.GetPlaybooksResults{}, errors.Wrap(err, "failed to get playbooks")
	}

	queryForTotal := p.store.builder.
		Select("COUNT(*)").
		From("IR_Playbook AS p").
		Where(sq.Eq{"DeleteAt": 0}).
		Where(sq.Eq{"TeamID": teamID}).
		Where(permissionsAndFilter)

	var total int
	if err = p.store.getBuilder(p.store.db, &total, queryForTotal); err != nil {
		return app.GetPlaybooksResults{}, errors.Wrap(err, "failed to get total count")
	}

	pageCount := 0
	if opts.PerPage > 0 {
		pageCount = int(math.Ceil(float64(total) / float64(opts.PerPage)))
	}
	hasMore := opts.Page+1 < pageCount

	return app.GetPlaybooksResults{
		TotalCount: total,
		PageCount:  pageCount,
		HasMore:    hasMore,
		Items:      playbooks,
	}, nil
}

func (p *playbookStore) GetNumPlaybooksForTeam(teamID string) (int, error) {
	query := p.store.builder.
		Select("COUNT(*)").
		From("IR_Playbook").
		Where(sq.Eq{"DeleteAt": 0}).
		Where(sq.Eq{"TeamID": teamID})

	var total int
	if err := p.store.getBuilder(p.store.db, &total, query); err != nil {
		return 0, errors.Wrap(err, "failed to get number of playbooks")
	}

	return total, nil
}

// GetPlaybooksWithKeywords retrieves all playbooks with keywords enabled
func (p *playbookStore) GetPlaybooksWithKeywords(opts app.PlaybookFilterOptions) ([]app.Playbook, error) {
	queryForResults := p.store.builder.
		Select("ID", "Title", "UpdateAt", "TeamID", "ConcatenatedSignalAnyKeywords").
		From("IR_Playbook AS p").
		Where(sq.Eq{"DeleteAt": 0}).
		Where(sq.Eq{"SignalAnyKeywordsEnabled": true}).
		Offset(uint64(opts.Page * opts.PerPage)).
		Limit(uint64(opts.PerPage))

	var rawPlaybooks []sqlPlaybook
	err := p.store.selectBuilder(p.store.db, &rawPlaybooks, queryForResults)
	if err == sql.ErrNoRows {
		return []app.Playbook{}, nil
	} else if err != nil {
		return []app.Playbook{}, errors.Wrap(err, "failed to get playbooks")
	}

	playbooks := make([]app.Playbook, 0, len(rawPlaybooks))
	for _, playbook := range rawPlaybooks {
		out, err := toPlaybook(playbook)
		if err != nil {
			return nil, errors.Wrapf(err, "can't convert raw playbook to playbook type")
		}
		playbooks = append(playbooks, out)
	}
	return playbooks, nil
}

// GetTimeLastUpdated retrieves time last playbook was updated at.
// Passed argument determins whether to include playbooks with
// SignalAnyKeywordsEnabled flag or not.
func (p *playbookStore) GetTimeLastUpdated(onlyPlaybooksWithKeywordsEnabled bool) (int64, error) {
	queryForResults := p.store.builder.
		Select("COALESCE(MAX(UpdateAt), 0)").
		From("IR_Playbook AS p").
		Where(sq.Eq{"DeleteAt": 0})
	if onlyPlaybooksWithKeywordsEnabled {
		queryForResults = queryForResults.Where(sq.Eq{"SignalAnyKeywordsEnabled": true})
	}

	var updateAt []int64
	err := p.store.selectBuilder(p.store.db, &updateAt, queryForResults)
	if err == sql.ErrNoRows {
		return 0, nil
	} else if err != nil {
		return 0, errors.Wrap(err, "failed to get playbooks")
	}
	return updateAt[0], nil
}

// GetPlaybookIDsForUser retrieves playbooks user can access
// Notice that method is not checking weather or not user is member of a team
func (p *playbookStore) GetPlaybookIDsForUser(userID string, teamID string) ([]string, error) {
	// Check that you are a playbook member or there are no restrictions.
	permissionsAndFilter := sq.Expr(`(
		EXISTS(SELECT 1
				FROM IR_PlaybookMember as pm
				WHERE pm.PlaybookID = p.ID
				AND pm.MemberID = ?)
		OR NOT EXISTS(SELECT 1
				FROM IR_PlaybookMember as pm
				WHERE pm.PlaybookID = p.ID)
	)`, userID)

	queryForResults := p.store.builder.
		Select("ID").
		From("IR_Playbook AS p").
		Where(sq.Eq{"DeleteAt": 0}).
		Where(sq.Eq{"TeamID": teamID}).
		Where(permissionsAndFilter)

	var playbookIDs []string

	err := p.store.selectBuilder(p.store.db, &playbookIDs, queryForResults)
	if err != nil && err != sql.ErrNoRows {
		return nil, errors.Wrapf(err, "failed to get playbookIDs for a user - %v", userID)
	}
	return playbookIDs, nil
}

// Update updates a playbook
func (p *playbookStore) Update(playbook app.Playbook) (err error) {
	if playbook.ID == "" {
		return errors.New("id should not be empty")
	}

	rawPlaybook, err := toSQLPlaybook(playbook)
	if err != nil {
		return err
	}

	tx, err := p.store.db.Beginx()
	if err != nil {
		return errors.Wrap(err, "could not begin transaction")
	}
	defer p.store.finalizeTransaction(tx)

	_, err = p.store.execBuilder(tx, sq.
		Update("IR_Playbook").
		SetMap(map[string]interface{}{
			"Title":                                rawPlaybook.Title,
			"Description":                          rawPlaybook.Description,
			"TeamID":                               rawPlaybook.TeamID,
			"CreatePublicIncident":                 rawPlaybook.CreatePublicPlaybookRun,
			"UpdateAt":                             rawPlaybook.UpdateAt,
			"DeleteAt":                             rawPlaybook.DeleteAt,
			"ChecklistsJSON":                       rawPlaybook.ChecklistsJSON,
			"NumStages":                            len(rawPlaybook.Checklists),
			"NumSteps":                             getSteps(rawPlaybook.Playbook),
			"BroadcastChannelID":                   rawPlaybook.BroadcastChannelID,
			"ReminderMessageTemplate":              rawPlaybook.ReminderMessageTemplate,
			"ReminderTimerDefaultSeconds":          rawPlaybook.ReminderTimerDefaultSeconds,
			"ConcatenatedInvitedUserIDs":           rawPlaybook.ConcatenatedInvitedUserIDs,
			"ConcatenatedInvitedGroupIDs":          rawPlaybook.ConcatenatedInvitedGroupIDs,
			"InviteUsersEnabled":                   rawPlaybook.InviteUsersEnabled,
			"DefaultCommanderID":                   rawPlaybook.DefaultOwnerID,
			"DefaultCommanderEnabled":              rawPlaybook.DefaultOwnerEnabled,
			"AnnouncementChannelID":                rawPlaybook.AnnouncementChannelID,
			"AnnouncementChannelEnabled":           rawPlaybook.AnnouncementChannelEnabled,
			"WebhookOnCreationURL":                 rawPlaybook.WebhookOnCreationURL,
			"WebhookOnCreationEnabled":             rawPlaybook.WebhookOnCreationEnabled,
			"MessageOnJoin":                        rawPlaybook.MessageOnJoin,
			"MessageOnJoinEnabled":                 rawPlaybook.MessageOnJoinEnabled,
			"RetrospectiveReminderIntervalSeconds": rawPlaybook.RetrospectiveReminderIntervalSeconds,
			"RetrospectiveTemplate":                rawPlaybook.RetrospectiveTemplate,
			"WebhookOnStatusUpdateURL":             rawPlaybook.WebhookOnStatusUpdateURL,
			"WebhookOnStatusUpdateEnabled":         rawPlaybook.WebhookOnStatusUpdateEnabled,
			"ExportChannelOnArchiveEnabled":        rawPlaybook.ExportChannelOnArchiveEnabled,
			"ConcatenatedSignalAnyKeywords":        rawPlaybook.ConcatenatedSignalAnyKeywords,
			"SignalAnyKeywordsEnabled":             rawPlaybook.SignalAnyKeywordsEnabled,
			"CategorizeChannelEnabled":             rawPlaybook.CategorizeChannelEnabled,
		}).
		Where(sq.Eq{"ID": rawPlaybook.ID}))

	if err != nil {
		return errors.Wrapf(err, "failed to update playbook with id '%s'", rawPlaybook.ID)
	}

	if err = p.replacePlaybookMembers(tx, rawPlaybook.Playbook); err != nil {
		return errors.Wrapf(err, "failed to replace playbook members for playbook with id '%s'", rawPlaybook.ID)
	}

	if err = tx.Commit(); err != nil {
		return errors.Wrap(err, "could not commit transaction")
	}

	return nil
}

// Delete deletes a playbook.
func (p *playbookStore) Delete(id string) error {
	if id == "" {
		return errors.New("ID cannot be empty")
	}

	_, err := p.store.execBuilder(p.store.db, sq.
		Update("IR_Playbook").
		Set("DeleteAt", model.GetMillis()).
		Where(sq.Eq{"ID": id}))

	if err != nil {
		return errors.Wrapf(err, "failed to delete playbook with id '%s'", id)
	}

	return nil
}

// replacePlaybookMembers replaces the members of a playbook
func (p *playbookStore) replacePlaybookMembers(q queryExecer, playbook app.Playbook) error {
	// Delete existing members who are not in the new playbook.MemberIDs list
	delBuilder := sq.Delete("IR_PlaybookMember").
		Where(sq.Eq{"PlaybookID": playbook.ID}).
		Where(sq.NotEq{"MemberID": playbook.MemberIDs})
	if _, err := p.store.execBuilder(q, delBuilder); err != nil {
		return err
	}

	if len(playbook.MemberIDs) == 0 {
		return nil
	}

	insertExpr := `
INSERT INTO IR_PlaybookMember(PlaybookID, MemberID)
    SELECT ?, ?
    WHERE NOT EXISTS (
        SELECT 1 FROM IR_PlaybookMember
            WHERE PlaybookID = ? AND MemberID = ?
    );`
	if p.store.db.DriverName() == model.DATABASE_DRIVER_MYSQL {
		insertExpr = `
INSERT INTO IR_PlaybookMember(PlaybookID, MemberID)
    SELECT ?, ? FROM DUAL
    WHERE NOT EXISTS (
        SELECT 1 FROM IR_PlaybookMember
            WHERE PlaybookID = ? AND MemberID = ?
    );`
	}

	for _, m := range playbook.MemberIDs {
		rawInsert := sq.Expr(insertExpr,
			playbook.ID, m, playbook.ID, m)

		if _, err := p.store.execBuilder(q, rawInsert); err != nil {
			return err
		}
	}

	return nil
}

func addMembersToPlaybooks(memberIDs playbookMembers, playbook []app.Playbook) {
	pToM := make(map[string][]string)
	for _, m := range memberIDs {
		pToM[m.PlaybookID] = append(pToM[m.PlaybookID], m.MemberID)
	}
	for i, p := range playbook {
		playbook[i].MemberIDs = pToM[p.ID]
	}
}

func getSteps(playbook app.Playbook) int {
	steps := 0
	for _, p := range playbook.Checklists {
		steps += len(p.Items)
	}

	return steps
}

func toSQLPlaybook(playbook app.Playbook) (*sqlPlaybook, error) {
	checklistsJSON, err := json.Marshal(playbook.Checklists)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to marshal checklist json for playbook id: '%s'", playbook.ID)
	}

	return &sqlPlaybook{
		Playbook:                      playbook,
		ChecklistsJSON:                checklistsJSON,
		ConcatenatedInvitedUserIDs:    strings.Join(playbook.InvitedUserIDs, ","),
		ConcatenatedInvitedGroupIDs:   strings.Join(playbook.InvitedGroupIDs, ","),
		ConcatenatedSignalAnyKeywords: strings.Join(playbook.SignalAnyKeywords, ","),
	}, nil
}

func toPlaybook(rawPlaybook sqlPlaybook) (app.Playbook, error) {
	p := rawPlaybook.Playbook
	if len(rawPlaybook.ChecklistsJSON) > 0 {
		if err := json.Unmarshal(rawPlaybook.ChecklistsJSON, &p.Checklists); err != nil {
			return app.Playbook{}, errors.Wrapf(err, "failed to unmarshal checklists json for playbook id: '%s'", p.ID)
		}
	}

	p.InvitedUserIDs = []string(nil)
	if rawPlaybook.ConcatenatedInvitedUserIDs != "" {
		p.InvitedUserIDs = strings.Split(rawPlaybook.ConcatenatedInvitedUserIDs, ",")
	}

	p.InvitedGroupIDs = []string(nil)
	if rawPlaybook.ConcatenatedInvitedGroupIDs != "" {
		p.InvitedGroupIDs = strings.Split(rawPlaybook.ConcatenatedInvitedGroupIDs, ",")
	}

	p.SignalAnyKeywords = []string(nil)
	if rawPlaybook.ConcatenatedSignalAnyKeywords != "" {
		p.SignalAnyKeywords = strings.Split(rawPlaybook.ConcatenatedSignalAnyKeywords, ",")
	}
	return p, nil
}
