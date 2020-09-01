package sqlstore

import (
	"database/sql"
	"fmt"
	"sort"
	"testing"

	"github.com/golang/mock/gomock"
	"github.com/jmoiron/sqlx"
	mock_bot "github.com/mattermost/mattermost-plugin-incident-response/server/bot/mocks"
	"github.com/mattermost/mattermost-plugin-incident-response/server/incident"
	"github.com/mattermost/mattermost-plugin-incident-response/server/playbook"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/plugin/plugintest"
	"github.com/mattermost/mattermost-server/v5/store/storetest"
	"github.com/pkg/errors"

	pluginapi "github.com/mattermost/mattermost-plugin-api"

	sq "github.com/Masterminds/squirrel"
	"github.com/stretchr/testify/require"
)

var (
	team1id = model.NewId()
	team2id = model.NewId()
	team3id = model.NewId()

	commander1 = incident.CommanderInfo{
		UserID:   model.NewId(),
		Username: "Commander 1",
	}
	commander2 = incident.CommanderInfo{
		UserID:   model.NewId(),
		Username: "Commander 2",
	}
	commander3 = incident.CommanderInfo{
		UserID:   model.NewId(),
		Username: "Commander 3",
	}
	commander4 = incident.CommanderInfo{
		UserID:   model.NewId(),
		Username: "Commander 4",
	}

	commanders = []incident.CommanderInfo{commander1, commander2, commander3, commander4}

	channelID01 = model.NewId()
	channelID02 = model.NewId()
	channelID03 = model.NewId()
	channelID04 = model.NewId()
	channelID05 = model.NewId()
	channelID06 = model.NewId()
	channelID07 = model.NewId()

	inc01 = *NewBuilder().
		WithName("incident 1 - wheel cat aliens wheelbarrow").
		WithChannelID(channelID01).
		WithIsActive(true).
		WithCommanderUserID(commander1.UserID).
		WithTeamID(team1id).
		WithCreateAt(123).
		WithEndAt(440).
		ToIncident()

	inc02 = *NewBuilder().
		WithName("incident 2 - horse staple battery shotgun mouse shotputmouse").
		WithChannelID(channelID02).
		WithIsActive(true).
		WithCommanderUserID(commander2.UserID).
		WithTeamID(team1id).
		WithCreateAt(145).
		WithEndAt(555).
		ToIncident()

	inc03 = *NewBuilder().
		WithName("incident 3 - Horse stapler battery shotgun mouse shotputmouse").
		WithChannelID(channelID03).
		WithIsActive(false).
		WithCommanderUserID(commander1.UserID).
		WithTeamID(team1id).
		WithCreateAt(222).
		WithEndAt(666).
		ToIncident()

	inc04 = *NewBuilder().
		WithName("incident 4 - titanic terminator aliens").
		WithChannelID(channelID04).
		WithIsActive(false).
		WithCommanderUserID(commander3.UserID).
		WithTeamID(team2id).
		WithCreateAt(333).
		WithEndAt(444).
		ToIncident()

	inc05 = *NewBuilder().
		WithName("incident 5 - ubik high castle electric sheep").
		WithChannelID(channelID05).
		WithIsActive(true).
		WithCommanderUserID(commander3.UserID).
		WithTeamID(team2id).
		WithCreateAt(223).
		WithEndAt(550).
		ToIncident()

	inc06 = *NewBuilder().
		WithName("incident 6 - ziggurat!").
		WithChannelID(channelID06).
		WithIsActive(true).
		WithCommanderUserID(commander4.UserID).
		WithTeamID(team3id).
		WithCreateAt(555).
		WithEndAt(777).
		ToIncident()

	inc07 = *NewBuilder().
		WithName("incident 7 - Ziggürat!").
		WithChannelID(channelID07).
		WithIsActive(true).
		WithCommanderUserID(commander4.UserID).
		WithTeamID(team3id).
		WithCreateAt(556).
		WithEndAt(778).
		ToIncident()

	incidents = []incident.Incident{inc01, inc02, inc03, inc04, inc05, inc06, inc07}
)

