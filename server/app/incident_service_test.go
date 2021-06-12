package app_test

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/golang/mock/gomock"
	"github.com/mattermost/mattermost-plugin-incident-collaboration/server/app"
	"github.com/mattermost/mattermost-plugin-incident-collaboration/server/config"
	"github.com/mattermost/mattermost-plugin-incident-collaboration/server/telemetry"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/plugin/plugintest"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	mock_app "github.com/mattermost/mattermost-plugin-incident-collaboration/server/app/mocks"
	mock_bot "github.com/mattermost/mattermost-plugin-incident-collaboration/server/bot/mocks"
	mock_config "github.com/mattermost/mattermost-plugin-incident-collaboration/server/config/mocks"

	pluginapi "github.com/mattermost/mattermost-plugin-api"
)

func TestCreateIncident(t *testing.T) {
	t.Run("invalid channel name has only invalid characters", func(t *testing.T) {
		controller := gomock.NewController(t)
		pluginAPI := &plugintest.API{}
		client := pluginapi.NewClient(pluginAPI)
		store := mock_app.NewMockIncidentStore(controller)
		poster := mock_bot.NewMockPoster(controller)
		logger := mock_bot.NewMockLogger(controller)
		configService := mock_config.NewMockService(controller)
		telemetryService := &telemetry.NoopTelemetry{}
		scheduler := mock_app.NewMockJobOnceScheduler(controller)

		teamID := model.NewId()
		incdnt := &app.Incident{
			Name:   "###",
			TeamID: teamID,
		}

		store.EXPECT().CreateIncident(gomock.Any()).Return(incdnt, nil)
		pluginAPI.On("CreateChannel", mock.Anything).Return(nil, &model.AppError{Id: "model.channel.is_valid.display_name.app_error"})
		pluginAPI.On("GetTeam", teamID).Return(&model.Team{Id: teamID, Name: "ad-1"}, nil)
		mattermostConfig := &model.Config{}
		mattermostConfig.SetDefaults()
		pluginAPI.On("GetConfig").Return(mattermostConfig)

		s := app.NewIncidentService(client, store, poster, logger, configService, scheduler, telemetryService)

		_, err := s.CreateIncident(incdnt, nil, "testUserID", true)
		require.Equal(t, err, app.ErrChannelDisplayNameInvalid)
	})

	t.Run("invalid channel name has only invalid characters", func(t *testing.T) {
		controller := gomock.NewController(t)
		pluginAPI := &plugintest.API{}
		client := pluginapi.NewClient(pluginAPI)
		store := mock_app.NewMockIncidentStore(controller)
		poster := mock_bot.NewMockPoster(controller)
		logger := mock_bot.NewMockLogger(controller)
		configService := mock_config.NewMockService(controller)
		telemetryService := &telemetry.NoopTelemetry{}
		scheduler := mock_app.NewMockJobOnceScheduler(controller)

		teamID := model.NewId()
		incdnt := &app.Incident{
			Name:   "###",
			TeamID: teamID,
		}

		store.EXPECT().CreateIncident(gomock.Any()).Return(incdnt, nil)
		pluginAPI.On("GetTeam", teamID).Return(&model.Team{Id: teamID, Name: "ad-1"}, nil)
		mattermostConfig := &model.Config{}
		mattermostConfig.SetDefaults()
		pluginAPI.On("GetConfig").Return(mattermostConfig)
		pluginAPI.On("CreateChannel", mock.Anything).Return(nil, &model.AppError{Id: "model.channel.is_valid.2_or_more.app_error"})

		s := app.NewIncidentService(client, store, poster, logger, configService, scheduler, telemetryService)

		_, err := s.CreateIncident(incdnt, nil, "testUserID", true)
		require.Equal(t, err, app.ErrChannelDisplayNameInvalid)
	})

	t.Run("channel name already exists, fixed on second try", func(t *testing.T) {
		controller := gomock.NewController(t)
		pluginAPI := &plugintest.API{}
		client := pluginapi.NewClient(pluginAPI)
		store := mock_app.NewMockIncidentStore(controller)
		poster := mock_bot.NewMockPoster(controller)
		logger := mock_bot.NewMockLogger(controller)
		configService := mock_config.NewMockService(controller)
		telemetryService := &telemetry.NoopTelemetry{}
		scheduler := mock_app.NewMockJobOnceScheduler(controller)

		teamID := model.NewId()
		incdnt := &app.Incident{
			Name:        "###",
			TeamID:      teamID,
			OwnerUserID: "user_id",
		}

		store.EXPECT().CreateIncident(gomock.Any()).Return(incdnt, nil)
		store.EXPECT().CreateTimelineEvent(gomock.AssignableToTypeOf(&app.TimelineEvent{}))
		pluginAPI.On("CreateChannel", &model.Channel{
			TeamId:      teamID,
			Type:        model.CHANNEL_PRIVATE,
			DisplayName: "###",
			Name:        "",
			Header:      "The channel was created by the Incident Collaboration plugin.",
		}).Return(nil, &model.AppError{Id: "store.sql_channel.save_channel.exists.app_error"})
		mattermostConfig := &model.Config{}
		mattermostConfig.SetDefaults()
		pluginAPI.On("GetConfig").Return(mattermostConfig)
		pluginAPI.On("GetTeam", teamID).Return(&model.Team{Id: teamID, Name: "ad-1"}, nil)
		pluginAPI.On("CreateChannel", mock.Anything).Return(&model.Channel{Id: "channel_id", TeamId: "team_id"}, nil)
		pluginAPI.On("AddUserToChannel", "channel_id", "user_id", "bot_user_id").Return(nil, nil)
		pluginAPI.On("CreateTeamMember", "team_id", "bot_user_id").Return(nil, nil)
		pluginAPI.On("AddChannelMember", "channel_id", "bot_user_id").Return(nil, nil)
		pluginAPI.On("UpdateChannelMemberRoles", "channel_id", "user_id", fmt.Sprintf("%s %s", model.CHANNEL_ADMIN_ROLE_ID, model.CHANNEL_USER_ROLE_ID)).Return(nil, nil)
		configService.EXPECT().GetConfiguration().Return(&config.Configuration{BotUserID: "bot_user_id"}).AnyTimes()
		store.EXPECT().UpdateIncident(gomock.Any()).Return(nil)
		poster.EXPECT().PublishWebsocketEventToChannel("incident_updated", gomock.Any(), "channel_id")
		pluginAPI.On("GetUser", "user_id").Return(&model.User{Id: "user_id", Username: "username"}, nil)
		poster.EXPECT().PostMessage("channel_id", "This incident has been started and is commanded by @username.").
			Return(&model.Post{Id: "testId"}, nil)

		s := app.NewIncidentService(client, store, poster, logger, configService, scheduler, telemetryService)

		_, err := s.CreateIncident(incdnt, nil, "user_id", true)
		require.NoError(t, err)
	})

	t.Run("channel name already exists, failed second try", func(t *testing.T) {
		controller := gomock.NewController(t)
		pluginAPI := &plugintest.API{}
		client := pluginapi.NewClient(pluginAPI)
		store := mock_app.NewMockIncidentStore(controller)
		poster := mock_bot.NewMockPoster(controller)
		logger := mock_bot.NewMockLogger(controller)
		configService := mock_config.NewMockService(controller)
		telemetryService := &telemetry.NoopTelemetry{}
		scheduler := mock_app.NewMockJobOnceScheduler(controller)

		teamID := model.NewId()
		incdnt := &app.Incident{
			Name:        "###",
			TeamID:      teamID,
			OwnerUserID: "user_id",
		}

		store.EXPECT().CreateIncident(gomock.Any()).Return(incdnt, nil)
		pluginAPI.On("GetTeam", teamID).Return(&model.Team{Id: teamID, Name: "ad-1"}, nil)
		mattermostConfig := &model.Config{}
		mattermostConfig.SetDefaults()
		pluginAPI.On("GetConfig").Return(mattermostConfig)
		pluginAPI.On("CreateChannel", mock.Anything).Return(nil, &model.AppError{Id: "store.sql_channel.save_channel.exists.app_error"})

		s := app.NewIncidentService(client, store, poster, logger, configService, scheduler, telemetryService)

		_, err := s.CreateIncident(incdnt, nil, "user_id", true)
		require.EqualError(t, err, "failed to create incident channel: : , ")
	})

	t.Run("channel admin fails promotion fails", func(t *testing.T) {
		controller := gomock.NewController(t)
		pluginAPI := &plugintest.API{}
		client := pluginapi.NewClient(pluginAPI)
		store := mock_app.NewMockIncidentStore(controller)
		poster := mock_bot.NewMockPoster(controller)
		logger := mock_bot.NewMockLogger(controller)
		configService := mock_config.NewMockService(controller)
		telemetryService := &telemetry.NoopTelemetry{}
		scheduler := mock_app.NewMockJobOnceScheduler(controller)

		teamID := model.NewId()
		incdnt := &app.Incident{
			Name:        "###",
			TeamID:      teamID,
			OwnerUserID: "user_id",
		}

		store.EXPECT().CreateIncident(gomock.Any()).Return(incdnt, nil)
		store.EXPECT().CreateTimelineEvent(gomock.AssignableToTypeOf(&app.TimelineEvent{}))
		mattermostConfig := &model.Config{}
		mattermostConfig.SetDefaults()
		pluginAPI.On("GetConfig").Return(mattermostConfig)
		pluginAPI.On("GetTeam", teamID).Return(&model.Team{Id: teamID, Name: "ad-1"}, nil)
		pluginAPI.On("CreateChannel", mock.Anything).Return(&model.Channel{Id: "channel_id", TeamId: "team_id"}, nil)
		pluginAPI.On("AddUserToChannel", "channel_id", "user_id", "bot_user_id").Return(nil, nil)
		pluginAPI.On("CreateTeamMember", "team_id", "bot_user_id").Return(nil, nil)
		pluginAPI.On("AddChannelMember", "channel_id", "bot_user_id").Return(nil, nil)
		pluginAPI.On("UpdateChannelMemberRoles", "channel_id", "user_id", fmt.Sprintf("%s %s", model.CHANNEL_ADMIN_ROLE_ID, model.CHANNEL_USER_ROLE_ID)).Return(nil, &model.AppError{Id: "api.channel.update_channel_member_roles.scheme_role.app_error"})
		pluginAPI.On("LogWarn", "failed to promote owner to admin", "ChannelID", "channel_id", "OwnerUserID", "user_id", "err", ": , ")
		configService.EXPECT().GetConfiguration().Return(&config.Configuration{BotUserID: "bot_user_id"}).AnyTimes()
		store.EXPECT().UpdateIncident(gomock.Any()).Return(nil)
		poster.EXPECT().PublishWebsocketEventToChannel("incident_updated", gomock.Any(), "channel_id")
		pluginAPI.On("GetUser", "user_id").Return(&model.User{Id: "user_id", Username: "username"}, nil)
		poster.EXPECT().PostMessage("channel_id", "This incident has been started and is commanded by @username.").
			Return(&model.Post{Id: "testid"}, nil)

		s := app.NewIncidentService(client, store, poster, logger, configService, scheduler, telemetryService)

		_, err := s.CreateIncident(incdnt, nil, "user_id", true)
		require.NoError(t, err)
	})

	t.Run("channel name has multibyte characters", func(t *testing.T) {
		controller := gomock.NewController(t)
		pluginAPI := &plugintest.API{}
		client := pluginapi.NewClient(pluginAPI)
		store := mock_app.NewMockIncidentStore(controller)
		poster := mock_bot.NewMockPoster(controller)
		logger := mock_bot.NewMockLogger(controller)
		configService := mock_config.NewMockService(controller)
		telemetryService := &telemetry.NoopTelemetry{}
		scheduler := mock_app.NewMockJobOnceScheduler(controller)

		teamID := model.NewId()
		incdnt := &app.Incident{
			Name:        "ททททท",
			TeamID:      teamID,
			OwnerUserID: "user_id",
		}

		store.EXPECT().CreateIncident(gomock.Any()).Return(incdnt, nil)
		store.EXPECT().CreateTimelineEvent(gomock.AssignableToTypeOf(&app.TimelineEvent{}))
		mattermostConfig := &model.Config{}
		mattermostConfig.SetDefaults()
		pluginAPI.On("GetConfig").Return(mattermostConfig)
		pluginAPI.On("GetTeam", teamID).Return(&model.Team{Id: teamID, Name: "ad-1"}, nil)
		pluginAPI.On("CreateChannel", mock.MatchedBy(func(channel *model.Channel) bool {
			return channel.Name != ""
		})).Return(&model.Channel{Id: "channel_id", TeamId: "team_id"}, nil)

		pluginAPI.On("AddUserToChannel", "channel_id", "user_id", "bot_user_id").Return(nil, nil)
		pluginAPI.On("CreateTeamMember", "team_id", "bot_user_id").Return(nil, nil)
		pluginAPI.On("AddChannelMember", "channel_id", "bot_user_id").Return(nil, nil)
		pluginAPI.On("UpdateChannelMemberRoles", "channel_id", "user_id", fmt.Sprintf("%s %s", model.CHANNEL_ADMIN_ROLE_ID, model.CHANNEL_USER_ROLE_ID)).Return(nil, nil)
		configService.EXPECT().GetConfiguration().Return(&config.Configuration{BotUserID: "bot_user_id"}).AnyTimes()
		store.EXPECT().UpdateIncident(gomock.Any()).Return(nil)
		poster.EXPECT().PublishWebsocketEventToChannel("incident_updated", gomock.Any(), "channel_id")
		pluginAPI.On("GetUser", "user_id").Return(&model.User{Id: "user_id", Username: "username"}, nil)
		poster.EXPECT().PostMessage("channel_id", "This incident has been started and is commanded by @username.").
			Return(&model.Post{Id: "testId"}, nil)

		s := app.NewIncidentService(client, store, poster, logger, configService, scheduler, telemetryService)

		_, err := s.CreateIncident(incdnt, nil, "user_id", true)
		pluginAPI.AssertExpectations(t)
		require.NoError(t, err)
	})

	t.Run("webhook is sent on incident create", func(t *testing.T) {
		controller := gomock.NewController(t)
		pluginAPI := &plugintest.API{}
		client := pluginapi.NewClient(pluginAPI)
		store := mock_app.NewMockIncidentStore(controller)
		poster := mock_bot.NewMockPoster(controller)
		logger := mock_bot.NewMockLogger(controller)
		configService := mock_config.NewMockService(controller)
		telemetryService := &telemetry.NoopTelemetry{}
		scheduler := mock_app.NewMockJobOnceScheduler(controller)

		type webhookPayload struct {
			app.Incident
			ChannelURL string `json:"channel_url"`
			DetailsURL string `json:"details_url"`
		}

		webhookChan := make(chan webhookPayload)

		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			body, err := ioutil.ReadAll(r.Body)
			require.NoError(t, err)

			var p webhookPayload
			err = json.Unmarshal(body, &p)
			require.NoError(t, err)

			webhookChan <- p
		}))

		teamID := model.NewId()
		incdnt := &app.Incident{
			ID:                   "incidentID",
			Name:                 "Incident Name",
			TeamID:               teamID,
			OwnerUserID:          "user_id",
			WebhookOnCreationURL: server.URL,
		}

		store.EXPECT().CreateIncident(gomock.Any()).Return(incdnt, nil)
		store.EXPECT().CreateTimelineEvent(gomock.AssignableToTypeOf(&app.TimelineEvent{}))
		store.EXPECT().UpdateIncident(gomock.Any()).Return(nil)

		configService.EXPECT().GetManifest().Return(&model.Manifest{Id: "com.mattermost.plugin-incident-management"}).Times(2)
		configService.EXPECT().GetConfiguration().Return(&config.Configuration{BotUserID: "bot_user_id"}).AnyTimes()

		poster.EXPECT().PublishWebsocketEventToChannel("incident_updated", gomock.Any(), "channel_id")
		poster.EXPECT().PostMessage("channel_id", gomock.Any()).Return(&model.Post{Id: "testId"}, nil)

		mattermostConfig := &model.Config{}
		mattermostConfig.SetDefaults()
		siteURL := "http://example.com"
		mattermostConfig.ServiceSettings.SiteURL = &siteURL
		pluginAPI.On("GetConfig").Return(mattermostConfig)
		pluginAPI.On("CreateChannel", mock.Anything).Return(&model.Channel{Id: "channel_id", TeamId: "team_id"}, nil)
		pluginAPI.On("AddUserToChannel", "channel_id", "user_id", "bot_user_id").Return(nil, nil)
		pluginAPI.On("UpdateChannelMemberRoles", "channel_id", "user_id", mock.Anything).Return(nil, nil)
		pluginAPI.On("CreateTeamMember", "team_id", "bot_user_id").Return(nil, nil)
		pluginAPI.On("AddChannelMember", "channel_id", "bot_user_id").Return(nil, nil)
		pluginAPI.On("GetUser", "user_id").Return(&model.User{Id: "user_id", Username: "username"}, nil)
		pluginAPI.On("GetTeam", teamID).Return(&model.Team{Id: teamID, Name: "ad-1"}, nil)
		pluginAPI.On("GetChannel", mock.Anything).Return(&model.Channel{Id: "channel_id", Name: "incident-channel-name"}, nil)

		s := app.NewIncidentService(client, store, poster, logger, configService, scheduler, telemetryService)

		createdIncident, err := s.CreateIncident(incdnt, nil, "user_id", true)
		require.NoError(t, err)

		select {
		case payload := <-webhookChan:
			require.Equal(t, *createdIncident, payload.Incident)
			require.Equal(t,
				"http://example.com/ad-1/channels/incident-channel-name",
				payload.ChannelURL)
			require.Equal(t,
				"http://example.com/ad-1/com.mattermost.plugin-incident-management/incidents/"+createdIncident.ID,
				payload.DetailsURL)

		case <-time.After(time.Second * 5):
			require.Fail(t, "did not receive webhook")
		}

		pluginAPI.AssertExpectations(t)
	})
}

