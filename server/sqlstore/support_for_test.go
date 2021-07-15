package sqlstore

import (
	"database/sql"
	"testing"

	sq "github.com/Masterminds/squirrel"
	"github.com/golang/mock/gomock"
	"github.com/jmoiron/sqlx"
	"github.com/mattermost/mattermost-plugin-incident-collaboration/server/app"
	"github.com/mattermost/mattermost-plugin-incident-collaboration/server/bot"
	mock_bot "github.com/mattermost/mattermost-plugin-incident-collaboration/server/bot/mocks"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/store/storetest"
	"github.com/stretchr/testify/require"
)

var driverNames = []string{model.DATABASE_DRIVER_POSTGRES, model.DATABASE_DRIVER_MYSQL}

func setupTestDB(t testing.TB, driverName string) *sqlx.DB {
	t.Helper()

	sqlSettings := storetest.MakeSqlSettings(driverName, false)

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

func setupSQLStore(t *testing.T, db *sqlx.DB) (bot.Logger, *SQLStore) {
	t.Helper()

	mockCtrl := gomock.NewController(t)
	logger := mock_bot.NewMockLogger(mockCtrl)

	driverName := db.DriverName()

	builder := sq.StatementBuilder.PlaceholderFormat(sq.Question)
	if driverName == model.DATABASE_DRIVER_POSTGRES {
		builder = builder.PlaceholderFormat(sq.Dollar)
	}

	sqlStore := &SQLStore{
		logger,
		db,
		builder,
	}

	logger.EXPECT().Debugf(gomock.AssignableToTypeOf("string")).Times(2)

	currentSchemaVersion, err := sqlStore.GetCurrentVersion()
	require.NoError(t, err)

	setupChannelsTable(t, db)
	setupPostsTable(t, db)
	setupBotsTable(t, db)
	setupChannelMembersTable(t, db)

	if currentSchemaVersion.LT(LatestVersion()) {
		err = sqlStore.Migrate(currentSchemaVersion)
		require.NoError(t, err)
	}

	return logger, sqlStore
}

func setupUsersTable(t *testing.T, db *sqlx.DB) {
	t.Helper()

	// Statements copied from mattermost-server/scripts/mattermost-postgresql-5.0.sql
	// NOTE: for this and the other tables below, this is a now out-of-date schema, which doesn't
	//       reflect any of the changes past v5.0. If the test code requires a new column, you will
	//       need to update these tables accordingly.
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
}

func setupChannelMemberHistoryTable(t *testing.T, db *sqlx.DB) {
	t.Helper()

	// Statements copied from mattermost-server/scripts/mattermost-postgresql-5.0.sql
	if db.DriverName() == model.DATABASE_DRIVER_POSTGRES {
		_, err := db.Exec(`
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

func setupTeamMembersTable(t *testing.T, db *sqlx.DB) {
	t.Helper()

	// Statements copied from mattermost-server/scripts/mattermost-postgresql-5.0.sql
	if db.DriverName() == model.DATABASE_DRIVER_POSTGRES {
		_, err := db.Exec(`
			CREATE TABLE IF NOT EXISTS public.teammembers (
				teamid character varying(26) NOT NULL,
				userid character varying(26) NOT NULL,
				roles character varying(64),
				deleteat bigint,
				schemeuser boolean,
				schemeadmin boolean
			);
		`)
		require.NoError(t, err)

		return
	}

	// Statements copied from mattermost-server/scripts/mattermost-mysql-5.0.sql
	_, err := db.Exec(`
			CREATE TABLE IF NOT EXISTS TeamMembers (
			  TeamId varchar(26) NOT NULL,
			  UserId varchar(26) NOT NULL,
			  Roles varchar(64) DEFAULT NULL,
			  DeleteAt bigint(20) DEFAULT NULL,
			  SchemeUser tinyint(4) DEFAULT NULL,
			  SchemeAdmin tinyint(4) DEFAULT NULL,
			  PRIMARY KEY (TeamId,UserId),
			  KEY idx_teammembers_team_id (TeamId),
			  KEY idx_teammembers_user_id (UserId),
			  KEY idx_teammembers_delete_at (DeleteAt)
			) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
		`)
	require.NoError(t, err)
}

func setupChannelMembersTable(t *testing.T, db *sqlx.DB) {
	t.Helper()

	// Statements copied from mattermost-server/scripts/mattermost-postgresql-5.0.sql
	if db.DriverName() == model.DATABASE_DRIVER_POSTGRES {
		_, err := db.Exec(`
			CREATE TABLE IF NOT EXISTS public.channelmembers (
				channelid character varying(26) NOT NULL,
				userid character varying(26) NOT NULL,
				roles character varying(64),
				lastviewedat bigint,
				msgcount bigint,
				mentioncount bigint,
				notifyprops character varying(2000),
				lastupdateat bigint,
				schemeuser boolean,
				schemeadmin boolean
			);
		`)
		require.NoError(t, err)

		return
	}

	// Statements copied from mattermost-server/scripts/mattermost-mysql-5.0.sql
	_, err := db.Exec(`
			CREATE TABLE IF NOT EXISTS ChannelMembers (
			  ChannelId varchar(26) NOT NULL,
			  UserId varchar(26) NOT NULL,
			  Roles varchar(64) DEFAULT NULL,
			  LastViewedAt bigint(20) DEFAULT NULL,
			  MsgCount bigint(20) DEFAULT NULL,
			  MentionCount bigint(20) DEFAULT NULL,
			  NotifyProps text,
			  LastUpdateAt bigint(20) DEFAULT NULL,
			  SchemeUser tinyint(4) DEFAULT NULL,
			  SchemeAdmin tinyint(4) DEFAULT NULL,
			  PRIMARY KEY (ChannelId,UserId),
			  KEY idx_channelmembers_channel_id (ChannelId),
			  KEY idx_channelmembers_user_id (UserId)
			) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
		`)
	require.NoError(t, err)
}

func setupChannelsTable(t *testing.T, db *sqlx.DB) {
	t.Helper()

	// Statements copied from mattermost-server/scripts/mattermost-postgresql-5.0.sql
	if db.DriverName() == model.DATABASE_DRIVER_POSTGRES {
		_, err := db.Exec(`
			CREATE TABLE IF NOT EXISTS public.channels (
				id character varying(26) NOT NULL,
				createat bigint,
				updateat bigint,
				deleteat bigint,
				teamid character varying(26),
				type character varying(1),
				displayname character varying(64),
				name character varying(64),
				header character varying(1024),
				purpose character varying(250),
				lastpostat bigint,
				totalmsgcount bigint,
				extraupdateat bigint,
				creatorid character varying(26),
				schemeid character varying(26)
			);
		`)
		require.NoError(t, err)

		return
	}

	// Statements copied from mattermost-server/scripts/mattermost-mysql-5.0.sql
	_, err := db.Exec(`
			CREATE TABLE IF NOT EXISTS Channels (
			  Id varchar(26) NOT NULL,
			  CreateAt bigint(20) DEFAULT NULL,
			  UpdateAt bigint(20) DEFAULT NULL,
			  DeleteAt bigint(20) DEFAULT NULL,
			  TeamId varchar(26) DEFAULT NULL,
			  Type varchar(1) DEFAULT NULL,
			  DisplayName varchar(64) DEFAULT NULL,
			  Name varchar(64) DEFAULT NULL,
			  Header text,
			  Purpose varchar(250) DEFAULT NULL,
			  LastPostAt bigint(20) DEFAULT NULL,
			  TotalMsgCount bigint(20) DEFAULT NULL,
			  ExtraUpdateAt bigint(20) DEFAULT NULL,
			  CreatorId varchar(26) DEFAULT NULL,
			  SchemeId varchar(26) DEFAULT NULL,
			  PRIMARY KEY (Id),
			  UNIQUE KEY Name (Name,TeamId),
			  KEY idx_channels_team_id (TeamId),
			  KEY idx_channels_name (Name),
			  KEY idx_channels_update_at (UpdateAt),
			  KEY idx_channels_create_at (CreateAt),
			  KEY idx_channels_delete_at (DeleteAt),
			  FULLTEXT KEY idx_channels_txt (Name,DisplayName)
			) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
		`)
	require.NoError(t, err)
}

func setupPostsTable(t testing.TB, db *sqlx.DB) {
	t.Helper()

	// Statements copied from mattermost-server/scripts/mattermost-postgresql-5.0.sql
	if db.DriverName() == model.DATABASE_DRIVER_POSTGRES {
		_, err := db.Exec(`
			CREATE TABLE IF NOT EXISTS public.posts (
				id character varying(26) NOT NULL,
				createat bigint,
				updateat bigint,
				editat bigint,
				deleteat bigint,
				ispinned boolean,
				userid character varying(26),
				channelid character varying(26),
				rootid character varying(26),
				parentid character varying(26),
				originalid character varying(26),
				message character varying(65535),
				type character varying(26),
				props character varying(8000),
				hashtags character varying(1000),
				filenames character varying(4000),
				fileids character varying(150),
				hasreactions boolean
			);
		`)
		require.NoError(t, err)

		return
	}

	// Statements copied from mattermost-server/scripts/mattermost-mysql-5.0.sql
	_, err := db.Exec(`
			CREATE TABLE IF NOT EXISTS Posts (
			  Id varchar(26) NOT NULL,
			  CreateAt bigint(20) DEFAULT NULL,
			  UpdateAt bigint(20) DEFAULT NULL,
			  EditAt bigint(20) DEFAULT NULL,
			  DeleteAt bigint(20) DEFAULT NULL,
			  IsPinned tinyint(1) DEFAULT NULL,
			  UserId varchar(26) DEFAULT NULL,
			  ChannelId varchar(26) DEFAULT NULL,
			  RootId varchar(26) DEFAULT NULL,
			  ParentId varchar(26) DEFAULT NULL,
			  OriginalId varchar(26) DEFAULT NULL,
			  Message text,
			  Type varchar(26) DEFAULT NULL,
			  Props text,
			  Hashtags text,
			  Filenames text,
			  FileIds varchar(150) DEFAULT NULL,
			  HasReactions tinyint(1) DEFAULT NULL,
			  PRIMARY KEY (Id),
			  KEY idx_posts_update_at (UpdateAt),
			  KEY idx_posts_create_at (CreateAt),
			  KEY idx_posts_delete_at (DeleteAt),
			  KEY idx_posts_channel_id (ChannelId),
			  KEY idx_posts_root_id (RootId),
			  KEY idx_posts_user_id (UserId),
			  KEY idx_posts_is_pinned (IsPinned),
			  KEY idx_posts_channel_id_update_at (ChannelId,UpdateAt),
			  KEY idx_posts_channel_id_delete_at_create_at (ChannelId,DeleteAt,CreateAt),
			  FULLTEXT KEY idx_posts_message_txt (Message),
			  FULLTEXT KEY idx_posts_hashtags_txt (Hashtags)
			) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
		`)
	require.NoError(t, err)
}

func setupBotsTable(t testing.TB, db *sqlx.DB) {
	t.Helper()

	// This is completely handmade
	if db.DriverName() == model.DATABASE_DRIVER_POSTGRES {
		_, err := db.Exec(`
			CREATE TABLE IF NOT EXISTS public.bots (
				userid character varying(26) NOT NULL,
				description character varying(1024),
			    ownerid character varying(190)
			);
		`)
		require.NoError(t, err)

		return
	}

	// handmade
	_, err := db.Exec(`
			CREATE TABLE IF NOT EXISTS bots (
				userid varchar(26) NOT NULL,
				description varchar(1024),
			    ownerid varchar(190)
			) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
		`)
	require.NoError(t, err)
}

type userInfo struct {
	ID   string
	Name string
}

func addUsers(t *testing.T, store *SQLStore, users []userInfo) {
	t.Helper()

	insertBuilder := store.builder.Insert("Users").Columns("ID", "Username")

	for _, u := range users {
		insertBuilder = insertBuilder.Values(u.ID, u.Name)
	}

	_, err := store.execBuilder(store.db, insertBuilder)
	require.NoError(t, err)
}

func addUsersToTeam(t *testing.T, store *SQLStore, users []userInfo, teamID string) {
	t.Helper()

	insertBuilder := store.builder.Insert("TeamMembers").Columns("TeamId", "UserId")

	for _, u := range users {
		insertBuilder = insertBuilder.Values(teamID, u.ID)
	}

	_, err := store.execBuilder(store.db, insertBuilder)
	require.NoError(t, err)
}

func addUsersToChannels(t *testing.T, store *SQLStore, users []userInfo, channelIDs []string) {
	t.Helper()

	insertBuilder := store.builder.Insert("ChannelMembers").Columns("ChannelId", "UserId")

	for _, u := range users {
		for _, c := range channelIDs {
			insertBuilder = insertBuilder.Values(c, u.ID)
		}
	}

	_, err := store.execBuilder(store.db, insertBuilder)
	require.NoError(t, err)
}

func createChannels(t testing.TB, store *SQLStore, channels []model.Channel) {
	t.Helper()

	insertBuilder := store.builder.Insert("Channels").Columns("Id", "DisplayName", "Type", "CreateAt", "DeleteAt")

	for _, channel := range channels {
		insertBuilder = insertBuilder.Values(channel.Id, channel.DisplayName, channel.Type, channel.CreateAt, channel.DeleteAt)
	}

	_, err := store.execBuilder(store.db, insertBuilder)
	require.NoError(t, err)
}

func createPlaybookRunChannel(t testing.TB, store *SQLStore, playbookRun *app.PlaybookRun) {
	t.Helper()

	if playbookRun.CreateAt == 0 {
		playbookRun.CreateAt = model.GetMillis()
	}

	insertBuilder := store.builder.Insert("Channels").Columns("Id", "DisplayName", "CreateAt", "DeleteAt").Values(playbookRun.ChannelID, playbookRun.Name, playbookRun.CreateAt, 0)

	_, err := store.execBuilder(store.db, insertBuilder)
	require.NoError(t, err)
}

func makeAdmin(t *testing.T, store *SQLStore, user userInfo) {
	t.Helper()

	updateBuilder := store.builder.
		Update("Users").
		Where(sq.Eq{"Id": user.ID}).
		Set("Roles", "role1 role2 system_admin role3")

	_, err := store.execBuilder(store.db, updateBuilder)
	require.NoError(t, err)
}

func savePosts(t testing.TB, store *SQLStore, posts []*model.Post) {
	t.Helper()

	insertBuilder := store.builder.Insert("Posts").Columns("Id", "CreateAt", "DeleteAt")

	for _, p := range posts {
		insertBuilder = insertBuilder.Values(p.Id, p.CreateAt, p.DeleteAt)
	}

	_, err := store.execBuilder(store.db, insertBuilder)
	require.NoError(t, err)
}