func TestGetIncidents(t *testing.T) {
	createIncidents := func(store incident.Store) {
		t.Helper()

		createdIncidents := make([]incident.Incident, len(incidents))

		for i := range incidents {
			createdIncident, err := store.CreateIncident(&incidents[i])
			require.NoError(t, err)

			createdIncidents[i] = *createdIncident
		}
	}

	testData := []struct {
		Name        string
		Options     incident.HeaderFilterOptions
		Want        incident.GetIncidentsResults
		ExpectedErr error
	}{
		{
			Name:    "no options",
			Options: incident.HeaderFilterOptions{},
			Want: incident.GetIncidentsResults{
				TotalCount: 7,
				PageCount:  1,
				HasMore:    false,
				Items:      []incident.Incident{inc07, inc06, inc04, inc05, inc03, inc02, inc01},
			},
			ExpectedErr: nil,
		},
		{
			Name: "team1 only, ascending",
			Options: incident.HeaderFilterOptions{
				TeamID: team1id,
				Order:  "asc",
			},
			Want: incident.GetIncidentsResults{
				TotalCount: 3,
				PageCount:  1,
				HasMore:    false,
				Items:      []incident.Incident{inc01, inc02, inc03},
			},
			ExpectedErr: nil,
		},

		{
			Name: "no paging, sort by CreateAt",
			Options: incident.HeaderFilterOptions{
				Sort: incident.SortByCreateAt,
			},
			Want: incident.GetIncidentsResults{
				TotalCount: 7,
				PageCount:  1,
				HasMore:    false,
				Items:      []incident.Incident{inc07, inc06, inc04, inc05, inc03, inc02, inc01},
			},
			ExpectedErr: nil,
		},
		{
			Name: "no paging, sort by Name",
			Options: incident.HeaderFilterOptions{
				Sort: incident.SortByName,
			},
			Want: incident.GetIncidentsResults{
				TotalCount: 7,
				PageCount:  1,
				HasMore:    false,
				Items:      []incident.Incident{inc07, inc06, inc05, inc04, inc03, inc02, inc01},
			},
			ExpectedErr: nil,
		},
		{
			Name: "no paging, sort by EndAt",
			Options: incident.HeaderFilterOptions{
				Sort: incident.SortByEndAt,
			},
			Want: incident.GetIncidentsResults{
				TotalCount: 7,
				PageCount:  1,
				HasMore:    false,
				Items:      []incident.Incident{inc07, inc06, inc03, inc02, inc05, inc04, inc01},
			},
			ExpectedErr: nil,
		},
		{
			Name: "no options, paged by 1",
			Options: incident.HeaderFilterOptions{
				Page:    0,
				PerPage: 1,
			},
			Want: incident.GetIncidentsResults{
				TotalCount: 7,
				PageCount:  7,
				HasMore:    true,
				Items:      []incident.Incident{inc07},
			},
			ExpectedErr: nil,
		},
		{
			Name: "no options, paged by 3",
			Options: incident.HeaderFilterOptions{
				Page:    0,
				PerPage: 3,
			},
			Want: incident.GetIncidentsResults{
				TotalCount: 7,
				PageCount:  3,
				HasMore:    true,
				Items:      []incident.Incident{inc07, inc06, inc04},
			},
			ExpectedErr: nil,
		},
		{
			Name: "no options, page 4 by 2",
			Options: incident.HeaderFilterOptions{
				Page:    4,
				PerPage: 2,
			},
			Want: incident.GetIncidentsResults{
				TotalCount: 7,
				PageCount:  4,
				HasMore:    false,
				Items:      nil,
			},
			ExpectedErr: nil,
		},
		{
			Name: "no options, page 999 by 2",
			Options: incident.HeaderFilterOptions{
				Page:    999,
				PerPage: 2,
			},
			Want: incident.GetIncidentsResults{
				TotalCount: 7,
				PageCount:  4,
				HasMore:    false,
				Items:      nil,
			},
			ExpectedErr: nil,
		},
		{
			Name: "no options, page 1 by 2",
			Options: incident.HeaderFilterOptions{
				Page:    1,
				PerPage: 2,
			},
			Want: incident.GetIncidentsResults{
				TotalCount: 7,
				PageCount:  4,
				HasMore:    true,
				Items:      []incident.Incident{inc04, inc05},
			},
			ExpectedErr: nil,
		},
		{
			Name: "no options, page 1 by 3",
			Options: incident.HeaderFilterOptions{
				Page:    1,
				PerPage: 3,
			},
			Want: incident.GetIncidentsResults{
				TotalCount: 7,
				PageCount:  3,
				HasMore:    true,
				Items:      []incident.Incident{inc05, inc03, inc02},
			},
			ExpectedErr: nil,
		},
		{
			Name: "no options, page 1 by 5",
			Options: incident.HeaderFilterOptions{
				Page:    1,
				PerPage: 5,
			},
			Want: incident.GetIncidentsResults{
				TotalCount: 7,
				PageCount:  2,
				HasMore:    false,
				Items:      []incident.Incident{inc02, inc01},
			},
			ExpectedErr: nil,
		},
		{
			Name: "sorted by ended, ascending, page 1 by 2",
			Options: incident.HeaderFilterOptions{
				Sort:    "end_at",
				Order:   "asc",
				Page:    1,
				PerPage: 2,
			},
			Want: incident.GetIncidentsResults{
				TotalCount: 7,
				PageCount:  4,
				HasMore:    true,
				Items:      []incident.Incident{inc05, inc02},
			},
			ExpectedErr: nil,
		},
		{
			Name: "only active, page 1 by 2",
			Options: incident.HeaderFilterOptions{
				Page:    1,
				PerPage: 2,
				Status:  incident.Ongoing,
			},
			Want: incident.GetIncidentsResults{
				TotalCount: 5,
				PageCount:  3,
				HasMore:    true,
				Items:      []incident.Incident{inc05, inc02},
			},
			ExpectedErr: nil,
		},
		{
			Name: "active, commander3, asc",
			Options: incident.HeaderFilterOptions{
				Status:      incident.Ongoing,
				CommanderID: commander3.UserID,
				Order:       "asc",
			},
			Want: incident.GetIncidentsResults{
				TotalCount: 1,
				PageCount:  1,
				HasMore:    false,
				Items:      []incident.Incident{inc05},
			},
			ExpectedErr: nil,
		},
		{
			Name: "commander1, asc, by end_at",
			Options: incident.HeaderFilterOptions{
				CommanderID: commander1.UserID,
				Order:       "asc",
				Sort:        "end_at",
			},
			Want: incident.GetIncidentsResults{
				TotalCount: 2,
				PageCount:  1,
				HasMore:    false,
				Items:      []incident.Incident{inc01, inc03},
			},
			ExpectedErr: nil,
		},
		{
			Name: "search for horse",
			Options: incident.HeaderFilterOptions{
				SearchTerm: "horse",
			},
			Want: incident.GetIncidentsResults{
				TotalCount: 2,
				PageCount:  1,
				HasMore:    false,
				Items:      []incident.Incident{inc03, inc02},
			},
			ExpectedErr: nil,
		},
		{
			Name: "search for aliens & commander3",
			Options: incident.HeaderFilterOptions{
				CommanderID: commander3.UserID,
				SearchTerm:  "aliens",
			},
			Want: incident.GetIncidentsResults{
				TotalCount: 1,
				PageCount:  1,
				HasMore:    false,
				Items:      []incident.Incident{inc04},
			},
			ExpectedErr: nil,
		},
		{
			Name: "fuzzy search using starting characters -- not implemented",
			Options: incident.HeaderFilterOptions{
				SearchTerm: "sbsm",
			},
			Want: incident.GetIncidentsResults{
				TotalCount: 0,
				PageCount:  0,
				HasMore:    false,
				Items:      nil,
			},
			ExpectedErr: nil,
		},
		{
			Name: "fuzzy search using starting characters, active -- not implemented",
			Options: incident.HeaderFilterOptions{
				SearchTerm: "sbsm",
				Status:     incident.Ongoing,
			},
			Want: incident.GetIncidentsResults{
				TotalCount: 0,
				PageCount:  0,
				HasMore:    false,
				Items:      nil,
			},
			ExpectedErr: nil,
		},
		{
			Name: "case-insensitive and unicode-normalized",
			Options: incident.HeaderFilterOptions{
				SearchTerm: "ziggurat",
			},
			Want: incident.GetIncidentsResults{
				TotalCount: 2,
				PageCount:  1,
				HasMore:    false,
				Items:      []incident.Incident{inc07, inc06},
			},
			ExpectedErr: nil,
		},
		{
			Name: "case-insensitive and unicode-normalized with unicode search term",
			Options: incident.HeaderFilterOptions{
				SearchTerm: "ziggūràt",
			},
			Want: incident.GetIncidentsResults{
				TotalCount: 2,
				PageCount:  1,
				HasMore:    false,
				Items:      []incident.Incident{inc07, inc06},
			},
			ExpectedErr: nil,
		},
		{
			Name: "bad parameter sort",
			Options: incident.HeaderFilterOptions{
				Sort: "unknown_field",
			},
			Want:        incident.GetIncidentsResults{},
			ExpectedErr: errors.New("bad parameter 'sort'"),
		},
		{
			Name: "bad team id",
			Options: incident.HeaderFilterOptions{
				TeamID: "invalid ID",
			},
			Want:        incident.GetIncidentsResults{},
			ExpectedErr: errors.New("bad parameter 'team_id': must be 26 characters or blank"),
		},
		{
			Name: "bad parameter order by",
			Options: incident.HeaderFilterOptions{
				Order: "invalid order",
			},
			Want:        incident.GetIncidentsResults{},
			ExpectedErr: errors.New("bad parameter 'order_by'"),
		},
		{
			Name: "bad commander id",
			Options: incident.HeaderFilterOptions{
				CommanderID: "invalid ID",
			},
			Want:        incident.GetIncidentsResults{},
			ExpectedErr: errors.New("bad parameter 'commander_id': must be 26 characters or blank"),
		},
	}

	for _, driverName := range driverNames {
		db := setupTestDB(t, driverName)
		incidentStore := setupIncidentStore(t, db)

		t.Run("zero incidents", func(t *testing.T) {
			result, err := incidentStore.GetIncidents(incident.HeaderFilterOptions{
				Page:    0,
				PerPage: 10,
			})
			require.NoError(t, err)

			require.Equal(t, 0, result.TotalCount)
			require.Equal(t, 0, result.PageCount)
			require.False(t, result.HasMore)
			require.Nil(t, result.Items)
		})

		createIncidents(incidentStore)

		for _, test := range testData {
			t.Run(driverName+" - "+test.Name, func(t *testing.T) {
				result, err := incidentStore.GetIncidents(test.Options)

				if test.ExpectedErr != nil {
					require.Nil(t, result)
					require.Error(t, err)
					require.Equal(t, test.ExpectedErr.Error(), err.Error())

					return
				}

				require.NoError(t, err)

				for i, item := range result.Items {
					require.True(t, model.IsValidId(item.ID))
					item.ID = ""
					result.Items[i] = item
				}
				require.Equal(t, test.Want, *result)
			})
		}
	}
}