func TestUpdateStatus(t *testing.T) {
	t.Run("webhook is sent on incident status update", func(t *testing.T) {
		controller := gomock.NewController(t)
		pluginAPI := &plugintest.API{}
		client := pluginapi.NewClient(pluginAPI)
		store := mock_app.NewMockIncidentStore(controller)
		poster := mock_bot.NewMockPoster(controller)
		logger := mock_bot.NewMockLogger(controller)
		configService := mock_config.NewMockService(controller)
		telemetryService := &telemetry.NoopTelemetry{}
		scheduler := mock_app.NewMockJobOnceScheduler(controller)

		type webhookPayload struct {
			app.Incident
			ChannelURL   string                  `json:"channel_url"`
			DetailsURL   string                  `json:"details_url"`
			StatusUpdate app.StatusUpdateOptions `json:"status_update"`
		}

		webhookChan := make(chan webhookPayload)

		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			body, err := ioutil.ReadAll(r.Body)
			require.NoError(t, err)

			var p webhookPayload
			err = json.Unmarshal(body, &p)
			require.NoError(t, err)

			webhookChan <- p
		}))

		teamID := model.NewId()
		incdnt := &app.Incident{
			ID:                       "incident_id",
			Name:                     "Incident Name",
			TeamID:                   teamID,
			ChannelID:                "channel_id",
			BroadcastChannelID:       "broadcast_channel_id",
			OwnerUserID:              "user_id",
			CurrentStatus:            app.StatusReported,
			CreateAt:                 1620018358404,
			WebhookOnStatusUpdateURL: server.URL,
		}
		statusUpdateOptions := app.StatusUpdateOptions{
			Status:      app.StatusActive,
			Description: "latest-description",
			Message:     "latest-message",
			Reminder:    0,
		}
		siteURL := "http://example.com"
		channelID := "channel_id"

		store.EXPECT().CreateTimelineEvent(gomock.AssignableToTypeOf(&app.TimelineEvent{}))
		store.EXPECT().UpdateIncident(gomock.AssignableToTypeOf(&app.Incident{})).Return(nil)
		store.EXPECT().UpdateStatus(gomock.AssignableToTypeOf(&app.SQLStatusPost{})).Return(nil)
		store.EXPECT().GetIncident(gomock.Any()).Return(incdnt, nil).Times(2)

		configService.EXPECT().GetManifest().Return(&model.Manifest{Id: "com.mattermost.plugin-incident-management"}).Times(2)

		poster.EXPECT().PublishWebsocketEventToChannel("incident_updated", gomock.Any(), channelID)
		poster.EXPECT().PostMessage("broadcast_channel_id", gomock.Any()).Return(&model.Post{}, nil)

		scheduler.EXPECT().Cancel(incdnt.ID)

		mattermostConfig := &model.Config{}
		mattermostConfig.SetDefaults()
		mattermostConfig.ServiceSettings.SiteURL = &siteURL
		pluginAPI.On("CreatePost", mock.Anything).Return(&model.Post{}, nil)
		pluginAPI.On("GetChannel", channelID).Return(&model.Channel{Id: channelID, Name: "channel_name"}, nil)
		pluginAPI.On("GetTeam", teamID).Return(&model.Team{Id: teamID, Name: "team_name"}, nil)
		pluginAPI.On("GetUser", "user_id").Return(&model.User{}, nil)
		pluginAPI.On("GetConfig").Return(&model.Config{ServiceSettings: model.ServiceSettings{SiteURL: &siteURL}})

		s := app.NewIncidentService(client, store, poster, logger, configService, scheduler, telemetryService)

		err := s.UpdateStatus(incdnt.ID, "user_id", statusUpdateOptions)
		require.NoError(t, err)

		select {
		case payload := <-webhookChan:
			require.Equal(t, *incdnt, payload.Incident)
			require.Equal(t,
				"http://example.com/team_name/channels/channel_name",
				payload.ChannelURL)
			require.Equal(t,
				"http://example.com/team_name/com.mattermost.plugin-incident-management/incidents/incident_id",
				payload.DetailsURL)

		case <-time.After(time.Second * 5):
			require.Fail(t, "did not receive webhook on status update")
		}
	})
}