func TestCreateIncident(t *testing.T) {
	for _, driverName := range driverNames {
		db := setupTestDB(t, driverName)
		incidentStore := setupIncidentStore(t, db)

		validIncidents := []struct {
			Name        string
			Incident    *incident.Incident
			ExpectedErr error
		}{
			{
				Name:        "Empty values",
				Incident:    &incident.Incident{},
				ExpectedErr: nil,
			},
			{
				Name:        "Base incident",
				Incident:    NewBuilder().ToIncident(),
				ExpectedErr: nil,
			},
			{
				Name:        "Name with unicode characters",
				Incident:    NewBuilder().WithName("valid unicode: ñäåö").ToIncident(),
				ExpectedErr: nil,
			},
			{
				Name:        "Created at 0",
				Incident:    NewBuilder().WithCreateAt(0).ToIncident(),
				ExpectedErr: nil,
			},
			{
				Name:        "Deleted incident",
				Incident:    NewBuilder().WithDeleteAt(model.GetMillis()).ToIncident(),
				ExpectedErr: nil,
			},
			{
				Name:        "Ended incident",
				Incident:    NewBuilder().WithEndAt(model.GetMillis()).ToIncident(),
				ExpectedErr: nil,
			},
			{
				Name:        "Inactive incident",
				Incident:    NewBuilder().WithIsActive(false).ToIncident(),
				ExpectedErr: nil,
			},
			{
				Name:        "Incident with one checklist and 10 items",
				Incident:    NewBuilder().WithChecklists([]int{10}).ToIncident(),
				ExpectedErr: nil,
			},
			{
				Name:        "Incident with five checklists with different number of items",
				Incident:    NewBuilder().WithChecklists([]int{1, 2, 3, 4, 5}).ToIncident(),
				ExpectedErr: nil,
			},
			{
				Name:        "Incident should not be nil",
				Incident:    nil,
				ExpectedErr: errors.New("incident is nil"),
			},
			{
				Name:        "Incident should not have ID set",
				Incident:    NewBuilder().WithID().ToIncident(),
				ExpectedErr: errors.New("ID should not be set"),
			},
			{
				Name:        "Incident should not contain checklists with no items",
				Incident:    NewBuilder().WithChecklists([]int{0}).ToIncident(),
				ExpectedErr: errors.New("checklists with no items are not allowed"),
			},
		}

		for _, test := range validIncidents {
			t.Run(test.Name, func(t *testing.T) {
				var expectedIncident incident.Incident
				if test.Incident != nil {
					expectedIncident = *test.Incident
				}

				actualIncident, err := incidentStore.CreateIncident(test.Incident)

				if test.ExpectedErr != nil {
					require.Error(t, err)
					require.Equal(t, test.ExpectedErr.Error(), err.Error())
					require.Nil(t, actualIncident)
					return
				}

				require.NoError(t, err)
				require.True(t, model.IsValidId(actualIncident.ID))

				expectedIncident.ID = actualIncident.ID

				require.Equal(t, &expectedIncident, actualIncident)
			})
		}
	}
}

func TestUpdateIncident(t *testing.T)             {}
func TestGetIncident(t *testing.T)                {}
func TestGetIncidentIDForChannel(t *testing.T)    {}
func TestGetAllIncidentMembersCount(t *testing.T) {}

func TestGetCommanders(t *testing.T) {
	alwaysTrue := func(s string) bool { return true }
	alwaysFalse := func(s string) bool { return false }

	sortCommanders := func(commanders []incident.CommanderInfo) {
		sort.Slice(commanders, func(i, j int) bool { return commanders[i].Username < commanders[j].Username })
	}

	cases := []struct {
		Name        string
		Options     incident.HeaderFilterOptions
		Expected    []incident.CommanderInfo
		ExpectedErr error
	}{
		{
			Name: "permissions to all - team 1",
			Options: incident.HeaderFilterOptions{
				TeamID:           team1id,
				HasPermissionsTo: alwaysTrue,
			},
			Expected:    []incident.CommanderInfo{commander1, commander2},
			ExpectedErr: nil,
		},
		{
			Name: "permissions to all - team 2",
			Options: incident.HeaderFilterOptions{
				TeamID:           team2id,
				HasPermissionsTo: alwaysTrue,
			},
			Expected:    []incident.CommanderInfo{commander3},
			ExpectedErr: nil,
		},
		{
			Name: "permissions to all - team 3",
			Options: incident.HeaderFilterOptions{
				TeamID:           team3id,
				HasPermissionsTo: alwaysTrue,
			},
			Expected:    []incident.CommanderInfo{commander4},
			ExpectedErr: nil,
		},
		{
			Name: "permissions to none - team 1",
			Options: incident.HeaderFilterOptions{
				TeamID:           team1id,
				HasPermissionsTo: alwaysFalse,
			},
			Expected:    nil,
			ExpectedErr: nil,
		},
		{
			Name: "permissions to none - team 2",
			Options: incident.HeaderFilterOptions{
				TeamID:           team2id,
				HasPermissionsTo: alwaysFalse,
			},
			Expected:    nil,
			ExpectedErr: nil,
		},
		{
			Name: "permissions to none - team 3",
			Options: incident.HeaderFilterOptions{
				TeamID:           team3id,
				HasPermissionsTo: alwaysFalse,
			},
			Expected:    nil,
			ExpectedErr: nil,
		},
		{
			Name: "nil permissions - team 1",
			Options: incident.HeaderFilterOptions{
				TeamID: team1id,
			},
			Expected:    nil,
			ExpectedErr: nil,
		},
		{
			Name: "nil permissions - team 2",
			Options: incident.HeaderFilterOptions{
				TeamID: team2id,
			},
			Expected:    nil,
			ExpectedErr: nil,
		},
		{
			Name: "nil permissions - team 3",
			Options: incident.HeaderFilterOptions{
				TeamID: team3id,
			},
			Expected:    nil,
			ExpectedErr: nil,
		},
		{
			Name: "permissions to some - team 1",
			Options: incident.HeaderFilterOptions{
				TeamID: team1id,
				HasPermissionsTo: func(channelID string) bool {
					return channelID == channelID01
				},
			},
			Expected:    []incident.CommanderInfo{commander1},
			ExpectedErr: nil,
		},
		{
			Name:        "no team",
			Options:     incident.HeaderFilterOptions{},
			Expected:    nil,
			ExpectedErr: errors.New("team ID should not be empty"),
		},
	}

	for _, driverName := range driverNames {
		db := setupTestDB(t, driverName)
		setupServerSchema(t, db)

		incidentStore := setupIncidentStore(t, db)

		queryBuilder := sq.StatementBuilder.PlaceholderFormat(sq.Question)
		if driverName == model.DATABASE_DRIVER_POSTGRES {
			queryBuilder = queryBuilder.PlaceholderFormat(sq.Dollar)
		}

		insertCommander := queryBuilder.Insert("Users").Columns("ID", "Username")
		for _, commander := range commanders {
			insertCommander = insertCommander.Values(commander.UserID, commander.Username)
		}

		query, args, err := insertCommander.ToSql()
		require.NoError(t, err)
		_, err = db.Exec(query, args...)
		require.NoError(t, err)

		for i := range incidents {
			_, err := incidentStore.CreateIncident(&incidents[i])
			require.NoError(t, err)
		}

		for _, test := range cases {
			t.Run(test.Name, func(t *testing.T) {
				actual, actualErr := incidentStore.GetCommanders(test.Options)

				if test.ExpectedErr != nil {
					require.NotNil(t, actualErr)
					require.Equal(t, test.ExpectedErr.Error(), actualErr.Error())
					require.Nil(t, actual)
					return
				}

				require.NoError(t, actualErr)

				sortCommanders(test.Expected)
				sortCommanders(actual)
				require.Equal(t, test.Expected, actual)
			})
		}
	}
}