func TestOpenCreateIncidentDialog(t *testing.T) {
	siteURL := "https://mattermost.example.com"

	type args struct {
		teamID      string
		ownerID     string
		triggerID   string
		postID      string
		clientID    string
		playbooks   []app.Playbook
		isMobileApp bool
	}
	tests := []struct {
		name      string
		args      args
		prepMocks func(t *testing.T, store *mock_app.MockIncidentStore, poster *mock_bot.MockPoster, api *plugintest.API, configService *mock_config.MockService)
		wantErr   bool
	}{
		{
			name: "successful webapp invocation without SiteURL",
			args: args{
				teamID:      "teamID",
				ownerID:     "ownerID",
				triggerID:   "triggerID",
				postID:      "postID",
				clientID:    "clientID",
				playbooks:   []app.Playbook{},
				isMobileApp: false,
			},
			prepMocks: func(t *testing.T, store *mock_app.MockIncidentStore, poster *mock_bot.MockPoster, api *plugintest.API, configService *mock_config.MockService) {
				api.On("GetTeam", "teamID").
					Return(&model.Team{Id: "teamID", Name: "Team"}, nil)
				api.On("GetUser", "ownerID").
					Return(&model.User{Id: "ownerID", Username: "User"}, nil)
				api.On("GetConfig").
					Return(&model.Config{ServiceSettings: model.ServiceSettings{SiteURL: model.NewString("")}})
				configService.EXPECT().GetManifest().Return(&model.Manifest{Id: "pluginId"}).Times(2)
				api.On("OpenInteractiveDialog", mock.AnythingOfType("model.OpenDialogRequest")).Return(nil).Run(func(args mock.Arguments) {
					dialogRequest := args.Get(0).(model.OpenDialogRequest)
					assert.NotContains(t, dialogRequest.Dialog.IntroductionText, "Create a playbook")
				})
			},
			wantErr: false,
		},
		{
			name: "successful webapp invocation",
			args: args{
				teamID:      "teamID",
				ownerID:     "ownerID",
				triggerID:   "triggerID",
				postID:      "postID",
				clientID:    "clientID",
				playbooks:   []app.Playbook{},
				isMobileApp: false,
			},
			prepMocks: func(t *testing.T, store *mock_app.MockIncidentStore, poster *mock_bot.MockPoster, api *plugintest.API, configService *mock_config.MockService) {
				api.On("GetTeam", "teamID").
					Return(&model.Team{Id: "teamID", Name: "Team"}, nil)
				api.On("GetUser", "ownerID").
					Return(&model.User{Id: "ownerID", Username: "User"}, nil)
				api.On("GetConfig").
					Return(&model.Config{
						ServiceSettings: model.ServiceSettings{
							SiteURL: &siteURL,
						},
					})
				configService.EXPECT().GetManifest().Return(&model.Manifest{Id: "pluginId"}).Times(2)
				api.On("OpenInteractiveDialog", mock.AnythingOfType("model.OpenDialogRequest")).Return(nil).Run(func(args mock.Arguments) {
					dialogRequest := args.Get(0).(model.OpenDialogRequest)
					assert.Contains(t, dialogRequest.Dialog.IntroductionText, "Create a playbook")
				})
			},
			wantErr: false,
		},
		{
			name: "successful mobile app invocation",
			args: args{
				teamID:      "teamID",
				ownerID:     "ownerID",
				triggerID:   "triggerID",
				postID:      "postID",
				clientID:    "clientID",
				playbooks:   []app.Playbook{},
				isMobileApp: true,
			},
			prepMocks: func(t *testing.T, store *mock_app.MockIncidentStore, poster *mock_bot.MockPoster, api *plugintest.API, configService *mock_config.MockService) {
				api.On("GetTeam", "teamID").
					Return(&model.Team{Id: "teamID", Name: "Team"}, nil)
				api.On("GetUser", "ownerID").
					Return(&model.User{Id: "ownerID", Username: "User"}, nil)
				api.On("GetConfig").
					Return(&model.Config{
						ServiceSettings: model.ServiceSettings{
							SiteURL: &siteURL,
						},
					})
				configService.EXPECT().GetManifest().Return(&model.Manifest{Id: "pluginId"}).Times(2)
				api.On("OpenInteractiveDialog", mock.AnythingOfType("model.OpenDialogRequest")).Return(nil).Run(func(args mock.Arguments) {
					dialogRequest := args.Get(0).(model.OpenDialogRequest)
					assert.NotContains(t, dialogRequest.Dialog.IntroductionText, "Create a playbook")
				})
			},
			wantErr: false,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			controller := gomock.NewController(t)
			api := &plugintest.API{}
			client := pluginapi.NewClient(api)
			store := mock_app.NewMockIncidentStore(controller)
			poster := mock_bot.NewMockPoster(controller)
			logger := mock_bot.NewMockLogger(controller)
			configService := mock_config.NewMockService(controller)
			telemetryService := &telemetry.NoopTelemetry{}
			scheduler := mock_app.NewMockJobOnceScheduler(controller)
			service := app.NewIncidentService(client, store, poster, logger, configService, scheduler, telemetryService)

			tt.prepMocks(t, store, poster, api, configService)

			err := service.OpenCreateIncidentDialog(tt.args.teamID, tt.args.ownerID, tt.args.triggerID, tt.args.postID, tt.args.clientID, tt.args.playbooks, tt.args.isMobileApp)
			if (err != nil) != tt.wantErr {
				t.Errorf("OpenCreateIncidentDialog() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
		})
	}
}