func TestNukeDB(t *testing.T) {}

var driverNames = []string{model.DATABASE_DRIVER_POSTGRES, model.DATABASE_DRIVER_MYSQL}

func setupTestDB(t *testing.T, driverName string) *sqlx.DB {
	t.Helper()

	sqlSettings := storetest.MakeSqlSettings(driverName)

	origDB, err := sql.Open(*sqlSettings.DriverName, *sqlSettings.DataSource)
	require.NoError(t, err)

	db := sqlx.NewDb(origDB, driverName)
	if driverName == model.DATABASE_DRIVER_MYSQL {
		db.MapperFunc(func(s string) string { return s })
	}

	t.Cleanup(func() {
		err := db.Close()
		require.NoError(t, err)
		storetest.CleanupSqlSettings(sqlSettings)
	})

	return db
}

func setupServerSchema(t *testing.T, db *sqlx.DB) {
	t.Helper()

	// Statements copied from mattermost-server/scripts/mattermost-postgresql-5.0.sql
	if db.DriverName() == model.DATABASE_DRIVER_POSTGRES {
		_, err := db.Exec(`
			CREATE TABLE IF NOT EXISTS public.users (
				id character varying(26) NOT NULL,
				createat bigint,
				updateat bigint,
				deleteat bigint,
				username character varying(64),
				password character varying(128),
				authdata character varying(128),
				authservice character varying(32),
				email character varying(128),
				emailverified boolean,
				nickname character varying(64),
				firstname character varying(64),
				lastname character varying(64),
				"position" character varying(128),
				roles character varying(256),
				allowmarketing boolean,
				props character varying(4000),
				notifyprops character varying(2000),
				lastpasswordupdate bigint,
				lastpictureupdate bigint,
				failedattempts integer,
				locale character varying(5),
				timezone character varying(256),
				mfaactive boolean,
				mfasecret character varying(128)
			);
		`)
		require.NoError(t, err)

		_, err = db.Exec(`
			CREATE TABLE IF NOT EXISTS public.channelmemberhistory (
				channelid character varying(26) NOT NULL,
				userid character varying(26) NOT NULL,
				jointime bigint NOT NULL,
				leavetime bigint
			);
		`)
		require.NoError(t, err)

		return
	}

	// Statements copied from mattermost-server/scripts/mattermost-mysql-5.0.sql
	_, err := db.Exec(`
			CREATE TABLE IF NOT EXISTS Users (
				Id varchar(26) NOT NULL,
				CreateAt bigint(20) DEFAULT NULL,
				UpdateAt bigint(20) DEFAULT NULL,
				DeleteAt bigint(20) DEFAULT NULL,
				Username varchar(64) DEFAULT NULL,
				Password varchar(128) DEFAULT NULL,
				AuthData varchar(128) DEFAULT NULL,
				AuthService varchar(32) DEFAULT NULL,
				Email varchar(128) DEFAULT NULL,
				EmailVerified tinyint(1) DEFAULT NULL,
				Nickname varchar(64) DEFAULT NULL,
				FirstName varchar(64) DEFAULT NULL,
				LastName varchar(64) DEFAULT NULL,
				Position varchar(128) DEFAULT NULL,
				Roles text,
				AllowMarketing tinyint(1) DEFAULT NULL,
				Props text,
				NotifyProps text,
				LastPasswordUpdate bigint(20) DEFAULT NULL,
				LastPictureUpdate bigint(20) DEFAULT NULL,
				FailedAttempts int(11) DEFAULT NULL,
				Locale varchar(5) DEFAULT NULL,
				Timezone text,
				MfaActive tinyint(1) DEFAULT NULL,
				MfaSecret varchar(128) DEFAULT NULL,
				PRIMARY KEY (Id),
				UNIQUE KEY Username (Username),
				UNIQUE KEY AuthData (AuthData),
				UNIQUE KEY Email (Email),
				KEY idx_users_email (Email),
				KEY idx_users_update_at (UpdateAt),
				KEY idx_users_create_at (CreateAt),
				KEY idx_users_delete_at (DeleteAt),
				FULLTEXT KEY idx_users_all_txt (Username,FirstName,LastName,Nickname,Email),
				FULLTEXT KEY idx_users_all_no_full_name_txt (Username,Nickname,Email),
				FULLTEXT KEY idx_users_names_txt (Username,FirstName,LastName,Nickname),
				FULLTEXT KEY idx_users_names_no_full_name_txt (Username,Nickname)
			) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
		`)
	require.NoError(t, err)

	_, err = db.Exec(`
			CREATE TABLE IF NOT EXISTS ChannelMemberHistory (
				ChannelId varchar(26) NOT NULL,
				UserId varchar(26) NOT NULL,
				JoinTime bigint(20) NOT NULL,
				LeaveTime bigint(20) DEFAULT NULL,
				PRIMARY KEY (ChannelId,UserId,JoinTime)
			) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
		`)
	require.NoError(t, err)
}

func setupIncidentStore(t *testing.T, db *sqlx.DB) incident.Store {
	mockCtrl := gomock.NewController(t)

	logger := mock_bot.NewMockLogger(mockCtrl)

	pluginAPI := &plugintest.API{}
	client := pluginapi.NewClient(pluginAPI)
	driverName := db.DriverName()
	pluginAPI.On("GetConfig").Return(&model.Config{
		SqlSettings: model.SqlSettings{DriverName: &driverName},
	})

	builder := sq.StatementBuilder.PlaceholderFormat(sq.Question)
	if driverName == model.DATABASE_DRIVER_POSTGRES {
		builder = builder.PlaceholderFormat(sq.Dollar)
	}

	sqlStore := &SQLStore{
		logger,
		db,
		builder,
	}

	err := migrations[0].migrationFunc(db)
	require.NoError(t, err)

	return NewIncidentStore(NewClient(client), logger, sqlStore)
}

// IncidentBuilder is a utility to build incidents with a default base.
// Use it as:
// NewBuilder.WithName("name").WithXYZ(xyz)....ToIncident()
type IncidentBuilder struct {
	*incident.Incident
}

func NewBuilder() *IncidentBuilder {
	return &IncidentBuilder{
		&incident.Incident{
			Header: incident.Header{
				Name:            "base incident",
				IsActive:        true,
				CommanderUserID: model.NewId(),
				TeamID:          model.NewId(),
				ChannelID:       model.NewId(),
				CreateAt:        model.GetMillis(),
				EndAt:           0,
				DeleteAt:        0,
				ActiveStage:     0,
			},
			PostID:     model.NewId(),
			PlaybookID: model.NewId(),
			Checklists: []playbook.Checklist{},
		},
	}
}

func (t *IncidentBuilder) WithName(name string) *IncidentBuilder {
	t.Name = name

	return t
}

func (t *IncidentBuilder) WithID() *IncidentBuilder {
	t.ID = model.NewId()

	return t
}

func (t *IncidentBuilder) ToIncident() *incident.Incident {
	return t.Incident
}

func (t *IncidentBuilder) WithCreateAt(createAt int64) *IncidentBuilder {
	t.CreateAt = createAt

	return t
}

func (t *IncidentBuilder) WithEndAt(endAt int64) *IncidentBuilder {
	t.EndAt = endAt

	return t
}

func (t *IncidentBuilder) WithDeleteAt(deleteAt int64) *IncidentBuilder {
	t.DeleteAt = deleteAt

	return t
}

func (t *IncidentBuilder) WithChecklists(itemsPerChecklist []int) *IncidentBuilder {
	t.Checklists = make([]playbook.Checklist, len(itemsPerChecklist))

	for i, numItems := range itemsPerChecklist {
		items := make([]playbook.ChecklistItem, numItems)
		for j := 0; j < numItems; j++ {
			items[j] = playbook.ChecklistItem{
				ID:    model.NewId(),
				Title: fmt.Sprint("Checklist ", i, " - item ", j),
			}
		}

		t.Checklists[i] = playbook.Checklist{
			ID:    model.NewId(),
			Title: fmt.Sprint("Checklist ", i),
			Items: items,
		}
	}

	return t
}

func (t *IncidentBuilder) WithCommanderUserID(id string) *IncidentBuilder {
	t.CommanderUserID = id

	return t
}

func (t *IncidentBuilder) WithTeamID(id string) *IncidentBuilder {
	t.TeamID = id

	return t
}

func (t *IncidentBuilder) WithIsActive(isActive bool) *IncidentBuilder {
	t.IsActive = isActive

	return t
}

func (t *IncidentBuilder) WithChannelID(id string) *IncidentBuilder {
	t.ChannelID = id

	return t
}
