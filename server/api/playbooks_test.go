package api

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/golang/mock/gomock"
	icClient "github.com/mattermost/mattermost-plugin-incident-collaboration/client"
	"github.com/mattermost/mattermost-plugin-incident-collaboration/server/app"
	mock_app "github.com/mattermost/mattermost-plugin-incident-collaboration/server/app/mocks"
	mock_poster "github.com/mattermost/mattermost-plugin-incident-collaboration/server/bot/mocks"
	"github.com/mattermost/mattermost-plugin-incident-collaboration/server/config"
	mock_config "github.com/mattermost/mattermost-plugin-incident-collaboration/server/config/mocks"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/plugin/plugintest"
	"github.com/pkg/errors"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	pluginapi "github.com/mattermost/mattermost-plugin-api"
)

func jsonPlaybookReader(playbook app.Playbook) io.Reader {
	jsonBytes, err := json.Marshal(playbook)
	if err != nil {
		panic(err)
	}
	return bytes.NewReader(jsonBytes)
}

func TestPlaybooks(t *testing.T) {
	playbooktest := app.Playbook{
		Title:  "My Playbook",
		TeamID: "testteamid",
		Checklists: []app.Checklist{
			{
				Title: "Do these things",
				Items: []app.ChecklistItem{
					{
						Title: "Do this",
					},
				},
			},
		},
		MemberIDs:       []string{},
		InvitedUserIDs:  []string{},
		InvitedGroupIDs: []string{},
	}
	withid := app.Playbook{
		ID:     "testplaybookid",
		Title:  "My Playbook",
		TeamID: "testteamid",
		Checklists: []app.Checklist{
			{
				Title: "Do these things",
				Items: []app.ChecklistItem{
					{
						Title: "Do this",
					},
				},
			},
		},
		MemberIDs:       []string{},
		InvitedUserIDs:  []string{},
		InvitedGroupIDs: []string{},
	}

	withMember := app.Playbook{
		ID:     "playbookwithmember",
		Title:  "My Playbook",
		TeamID: "testteamid",
		Checklists: []app.Checklist{
			{
				Title: "Do these things",
				Items: []app.ChecklistItem{
					{
						Title: "Do this",
					},
				},
			},
		},
		MemberIDs:       []string{"testuserid"},
		InvitedUserIDs:  []string{},
		InvitedGroupIDs: []string{},
	}
	withBroadcastChannel := app.Playbook{
		ID:     "testplaybookid",
		Title:  "My Playbook",
		TeamID: "testteamid",
		Checklists: []app.Checklist{
			{
				Title: "Do these things",
				Items: []app.ChecklistItem{
					{
						Title: "Do this",
					},
				},
			},
		},
		MemberIDs:          []string{"testuserid"},
		BroadcastChannelID: "nonemptychannelid",
		InvitedUserIDs:     []string{},
		InvitedGroupIDs:    []string{},
	}

	var mockCtrl *gomock.Controller
	var handler *Handler
	var logger *mock_poster.MockLogger
	var poster *mock_poster.MockPoster
	var configService *mock_config.MockService
	var playbookService *mock_app.MockPlaybookService
	var pluginAPI *plugintest.API
	var client *pluginapi.Client
	mattermostUserID := "testuserid"

	// mattermostHandler simulates the Mattermost server routing HTTP requests to a plugin.
	mattermostHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		r.URL.Path = strings.TrimPrefix(r.URL.Path, "/plugins/com.mattermost.plugin-incident-management")
		r.Header.Add("Mattermost-User-ID", mattermostUserID)

		handler.ServeHTTP(w, r)
	})

	server := httptest.NewServer(mattermostHandler)
	t.Cleanup(server.Close)

	c, err := icClient.New(&model.Client4{Url: server.URL})
	require.NoError(t, err)

	reset := func(t *testing.T) {
		t.Helper()

		mattermostUserID = "testuserid"
		mockCtrl = gomock.NewController(t)
		configService = mock_config.NewMockService(mockCtrl)
		pluginAPI = &plugintest.API{}
		client = pluginapi.NewClient(pluginAPI, &plugintest.Driver{})
		logger = mock_poster.NewMockLogger(mockCtrl)
		handler = NewHandler(client, configService, logger)
		playbookService = mock_app.NewMockPlaybookService(mockCtrl)
		logger = mock_poster.NewMockLogger(mockCtrl)
		poster = mock_poster.NewMockPoster(mockCtrl)

		NewPlaybookHandler(handler.APIRouter, playbookService, client, logger, configService)

		configService.EXPECT().
			IsAtLeastE20Licensed().
			Return(true).
			Times(1)

		configService.EXPECT().
			GetConfiguration().
			AnyTimes().
			Return(&config.Configuration{
				EnabledTeams:            []string{},
				PlaybookCreatorsUserIds: []string{},
			})
	}

	t.Run("create playbook, unlicensed with one pre-existing playbook in the team", func(t *testing.T) {
		mockCtrl = gomock.NewController(t)
		configService = mock_config.NewMockService(mockCtrl)
		pluginAPI = &plugintest.API{}
		client = pluginapi.NewClient(pluginAPI, &plugintest.Driver{})
		logger = mock_poster.NewMockLogger(mockCtrl)
		handler = NewHandler(client, configService, logger)
		playbookService = mock_app.NewMockPlaybookService(mockCtrl)
		logger = mock_poster.NewMockLogger(mockCtrl)
		poster = mock_poster.NewMockPoster(mockCtrl)

		NewPlaybookHandler(handler.APIRouter, playbookService, client, logger, configService)

		configService.EXPECT().
			GetConfiguration().
			AnyTimes().
			Return(&config.Configuration{
				EnabledTeams:            []string{},
				PlaybookCreatorsUserIds: []string{},
			})

		configService.EXPECT().
			IsAtLeastE20Licensed().
			Return(false)

		configService.EXPECT().
			IsAtLeastE10Licensed().
			Return(false)

		logger.EXPECT().Warnf(gomock.Any(), gomock.Any(), gomock.Any())

		playbookService.EXPECT().GetNumPlaybooksForTeam(playbooktest.TeamID).Return(1, nil)

		playbookService.EXPECT().
			Create(playbooktest, "testuserid").
			Return(model.NewId(), nil).
			Times(1)

		resultPlaybook, err := c.Playbooks.Create(context.TODO(), icClient.PlaybookCreateOptions{
			Title:           playbooktest.Title,
			TeamID:          playbooktest.TeamID,
			Checklists:      toAPIChecklists(playbooktest.Checklists),
			MemberIDs:       playbooktest.MemberIDs,
			InvitedUserIDs:  playbooktest.InvitedUserIDs,
			InvitedGroupIDs: playbooktest.InvitedGroupIDs,
		})
		requireErrorWithStatusCode(t, err, http.StatusForbidden)
		assert.Nil(t, resultPlaybook)
	})

	t.Run("create playbook, E10-licensed, with one pre-existing playbook in the team", func(t *testing.T) {
		mockCtrl = gomock.NewController(t)
		configService = mock_config.NewMockService(mockCtrl)
		pluginAPI = &plugintest.API{}
		client = pluginapi.NewClient(pluginAPI, &plugintest.Driver{})
		logger = mock_poster.NewMockLogger(mockCtrl)
		handler = NewHandler(client, configService, logger)
		playbookService = mock_app.NewMockPlaybookService(mockCtrl)
		logger = mock_poster.NewMockLogger(mockCtrl)
		poster = mock_poster.NewMockPoster(mockCtrl)

		NewPlaybookHandler(handler.APIRouter, playbookService, client, logger, configService)

		configService.EXPECT().
			GetConfiguration().
			AnyTimes().
			Return(&config.Configuration{
				EnabledTeams:            []string{},
				PlaybookCreatorsUserIds: []string{},
			})

		configService.EXPECT().
			IsAtLeastE20Licensed().
			Return(false)

		configService.EXPECT().
			IsAtLeastE10Licensed().
			Return(true)

		logger.EXPECT().Warnf(gomock.Any(), gomock.Any(), gomock.Any())

		playbookService.EXPECT().GetNumPlaybooksForTeam(playbooktest.TeamID).Return(1, nil)

		pluginAPI.On("HasPermissionToTeam", "testuserid", "testteamid", model.PERMISSION_VIEW_TEAM).Return(true)
		pluginAPI.On("GetUser", "testuserid").Return(&model.User{}, nil)

		playbookService.EXPECT().
			Create(playbooktest, "testuserid").
			Return(model.NewId(), nil).
			Times(1)

		resultPlaybook, err := c.Playbooks.Create(context.TODO(), icClient.PlaybookCreateOptions{
			Title:           playbooktest.Title,
			TeamID:          playbooktest.TeamID,
			Checklists:      toAPIChecklists(playbooktest.Checklists),
			MemberIDs:       playbooktest.MemberIDs,
			InvitedUserIDs:  playbooktest.InvitedUserIDs,
			InvitedGroupIDs: playbooktest.InvitedGroupIDs,
		})
		require.NoError(t, err)
		assert.NotEmpty(t, resultPlaybook.ID)
	})

	t.Run("create playbook, unlicensed with zero pre-existing playbooks in the team", func(t *testing.T) {
		mockCtrl = gomock.NewController(t)
		configService = mock_config.NewMockService(mockCtrl)
		pluginAPI = &plugintest.API{}
		client = pluginapi.NewClient(pluginAPI, &plugintest.Driver{})
		playbookService = mock_app.NewMockPlaybookService(mockCtrl)
		logger = mock_poster.NewMockLogger(mockCtrl)
		poster = mock_poster.NewMockPoster(mockCtrl)
		handler = NewHandler(client, configService, logger)

		NewPlaybookHandler(handler.APIRouter, playbookService, client, logger, configService)

		configService.EXPECT().
			IsAtLeastE20Licensed().
			Return(false).
			Times(1)

		configService.EXPECT().
			IsAtLeastE10Licensed().
			Return(false).
			Times(1)

		configService.EXPECT().
			GetConfiguration().
			AnyTimes().
			Return(&config.Configuration{
				EnabledTeams:            []string{},
				PlaybookCreatorsUserIds: []string{},
			})

		configService.EXPECT().
			GetConfiguration().
			Return(&config.Configuration{
				EnabledTeams: []string{},
			}).
			AnyTimes()

		playbookService.EXPECT().GetNumPlaybooksForTeam(playbooktest.TeamID).Return(0, nil)

		pluginAPI.On("HasPermissionToTeam", "testuserid", "testteamid", model.PERMISSION_VIEW_TEAM).Return(true)
		pluginAPI.On("GetUser", "testuserid").Return(&model.User{}, nil)

		playbookService.EXPECT().
			Create(playbooktest, "testuserid").
			Return(model.NewId(), nil).
			Times(1)

		resultPlaybook, err := c.Playbooks.Create(context.TODO(), icClient.PlaybookCreateOptions{
			Title:           playbooktest.Title,
			TeamID:          playbooktest.TeamID,
			Checklists:      toAPIChecklists(playbooktest.Checklists),
			MemberIDs:       playbooktest.MemberIDs,
			InvitedUserIDs:  playbooktest.InvitedUserIDs,
			InvitedGroupIDs: playbooktest.InvitedGroupIDs,
		})
		require.NoError(t, err)
		assert.NotEmpty(t, resultPlaybook.ID)
	})

	t.Run("create playbook, E10-licensed, with zero pre-existing playbooks in the team", func(t *testing.T) {
		mockCtrl = gomock.NewController(t)
		configService = mock_config.NewMockService(mockCtrl)
		pluginAPI = &plugintest.API{}
		client = pluginapi.NewClient(pluginAPI, &plugintest.Driver{})
		playbookService = mock_app.NewMockPlaybookService(mockCtrl)
		logger = mock_poster.NewMockLogger(mockCtrl)
		poster = mock_poster.NewMockPoster(mockCtrl)
		handler = NewHandler(client, configService, logger)

		NewPlaybookHandler(handler.APIRouter, playbookService, client, logger, configService)

		configService.EXPECT().
			IsAtLeastE20Licensed().
			Return(false).
			Times(1)

		configService.EXPECT().
			IsAtLeastE10Licensed().
			Return(true).
			Times(1)

		configService.EXPECT().
			GetConfiguration().
			AnyTimes().
			Return(&config.Configuration{
				EnabledTeams:            []string{},
				PlaybookCreatorsUserIds: []string{},
			})

		configService.EXPECT().
			GetConfiguration().
			Return(&config.Configuration{
				EnabledTeams: []string{},
			}).
			AnyTimes()

		playbookService.EXPECT().GetNumPlaybooksForTeam(playbooktest.TeamID).Return(0, nil)

		pluginAPI.On("HasPermissionToTeam", "testuserid", "testteamid", model.PERMISSION_VIEW_TEAM).Return(true)
		pluginAPI.On("GetUser", "testuserid").Return(&model.User{}, nil)

		playbookService.EXPECT().
			Create(playbooktest, "testuserid").
			Return(model.NewId(), nil).
			Times(1)

		resultPlaybook, err := c.Playbooks.Create(context.TODO(), icClient.PlaybookCreateOptions{
			Title:           playbooktest.Title,
			TeamID:          playbooktest.TeamID,
			Checklists:      toAPIChecklists(playbooktest.Checklists),
			MemberIDs:       playbooktest.MemberIDs,
			InvitedUserIDs:  playbooktest.InvitedUserIDs,
			InvitedGroupIDs: playbooktest.InvitedGroupIDs,
		})
		require.NoError(t, err)
		assert.NotEmpty(t, resultPlaybook.ID)
	})

	t.Run("create playbook, E20-licensed, with zero pre-existing playbooks in the team", func(t *testing.T) {
		mockCtrl = gomock.NewController(t)
		configService = mock_config.NewMockService(mockCtrl)
		pluginAPI = &plugintest.API{}
		client = pluginapi.NewClient(pluginAPI, &plugintest.Driver{})
		playbookService = mock_app.NewMockPlaybookService(mockCtrl)
		logger = mock_poster.NewMockLogger(mockCtrl)
		poster = mock_poster.NewMockPoster(mockCtrl)
		handler = NewHandler(client, configService, logger)

		NewPlaybookHandler(handler.APIRouter, playbookService, client, logger, configService)

		configService.EXPECT().
			IsAtLeastE20Licensed().
			Return(true).
			Times(1)

		configService.EXPECT().
			GetConfiguration().
			AnyTimes().
			Return(&config.Configuration{
				EnabledTeams:            []string{},
				PlaybookCreatorsUserIds: []string{},
			})

		configService.EXPECT().
			GetConfiguration().
			Return(&config.Configuration{
				EnabledTeams: []string{},
			}).
			AnyTimes()

		playbookService.EXPECT().GetNumPlaybooksForTeam(playbooktest.TeamID).Return(0, nil)

		pluginAPI.On("HasPermissionToTeam", "testuserid", "testteamid", model.PERMISSION_VIEW_TEAM).Return(true)
		pluginAPI.On("GetUser", "testuserid").Return(&model.User{}, nil)

		playbookService.EXPECT().
			Create(playbooktest, "testuserid").
			Return(model.NewId(), nil).
			Times(1)

		resultPlaybook, err := c.Playbooks.Create(context.TODO(), icClient.PlaybookCreateOptions{
			Title:           playbooktest.Title,
			TeamID:          playbooktest.TeamID,
			Checklists:      toAPIChecklists(playbooktest.Checklists),
			MemberIDs:       playbooktest.MemberIDs,
			InvitedUserIDs:  playbooktest.InvitedUserIDs,
			InvitedGroupIDs: playbooktest.InvitedGroupIDs,
		})
		require.NoError(t, err)
		assert.NotEmpty(t, resultPlaybook.ID)
	})

	t.Run("create playbook, unlicensed, with playbook members", func(t *testing.T) {
		mockCtrl = gomock.NewController(t)
		configService = mock_config.NewMockService(mockCtrl)
		pluginAPI = &plugintest.API{}
		client = pluginapi.NewClient(pluginAPI, &plugintest.Driver{})
		playbookService = mock_app.NewMockPlaybookService(mockCtrl)
		logger = mock_poster.NewMockLogger(mockCtrl)
		poster = mock_poster.NewMockPoster(mockCtrl)
		handler = NewHandler(client, configService, logger)

		NewPlaybookHandler(handler.APIRouter, playbookService, client, logger, configService)

		configService.EXPECT().
			IsAtLeastE20Licensed().
			Return(false).
			Times(1)

		configService.EXPECT().
			IsAtLeastE10Licensed().
			Return(false).
			Times(1)

		configService.EXPECT().
			GetConfiguration().
			AnyTimes().
			Return(&config.Configuration{
				EnabledTeams:            []string{},
				PlaybookCreatorsUserIds: []string{},
			})

		configService.EXPECT().
			GetConfiguration().
			Return(&config.Configuration{
				EnabledTeams: []string{},
			}).
			AnyTimes()

		playbookService.EXPECT().GetNumPlaybooksForTeam(withMember.TeamID).Return(0, nil)

		pluginAPI.On("HasPermissionToTeam", "testuserid", "testteamid", model.PERMISSION_VIEW_TEAM).Return(true)
		pluginAPI.On("GetUser", "testuserid").Return(&model.User{}, nil)

		logger.EXPECT().Warnf(gomock.Any(), gomock.Any(), gomock.Any())

		playbookService.EXPECT().
			Create(withMember, "testuserid").
			Return(model.NewId(), nil).
			Times(1)

		resultPlaybook, err := c.Playbooks.Create(context.TODO(), icClient.PlaybookCreateOptions{
			Title:           withMember.Title,
			TeamID:          withMember.TeamID,
			Checklists:      toAPIChecklists(withMember.Checklists),
			MemberIDs:       withMember.MemberIDs,
			InvitedUserIDs:  withMember.InvitedUserIDs,
			InvitedGroupIDs: withMember.InvitedGroupIDs,
		})
		requireErrorWithStatusCode(t, err, http.StatusForbidden)
		assert.Nil(t, resultPlaybook)
	})

	t.Run("create playbook, E10-licensed, with playbook members", func(t *testing.T) {
		mockCtrl = gomock.NewController(t)
		configService = mock_config.NewMockService(mockCtrl)
		pluginAPI = &plugintest.API{}
		client = pluginapi.NewClient(pluginAPI, &plugintest.Driver{})
		playbookService = mock_app.NewMockPlaybookService(mockCtrl)
		logger = mock_poster.NewMockLogger(mockCtrl)
		poster = mock_poster.NewMockPoster(mockCtrl)
		handler = NewHandler(client, configService, logger)

		NewPlaybookHandler(handler.APIRouter, playbookService, client, logger, configService)

		configService.EXPECT().
			IsAtLeastE20Licensed().
			Return(false).
			Times(1)

		configService.EXPECT().
			IsAtLeastE10Licensed().
			Return(true).
			Times(1)

		configService.EXPECT().
			GetConfiguration().
			AnyTimes().
			Return(&config.Configuration{
				EnabledTeams:            []string{},
				PlaybookCreatorsUserIds: []string{},
			})

		configService.EXPECT().
			GetConfiguration().
			Return(&config.Configuration{
				EnabledTeams: []string{},
			}).
			AnyTimes()

		playbookService.EXPECT().GetNumPlaybooksForTeam(withMember.TeamID).Return(0, nil)

		pluginAPI.On("HasPermissionToTeam", "testuserid", "testteamid", model.PERMISSION_VIEW_TEAM).Return(true)
		pluginAPI.On("GetUser", "testuserid").Return(&model.User{}, nil)

		logger.EXPECT().Warnf(gomock.Any(), gomock.Any(), gomock.Any())

		playbookService.EXPECT().
			Create(withMember, "testuserid").
			Return(model.NewId(), nil).
			Times(1)

		resultPlaybook, err := c.Playbooks.Create(context.TODO(), icClient.PlaybookCreateOptions{
			Title:           withMember.Title,
			TeamID:          withMember.TeamID,
			Checklists:      toAPIChecklists(withMember.Checklists),
			MemberIDs:       withMember.MemberIDs,
			InvitedUserIDs:  withMember.InvitedUserIDs,
			InvitedGroupIDs: withMember.InvitedGroupIDs,
		})
		requireErrorWithStatusCode(t, err, http.StatusForbidden)
		assert.Nil(t, resultPlaybook)
	})

	t.Run("create playbook", func(t *testing.T) {
		reset(t)

		playbookService.EXPECT().
			Create(playbooktest, "testuserid").
			Return(model.NewId(), nil).
			Times(1)

		poster.EXPECT().
			PublishWebsocketEventToTeam("playbook_created", map[string]interface{}{
				"teamID": playbooktest.TeamID,
			}, playbooktest.TeamID)

		pluginAPI.On("HasPermissionToTeam", "testuserid", "testteamid", model.PERMISSION_VIEW_TEAM).Return(true)
		pluginAPI.On("GetUser", "testuserid").Return(&model.User{}, nil)

		resultPlaybook, err := c.Playbooks.Create(context.TODO(), icClient.PlaybookCreateOptions{
			Title:           playbooktest.Title,
			TeamID:          playbooktest.TeamID,
			Checklists:      toAPIChecklists(playbooktest.Checklists),
			MemberIDs:       playbooktest.MemberIDs,
			InvitedUserIDs:  playbooktest.InvitedUserIDs,
			InvitedGroupIDs: playbooktest.InvitedGroupIDs,
		})
		require.NoError(t, err)
		assert.NotEmpty(t, resultPlaybook.ID)
	})

	t.Run("create playbook, as guest", func(t *testing.T) {
		reset(t)
		logger.EXPECT().Warnf(gomock.Any(), gomock.Any(), gomock.Any())

		playbookService.EXPECT().
			Create(playbooktest, "testuserid").
			Return(model.NewId(), nil).
			Times(1)

		pluginAPI.On("HasPermissionToTeam", "testuserid", "testteamid", model.PERMISSION_VIEW_TEAM).Return(true)
		pluginAPI.On("GetUser", "testuserid").Return(&model.User{Roles: "system_guest"}, nil)

		resultPlaybook, err := c.Playbooks.Create(context.TODO(), icClient.PlaybookCreateOptions{
			Title:          playbooktest.Title,
			TeamID:         playbooktest.TeamID,
			Checklists:     toAPIChecklists(playbooktest.Checklists),
			MemberIDs:      playbooktest.MemberIDs,
			InvitedUserIDs: playbooktest.InvitedUserIDs,
		})
		requireErrorWithStatusCode(t, err, http.StatusForbidden)
		assert.Nil(t, resultPlaybook)
	})

	t.Run("create playbook, no permissions to broadcast channel", func(t *testing.T) {
		reset(t)
		logger.EXPECT().Warnf(gomock.Any(), gomock.Any(), gomock.Any())
		broadcastChannelID := model.NewId()

		playbookService.EXPECT().
			Create(playbooktest, "testuserid").
			Return(model.NewId(), nil).
			Times(1)

		pluginAPI.On("HasPermissionToTeam", "testuserid", "testteamid", model.PERMISSION_VIEW_TEAM).Return(true)
		pluginAPI.On("HasPermissionToChannel", "testuserid", broadcastChannelID, model.PERMISSION_CREATE_POST).Return(false)
		pluginAPI.On("GetUser", "testuserid").Return(&model.User{}, nil)

		resultPlaybook, err := c.Playbooks.Create(context.TODO(), icClient.PlaybookCreateOptions{
			Title:  "My Playbook",
			TeamID: "testteamid",
			Checklists: toAPIChecklists([]app.Checklist{
				{
					Title: "Do these things",
					Items: []app.ChecklistItem{
						{
							Title: "Do this",
						},
					},
				},
			}),
			BroadcastChannelID: broadcastChannelID,
		})
		requireErrorWithStatusCode(t, err, http.StatusForbidden)
		assert.Nil(t, resultPlaybook)
	})

	t.Run("create playbook with invited users and groups", func(t *testing.T) {
		reset(t)

		playbook := app.Playbook{
			Title:  "My Playbook",
			TeamID: "testteamid",
			Checklists: []app.Checklist{
				{
					Title: "Do these things",
					Items: []app.ChecklistItem{
						{
							Title: "Do this",
						},
					},
				},
			},
			MemberIDs:          []string{"testuserid"},
			InviteUsersEnabled: true,
			InvitedUserIDs:     []string{"testInvitedUserID1", "testInvitedUserID2"},
			InvitedGroupIDs:    []string{"testInvitedGroupID1", "testInvitedGroupID2"},
		}

		playbookService.EXPECT().
			Create(playbook, "testuserid").
			Return(model.NewId(), nil).
			Times(1)

		poster.EXPECT().
			PublishWebsocketEventToTeam("playbook_created", map[string]interface{}{
				"teamID": playbooktest.TeamID,
			}, playbooktest.TeamID)

		pluginAPI.On("HasPermissionToTeam", "testInvitedUserID1", "testteamid", model.PERMISSION_VIEW_TEAM).Return(true)
		pluginAPI.On("HasPermissionToTeam", "testInvitedUserID2", "testteamid", model.PERMISSION_VIEW_TEAM).Return(true)
		pluginAPI.On("GetGroup", "testInvitedGroupID1").Return(&model.Group{
			Id:             "testInvitedGroupID1",
			AllowReference: true,
		}, nil)
		pluginAPI.On("GetGroup", "testInvitedGroupID2").Return(&model.Group{
			Id:             "testInvitedGroupID2",
			AllowReference: true,
		}, nil)
		pluginAPI.On("HasPermissionToTeam", "testuserid", "testteamid", model.PERMISSION_VIEW_TEAM).Return(true)
		pluginAPI.On("HasPermissionTo", "testuserid", model.PERMISSION_MANAGE_SYSTEM).Return(true)
		pluginAPI.On("GetUser", "testuserid").Return(&model.User{}, nil)

		resultPlaybook, err := c.Playbooks.Create(context.TODO(), icClient.PlaybookCreateOptions{
			Title:  "My Playbook",
			TeamID: "testteamid",
			Checklists: toAPIChecklists([]app.Checklist{
				{
					Title: "Do these things",
					Items: []app.ChecklistItem{
						{
							Title: "Do this",
						},
					},
				},
			}),
			MemberIDs:          []string{"testuserid"},
			InviteUsersEnabled: true,
			InvitedUserIDs:     []string{"testInvitedUserID1", "testInvitedUserID2"},
			InvitedGroupIDs:    []string{"testInvitedGroupID1", "testInvitedGroupID2"},
		})
		require.NoError(t, err)
		assert.NotEmpty(t, resultPlaybook.ID)
	})

	t.Run("create playbook with invited users and groups, invite disabled", func(t *testing.T) {
		reset(t)

		playbook := app.Playbook{
			Title:  "My Playbook",
			TeamID: "testteamid",
			Checklists: []app.Checklist{
				{
					Title: "Do these things",
					Items: []app.ChecklistItem{
						{
							Title: "Do this",
						},
					},
				},
			},
			MemberIDs:          []string{"testuserid"},
			InviteUsersEnabled: false,
			InvitedUserIDs:     []string{"testInvitedUserID1", "testInvitedUserID2"},
			InvitedGroupIDs:    []string{"testInvitedGroupID1", "testInvitedGroupID2"},
		}

		playbookService.EXPECT().
			Create(playbook, "testuserid").
			Return(model.NewId(), nil).
			Times(1)

		poster.EXPECT().
			PublishWebsocketEventToTeam("playbook_created", map[string]interface{}{
				"teamID": playbooktest.TeamID,
			}, playbooktest.TeamID)

		pluginAPI.On("HasPermissionToTeam", "testInvitedUserID1", "testteamid", model.PERMISSION_VIEW_TEAM).Return(true)
		pluginAPI.On("HasPermissionToTeam", "testInvitedUserID2", "testteamid", model.PERMISSION_VIEW_TEAM).Return(true)
		pluginAPI.On("GetGroup", "testInvitedGroupID1").Return(&model.Group{
			Id:             "testInvitedGroupID1",
			AllowReference: true,
		}, nil)
		pluginAPI.On("GetGroup", "testInvitedGroupID2").Return(&model.Group{
			Id:             "testInvitedGroupID2",
			AllowReference: true,
		}, nil)
		pluginAPI.On("HasPermissionToTeam", "testuserid", "testteamid", model.PERMISSION_VIEW_TEAM).Return(true)
		pluginAPI.On("HasPermissionTo", "testuserid", model.PERMISSION_MANAGE_SYSTEM).Return(true)
		pluginAPI.On("GetUser", "testuserid").Return(&model.User{}, nil)

		resultPlaybook, err := c.Playbooks.Create(context.TODO(), icClient.PlaybookCreateOptions{
			Title:  "My Playbook",
			TeamID: "testteamid",
			Checklists: toAPIChecklists([]app.Checklist{
				{
					Title: "Do these things",
					Items: []app.ChecklistItem{
						{
							Title: "Do this",
						},
					},
				},
			}),
			MemberIDs:          []string{"testuserid"},
			InviteUsersEnabled: false,
			InvitedUserIDs:     []string{"testInvitedUserID1", "testInvitedUserID2"},
			InvitedGroupIDs:    []string{"testInvitedGroupID1", "testInvitedGroupID2"},
		})
		require.NoError(t, err)
		assert.NotEmpty(t, resultPlaybook.ID)
	})

	t.Run("create playbook with invited users and groups, group disallowing mention", func(t *testing.T) {
		reset(t)
		logger.EXPECT().Warnf(gomock.Any(), gomock.Any(), gomock.Any())

		playbook := app.Playbook{
			Title:  "My Playbook",
			TeamID: "testteamid",
			Checklists: []app.Checklist{
				{
					Title: "Do these things",
					Items: []app.ChecklistItem{
						{
							Title: "Do this",
						},
					},
				},
			},
			MemberIDs:          []string{"testuserid"},
			InviteUsersEnabled: true,
			InvitedUserIDs:     []string{"testInvitedUserID1", "testInvitedUserID2"},
			InvitedGroupIDs:    []string{"testInvitedGroupID1", "testInvitedGroupID2"},
		}

		playbookService.EXPECT().
			Create(playbook, "testuserid").
			Return(model.NewId(), nil).
			Times(1)

		pluginAPI.On("HasPermissionToTeam", "testInvitedUserID1", "testteamid", model.PERMISSION_VIEW_TEAM).Return(true)
		pluginAPI.On("HasPermissionToTeam", "testInvitedUserID2", "testteamid", model.PERMISSION_VIEW_TEAM).Return(true)
		pluginAPI.On("GetGroup", "testInvitedGroupID1").Return(&model.Group{
			Id:             "testInvitedGroupID1",
			AllowReference: true,
		}, nil)
		pluginAPI.On("GetGroup", "testInvitedGroupID2").Return(&model.Group{
			Id:             "testInvitedGroupID2",
			AllowReference: false,
		}, nil)
		pluginAPI.On("HasPermissionToTeam", "testuserid", "testteamid", model.PERMISSION_VIEW_TEAM).Return(true)
		pluginAPI.On("HasPermissionTo", "testuserid", model.PERMISSION_MANAGE_SYSTEM).Return(true)
		pluginAPI.On("GetUser", "testuserid").Return(&model.User{}, nil)

		resultPlaybook, err := c.Playbooks.Create(context.TODO(), icClient.PlaybookCreateOptions{
			Title:  "My Playbook",
			TeamID: "testteamid",
			Checklists: toAPIChecklists([]app.Checklist{
				{
					Title: "Do these things",
					Items: []app.ChecklistItem{
						{
							Title: "Do this",
						},
					},
				},
			}),
			MemberIDs:          []string{"testuserid"},
			InviteUsersEnabled: true,
			InvitedUserIDs:     []string{"testInvitedUserID1", "testInvitedUserID2"},
			InvitedGroupIDs:    []string{"testInvitedGroupID1", "testInvitedGroupID2"},
		})
		requireErrorWithStatusCode(t, err, http.StatusForbidden)
		require.Nil(t, resultPlaybook)

	})

	t.Run("get playbook", func(t *testing.T) {
		reset(t)

		pluginAPI.On("HasPermissionToTeam", "testuserid", "testteamid", model.PERMISSION_VIEW_TEAM).Return(true)

		playbookService.EXPECT().
			Get("testplaybookid").
			Return(withMember, nil).
			Times(1)

		result, err := c.Playbooks.Get(context.TODO(), "testplaybookid")
		require.NoError(t, err)
		assert.Equal(t, withMember, toInternalPlaybook(*result))
	})

	t.Run("get playbooks", func(t *testing.T) {
		reset(t)

		playbookResult := struct {
			TotalCount int            `json:"total_count"`
			PageCount  int            `json:"page_count"`
			HasMore    bool           `json:"has_more"`
			Items      []app.Playbook `json:"items"`
		}{
			TotalCount: 2,
			PageCount:  1,
			HasMore:    false,
			Items:      []app.Playbook{playbooktest, playbooktest},
		}

		playbookService.EXPECT().
			GetPlaybooksForTeam(
				app.RequesterInfo{
					UserID:  "testuserid",
					TeamID:  "testteamid",
					IsAdmin: true,
				},
				"testteamid",
				gomock.Any(),
			).
			Return(playbookResult, nil).
			Times(1)

		pluginAPI.On("HasPermissionToTeam", "testuserid", "testteamid", model.PERMISSION_VIEW_TEAM).Return(true)
		pluginAPI.On("HasPermissionTo", "testuserid", model.PERMISSION_MANAGE_SYSTEM).Return(true)
		pluginAPI.On("GetUser", "testuserid").Return(&model.User{}, nil)

		actualList, err := c.Playbooks.List(context.TODO(), "testteamid", 0, 100, icClient.PlaybookListOptions{})
		require.NoError(t, err)

		expectedList := &icClient.GetPlaybooksResults{
			TotalCount: 2,
			PageCount:  1,
			HasMore:    false,
			Items:      []icClient.Playbook{toAPIPlaybook(playbooktest), toAPIPlaybook(playbooktest)},
		}
		assert.Equal(t, expectedList, actualList)
	})

	t.Run("get playbooks, as guest", func(t *testing.T) {
		reset(t)
		logger.EXPECT().Warnf(gomock.Any(), gomock.Any(), gomock.Any())

		playbookResult := struct {
			TotalCount int            `json:"total_count"`
			PageCount  int            `json:"page_count"`
			HasMore    bool           `json:"has_more"`
			Items      []app.Playbook `json:"items"`
		}{
			TotalCount: 2,
			PageCount:  1,
			HasMore:    false,
			Items:      []app.Playbook{playbooktest, playbooktest},
		}

		playbookService.EXPECT().
			GetPlaybooksForTeam(
				app.RequesterInfo{
					UserID:  "testuserid",
					TeamID:  "testteamid",
					IsAdmin: true,
				},
				"testteamid",
				gomock.Any(),
			).
			Return(playbookResult, nil).
			Times(1)

		pluginAPI.On("HasPermissionToTeam", "testuserid", "testteamid", model.PERMISSION_VIEW_TEAM).Return(true)
		pluginAPI.On("HasPermissionTo", "testuserid", model.PERMISSION_MANAGE_SYSTEM).Return(true)
		pluginAPI.On("GetUser", "testuserid").Return(&model.User{Roles: "system_guest"}, nil)

		actualList, err := c.Playbooks.List(context.TODO(), "testteamid", 0, 100, icClient.PlaybookListOptions{})
		requireErrorWithStatusCode(t, err, http.StatusForbidden)
		assert.Empty(t, actualList)
	})

	t.Run("get playbooks, member only", func(t *testing.T) {
		reset(t)

		playbookResult := struct {
			TotalCount int            `json:"total_count"`
			PageCount  int            `json:"page_count"`
			HasMore    bool           `json:"has_more"`
			Items      []app.Playbook `json:"items"`
		}{
			TotalCount: 2,
			PageCount:  1,
			HasMore:    false,
			Items:      []app.Playbook{playbooktest, playbooktest},
		}

		playbookService.EXPECT().
			GetPlaybooksForTeam(
				app.RequesterInfo{
					UserID:  "testuserid",
					TeamID:  "testteamid",
					IsAdmin: true,
				},
				"testteamid",
				gomock.Any(),
			).
			Return(playbookResult, nil).
			Times(1)

		pluginAPI.On("HasPermissionToTeam", "testuserid", "testteamid", model.PERMISSION_VIEW_TEAM).Return(true)
		pluginAPI.On("HasPermissionTo", "testuserid", model.PERMISSION_MANAGE_SYSTEM).Return(true)
		pluginAPI.On("GetUser", "testuserid").Return(&model.User{}, nil)

		actualList, err := c.Playbooks.List(context.TODO(), "testteamid", 0, 100, icClient.PlaybookListOptions{})
		require.NoError(t, err)

		expectedList := &icClient.GetPlaybooksResults{
			TotalCount: 2,
			PageCount:  1,
			HasMore:    false,
			Items:      []icClient.Playbook{toAPIPlaybook(playbooktest), toAPIPlaybook(playbooktest)},
		}
		assert.Equal(t, expectedList, actualList)
	})

	t.Run("update playbook", func(t *testing.T) {
		reset(t)

		playbookService.EXPECT().
			Get("playbookwithmember").
			Return(withMember, nil).
			Times(1)

		playbookService.EXPECT().
			Update(withMember, "testuserid").
			Return(nil).
			Times(1)

		pluginAPI.On("HasPermissionToTeam", "testuserid", "testteamid", model.PERMISSION_VIEW_TEAM).Return(true)
		pluginAPI.On("GetUser", "testuserid").Return(&model.User{}, nil)

		err := c.Playbooks.Update(context.TODO(), toAPIPlaybook(withMember))
		require.NoError(t, err)
	})

	t.Run("update playbook but no permissions in broadcast channel", func(t *testing.T) {
		reset(t)
		logger.EXPECT().Warnf(gomock.Any(), gomock.Any(), gomock.Any())

		playbookService.EXPECT().
			Get("testplaybookid").
			Return(playbooktest, nil).
			Times(1)

		playbookService.EXPECT().
			Update(withid, "testuserid").
			Return(nil).
			Times(1)

		pluginAPI.On("HasPermissionToTeam", "testuserid", "testteamid", model.PERMISSION_VIEW_TEAM).Return(true)
		pluginAPI.On("HasPermissionTo", "testuserid", model.PERMISSION_MANAGE_SYSTEM).Return(true)

		pluginAPI.On("HasPermissionToChannel", "testuserid", withBroadcastChannel.BroadcastChannelID, model.PERMISSION_CREATE_POST).Return(false)

		err := c.Playbooks.Update(context.TODO(), toAPIPlaybook(withBroadcastChannel))
		requireErrorWithStatusCode(t, err, http.StatusForbidden)
	})

	t.Run("update playbook but no premissions in broadcast channel, but no edit", func(t *testing.T) {
		reset(t)

		playbookService.EXPECT().
			Get("testplaybookid").
			Return(withBroadcastChannel, nil).
			Times(1)

		playbookService.EXPECT().
			Update(withBroadcastChannel, "testuserid").
			Return(nil).
			Times(1)

		pluginAPI.On("HasPermissionToTeam", "testuserid", "testteamid", model.PERMISSION_VIEW_TEAM).Return(true)

		err := c.Playbooks.Update(context.TODO(), toAPIPlaybook(withBroadcastChannel))
		require.NoError(t, err)
	})

	t.Run("update playbook with invited users and groups", func(t *testing.T) {
		reset(t)

		playbook := app.Playbook{
			Title:  "My Playbook",
			TeamID: "testteamid",
			Checklists: []app.Checklist{
				{
					Title: "Do these things",
					Items: []app.ChecklistItem{
						{
							Title: "Do this",
						},
					},
				},
			},
			MemberIDs:          []string{"testuserid"},
			BroadcastChannelID: "nonemptychannelid",
			InviteUsersEnabled: true,
			InvitedUserIDs:     []string{"testInvitedUserID1", "testInvitedUserID2"},
			InvitedGroupIDs:    []string{"testInvitedGroupID1", "testInvitedGroupID2"},
			SignalAnyKeywords:  []string{},
		}

		testrecorder := httptest.NewRecorder()
		testreq, err := http.NewRequest("PUT", "/api/v0/playbooks/testplaybookid", jsonPlaybookReader(playbook))
		testreq.Header.Add("Mattermost-User-ID", "testuserid")
		require.NoError(t, err)

		playbookService.EXPECT().
			Get("testplaybookid").
			Return(playbook, nil).
			Times(1)

		playbook.ID = "testplaybookid"
		playbookService.EXPECT().
			Update(playbook, "testuserid").
			Return(nil).
			Times(1)

		pluginAPI.On("HasPermissionToTeam", "testInvitedUserID1", "testteamid", model.PERMISSION_VIEW_TEAM).Return(true)
		pluginAPI.On("HasPermissionToTeam", "testInvitedUserID2", "testteamid", model.PERMISSION_VIEW_TEAM).Return(true)
		pluginAPI.On("GetGroup", "testInvitedGroupID1").Return(&model.Group{
			Id:             "testInvitedGroupID1",
			AllowReference: true,
		}, nil)
		pluginAPI.On("GetGroup", "testInvitedGroupID2").Return(&model.Group{
			Id:             "testInvitedGroupID2",
			AllowReference: true,
		}, nil)
		pluginAPI.On("HasPermissionToTeam", "testuserid", "testteamid", model.PERMISSION_VIEW_TEAM).Return(true)

		handler.ServeHTTP(testrecorder, testreq)

		resp := testrecorder.Result()
		assert.Equal(t, http.StatusOK, resp.StatusCode)
	})

	t.Run("update playbook with invited users and groups, invite disabled", func(t *testing.T) {
		reset(t)

		playbook := app.Playbook{
			Title:  "My Playbook",
			TeamID: "testteamid",
			Checklists: []app.Checklist{
				{
					Title: "Do these things",
					Items: []app.ChecklistItem{
						{
							Title: "Do this",
						},
					},
				},
			},
			MemberIDs:          []string{"testuserid"},
			BroadcastChannelID: "nonemptychannelid",
			InviteUsersEnabled: false,
			InvitedUserIDs:     []string{"testInvitedUserID1", "testInvitedUserID2"},
			InvitedGroupIDs:    []string{"testInvitedGroupID1", "testInvitedGroupID2"},
			SignalAnyKeywords:  []string{},
		}

		testrecorder := httptest.NewRecorder()
		testreq, err := http.NewRequest("PUT", "/api/v0/playbooks/testplaybookid", jsonPlaybookReader(playbook))
		testreq.Header.Add("Mattermost-User-ID", "testuserid")
		require.NoError(t, err)

		playbookService.EXPECT().
			Get("testplaybookid").
			Return(playbook, nil).
			Times(1)

		playbook.ID = "testplaybookid"
		playbookService.EXPECT().
			Update(playbook, "testuserid").
			Return(nil).
			Times(1)

		pluginAPI.On("HasPermissionToTeam", "testInvitedUserID1", "testteamid", model.PERMISSION_VIEW_TEAM).Return(true)
		pluginAPI.On("HasPermissionToTeam", "testInvitedUserID2", "testteamid", model.PERMISSION_VIEW_TEAM).Return(true)
		pluginAPI.On("GetGroup", "testInvitedGroupID1").Return(&model.Group{
			Id:             "testInvitedGroupID1",
			AllowReference: true,
		}, nil)
		pluginAPI.On("GetGroup", "testInvitedGroupID2").Return(&model.Group{
			Id:             "testInvitedGroupID2",
			AllowReference: true,
		}, nil)
		pluginAPI.On("HasPermissionToTeam", "testuserid", "testteamid", model.PERMISSION_VIEW_TEAM).Return(true)
		pluginAPI.On("HasPermissionTo", "testuserid", model.PERMISSION_MANAGE_SYSTEM).Return(true)

		handler.ServeHTTP(testrecorder, testreq)

		resp := testrecorder.Result()
		assert.Equal(t, http.StatusOK, resp.StatusCode)
	})

	t.Run("update playbook with invited users and groups, group disallowing mention", func(t *testing.T) {
		reset(t)

		playbook := app.Playbook{
			Title:  "My Playbook",
			TeamID: "testteamid",
			Checklists: []app.Checklist{
				{
					Title: "Do these things",
					Items: []app.ChecklistItem{
						{
							Title: "Do this",
						},
					},
				},
			},
			MemberIDs:          []string{"testuserid"},
			BroadcastChannelID: "nonemptychannelid",
			InviteUsersEnabled: false,
			InvitedUserIDs:     []string{"testInvitedUserID1", "testInvitedUserID2"},
			InvitedGroupIDs:    []string{"testInvitedGroupID1", "testInvitedGroupID2"},
			SignalAnyKeywords:  []string{},
		}

		testrecorder := httptest.NewRecorder()
		testreq, err := http.NewRequest("PUT", "/api/v0/playbooks/testplaybookid", jsonPlaybookReader(playbook))
		testreq.Header.Add("Mattermost-User-ID", "testuserid")
		require.NoError(t, err)

		playbookService.EXPECT().
			Get("testplaybookid").
			Return(playbook, nil).
			Times(1)

		playbook.ID = "testplaybookid"
		playbook.InvitedGroupIDs = []string{"testInvitedGroupID1"}

		playbookService.EXPECT().
			Update(playbook, "testuserid").
			Return(nil).
			Times(1)

		pluginAPI.On("HasPermissionToTeam", "testInvitedUserID1", "testteamid", model.PERMISSION_VIEW_TEAM).Return(true)
		pluginAPI.On("HasPermissionToTeam", "testInvitedUserID2", "testteamid", model.PERMISSION_VIEW_TEAM).Return(true)
		pluginAPI.On("GetGroup", "testInvitedGroupID1").Return(&model.Group{
			Id:             "testInvitedGroupID1",
			AllowReference: true,
		}, nil)
		pluginAPI.On("GetGroup", "testInvitedGroupID2").Return(&model.Group{
			Id:             "testInvitedGroupID2",
			AllowReference: false,
		}, nil)
		pluginAPI.On("HasPermissionToTeam", "testuserid", "testteamid", model.PERMISSION_VIEW_TEAM).Return(true)
		pluginAPI.On("HasPermissionTo", "testuserid", model.PERMISSION_MANAGE_SYSTEM).Return(true)
		pluginAPI.On("LogWarn", "group does not allow references, removing from automated invite list", "group_id", "testInvitedGroupID2")

		handler.ServeHTTP(testrecorder, testreq)

		resp := testrecorder.Result()
		assert.Equal(t, http.StatusOK, resp.StatusCode)
	})

	t.Run("delete playbook", func(t *testing.T) {
		reset(t)

		playbookService.EXPECT().
			Get("testplaybookid").
			Return(withMember, nil).
			Times(1)

		playbookService.EXPECT().
			Delete(withMember, "testuserid").
			Return(nil).
			Times(1)

		poster.EXPECT().
			PublishWebsocketEventToTeam("playbook_deleted", map[string]interface{}{
				"teamID": playbooktest.TeamID,
			}, playbooktest.TeamID)

		pluginAPI.On("HasPermissionToTeam", "testuserid", "testteamid", model.PERMISSION_VIEW_TEAM).Return(true)
		pluginAPI.On("HasPermissionTo", "testuserid", model.PERMISSION_MANAGE_SYSTEM).Return(true)

		err := c.Playbooks.Delete(context.TODO(), "testplaybookid")
		require.NoError(t, err)
	})

	t.Run("delete playbook no team permission", func(t *testing.T) {
		reset(t)
		logger.EXPECT().Warnf(gomock.Any(), gomock.Any(), gomock.Any())

		playbookService.EXPECT().
			Get("testplaybookid").
			Return(withid, nil).
			Times(1)

		pluginAPI.On("HasPermissionToTeam", "testuserid", "testteamid", model.PERMISSION_VIEW_TEAM).Return(false)

		err := c.Playbooks.Delete(context.TODO(), "testplaybookid")
		requireErrorWithStatusCode(t, err, http.StatusForbidden)
	})

	t.Run("create playbook no team permission", func(t *testing.T) {
		reset(t)
		logger.EXPECT().Warnf(gomock.Any(), gomock.Any(), gomock.Any())

		pluginAPI.On("HasPermissionToTeam", "testuserid", "testteamid", model.PERMISSION_VIEW_TEAM).Return(false)
		pluginAPI.On("GetUser", "testuserid").Return(&model.User{}, nil)

		resultPlaybook, err := c.Playbooks.Create(context.TODO(), icClient.PlaybookCreateOptions{
			Title:          playbooktest.Title,
			TeamID:         playbooktest.TeamID,
			Checklists:     toAPIChecklists(playbooktest.Checklists),
			MemberIDs:      playbooktest.MemberIDs,
			InvitedUserIDs: playbooktest.InvitedUserIDs,
		})
		requireErrorWithStatusCode(t, err, http.StatusForbidden)
		assert.Nil(t, resultPlaybook)
	})

	t.Run("get playbook no team permission", func(t *testing.T) {
		reset(t)
		logger.EXPECT().Warnf(gomock.Any(), gomock.Any(), gomock.Any())

		playbookService.EXPECT().
			Get("testplaybookid").
			Return(withid, nil).
			Times(1)

		pluginAPI.On("HasPermissionToTeam", "testuserid", "testteamid", model.PERMISSION_VIEW_TEAM).Return(false)

		result, err := c.Playbooks.Get(context.TODO(), "testplaybookid")
		requireErrorWithStatusCode(t, err, http.StatusForbidden)
		assert.Nil(t, result)
	})

	t.Run("get playbooks no team permission", func(t *testing.T) {
		reset(t)
		logger.EXPECT().Warnf(gomock.Any(), gomock.Any(), gomock.Any())

		pluginAPI.On("HasPermissionToTeam", "testuserid", "testteamid", model.PERMISSION_VIEW_TEAM).Return(false)

		actualList, err := c.Playbooks.List(context.TODO(), "testteamid", 0, 100, icClient.PlaybookListOptions{})
		requireErrorWithStatusCode(t, err, http.StatusForbidden)
		assert.Empty(t, actualList)
	})

	t.Run("update playbooks no team permission", func(t *testing.T) {
		reset(t)
		logger.EXPECT().Warnf(gomock.Any(), gomock.Any(), gomock.Any())

		playbookService.EXPECT().
			Get("testplaybookid").
			Return(withid, nil).
			Times(1)

		pluginAPI.On("HasPermissionToTeam", "testuserid", "testteamid", model.PERMISSION_VIEW_TEAM).Return(false)

		err := c.Playbooks.Update(context.TODO(), toAPIPlaybook(withid))
		requireErrorWithStatusCode(t, err, http.StatusForbidden)
	})

	t.Run("get playbook by member", func(t *testing.T) {
		reset(t)

		pluginAPI.On("HasPermissionToTeam", "testuserid", "testteamid", model.PERMISSION_VIEW_TEAM).Return(true)
		pluginAPI.On("HasPermissionTo", "testuserid", model.PERMISSION_MANAGE_SYSTEM).Return(false)

		playbookService.EXPECT().
			Get("playbookwithmember").
			Return(withMember, nil).
			Times(1)

		result, err := c.Playbooks.Get(context.TODO(), "playbookwithmember")
		require.NoError(t, err)
		assert.Equal(t, withMember, toInternalPlaybook(*result))
	})

	t.Run("get playbook by non-member", func(t *testing.T) {
		reset(t)
		logger.EXPECT().Warnf(gomock.Any(), gomock.Any(), gomock.Any())
		mattermostUserID = "unknownMember"

		pluginAPI.On("HasPermissionToTeam", "unknownMember", "testteamid", model.PERMISSION_VIEW_TEAM).Return(true)
		pluginAPI.On("HasPermissionTo", "unknownMember", model.PERMISSION_MANAGE_SYSTEM).Return(false)

		playbookService.EXPECT().
			Get("playbookwithmember").
			Return(withMember, nil).
			Times(1)

		result, err := c.Playbooks.Get(context.TODO(), "playbookwithmember")
		requireErrorWithStatusCode(t, err, http.StatusForbidden)
		assert.Nil(t, result)
	})

	t.Run("update playbook by member", func(t *testing.T) {
		reset(t)

		playbookService.EXPECT().
			Get("playbookwithmember").
			Return(withMember, nil).
			Times(1)

		updatedPlaybook := playbooktest
		updatedPlaybook.ID = "playbookwithmember"

		playbookService.EXPECT().
			Update(updatedPlaybook, "testuserid").
			Return(nil).
			Times(1)

		pluginAPI.On("HasPermissionToTeam", "testuserid", "testteamid", model.PERMISSION_VIEW_TEAM).Return(true)
		pluginAPI.On("HasPermissionTo", "testuserid", model.PERMISSION_MANAGE_SYSTEM).Return(false)

		err := c.Playbooks.Update(context.TODO(), toAPIPlaybook(updatedPlaybook))
		require.NoError(t, err)
	})

	t.Run("update playbook by non-member", func(t *testing.T) {
		reset(t)
		logger.EXPECT().Warnf(gomock.Any(), gomock.Any(), gomock.Any())
		mattermostUserID = "unknownMember"

		playbookService.EXPECT().
			Get("playbookwithmember").
			Return(withMember, nil).
			Times(1)

		updatedPlaybook := playbooktest
		updatedPlaybook.ID = "playbookwithmember"

		playbookService.EXPECT().
			Update(updatedPlaybook, "testUserID").
			Return(nil).
			Times(1)

		pluginAPI.On("HasPermissionToTeam", "unknownMember", "testteamid", model.PERMISSION_VIEW_TEAM).Return(true)
		pluginAPI.On("HasPermissionTo", "unknownMember", model.PERMISSION_MANAGE_SYSTEM).Return(false)

		err := c.Playbooks.Update(context.TODO(), toAPIPlaybook(updatedPlaybook))
		requireErrorWithStatusCode(t, err, http.StatusForbidden)
	})

	t.Run("delete playbook by member", func(t *testing.T) {
		reset(t)

		playbookService.EXPECT().
			Get("playbookwithmember").
			Return(withMember, nil).
			Times(1)

		playbookService.EXPECT().
			Delete(withMember, "testuserid").
			Return(nil).
			Times(1)

		poster.EXPECT().
			PublishWebsocketEventToTeam("playbook_deleted", map[string]interface{}{
				"teamID": playbooktest.TeamID,
			}, playbooktest.TeamID)

		pluginAPI.On("HasPermissionToTeam", "testuserid", "testteamid", model.PERMISSION_VIEW_TEAM).Return(true)
		pluginAPI.On("HasPermissionTo", "testuserid", model.PERMISSION_MANAGE_SYSTEM).Return(false)

		err := c.Playbooks.Delete(context.TODO(), "playbookwithmember")
		require.NoError(t, err)
	})

	t.Run("delete playbook by non-member", func(t *testing.T) {
		reset(t)
		logger.EXPECT().Warnf(gomock.Any(), gomock.Any(), gomock.Any())
		mattermostUserID = "unknownMember"

		playbookService.EXPECT().
			Get("playbookwithmember").
			Return(withMember, nil).
			Times(1)

		pluginAPI.On("HasPermissionToTeam", "unknownMember", "testteamid", model.PERMISSION_VIEW_TEAM).Return(true)
		pluginAPI.On("HasPermissionTo", "unknownMember", model.PERMISSION_MANAGE_SYSTEM).Return(false)

		err := c.Playbooks.Delete(context.TODO(), "playbookwithmember")
		requireErrorWithStatusCode(t, err, http.StatusForbidden)
	})

	t.Run("get playbooks with members", func(t *testing.T) {
		reset(t)

		playbookResult := struct {
			TotalCount int            `json:"total_count"`
			PageCount  int            `json:"page_count"`
			HasMore    bool           `json:"has_more"`
			Items      []app.Playbook `json:"items"`
		}{
			TotalCount: 1,
			PageCount:  1,
			HasMore:    false,
			Items:      []app.Playbook{withMember},
		}

		playbookService.EXPECT().
			GetPlaybooksForTeam(
				app.RequesterInfo{
					UserID:  "testuserid",
					TeamID:  "testteamid",
					IsAdmin: false,
				},
				"testteamid",
				gomock.Any(),
			).
			Return(playbookResult, nil).
			Times(1)

		pluginAPI.On("HasPermissionToTeam", "testuserid", "testteamid", model.PERMISSION_VIEW_TEAM).Return(true)
		pluginAPI.On("HasPermissionTo", "testuserid", model.PERMISSION_MANAGE_SYSTEM).Return(false)
		pluginAPI.On("GetUser", "testuserid").Return(&model.User{}, nil)

		actualList, err := c.Playbooks.List(context.TODO(), "testteamid", 0, 100, icClient.PlaybookListOptions{})
		require.NoError(t, err)

		expectedList := &icClient.GetPlaybooksResults{
			TotalCount: 1,
			PageCount:  1,
			HasMore:    false,
			Items:      []icClient.Playbook{toAPIPlaybook(withMember)},
		}
		assert.Equal(t, expectedList, actualList)
	})
}

func TestSortingPlaybooks(t *testing.T) {
	playbooktest1 := app.Playbook{
		Title:   "A",
		TeamID:  "testteamid",
		NumRuns: 0,
		Checklists: []app.Checklist{
			{
				Title: "A",
				Items: []app.ChecklistItem{
					{
						Title: "Do this1",
					},
				},
			},
		},
	}
	playbooktest2 := app.Playbook{
		Title:   "B",
		TeamID:  "testteamid",
		NumRuns: 1,
		Checklists: []app.Checklist{
			{
				Title: "B",
				Items: []app.ChecklistItem{
					{
						Title: "Do this1",
					},
					{
						Title: "Do this2",
					},
				},
			},
			{
				Title: "B",
				Items: []app.ChecklistItem{
					{
						Title: "Do this1",
					},
					{
						Title: "Do this2",
					},
				},
			},
		},
	}
	playbooktest3 := app.Playbook{
		Title:   "C",
		TeamID:  "testteamid",
		NumRuns: 2,
		Checklists: []app.Checklist{
			{
				Title: "C",
				Items: []app.ChecklistItem{
					{
						Title: "Do this1",
					},
					{
						Title: "Do this2",
					},
					{
						Title: "Do this3",
					},
				},
			},
			{
				Title: "C",
				Items: []app.ChecklistItem{
					{
						Title: "Do this1",
					},
					{
						Title: "Do this2",
					},
					{
						Title: "Do this3",
					},
				},
			},
			{
				Title: "C",
				Items: []app.ChecklistItem{
					{
						Title: "Do this1",
					},
					{
						Title: "Do this2",
					},
					{
						Title: "Do this3",
					},
				},
			},
		},
	}

	var mockCtrl *gomock.Controller
	var handler *Handler
	var logger *mock_poster.MockLogger
	var configService *mock_config.MockService
	var playbookService *mock_app.MockPlaybookService
	var pluginAPI *plugintest.API
	var client *pluginapi.Client

	// mattermostHandler simulates the Mattermost server routing HTTP requests to a plugin.
	mattermostHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		r.URL.Path = strings.TrimPrefix(r.URL.Path, "/plugins/com.mattermost.plugin-incident-management")
		r.Header.Add("Mattermost-User-ID", "testuserid")

		handler.ServeHTTP(w, r)
	})

	server := httptest.NewServer(mattermostHandler)
	t.Cleanup(server.Close)

	c, err := icClient.New(&model.Client4{Url: server.URL})
	require.NoError(t, err)

	reset := func(t *testing.T) {
		t.Helper()

		mockCtrl = gomock.NewController(t)
		configService = mock_config.NewMockService(mockCtrl)
		pluginAPI = &plugintest.API{}
		client = pluginapi.NewClient(pluginAPI, &plugintest.Driver{})
		logger = mock_poster.NewMockLogger(mockCtrl)
		handler = NewHandler(client, configService, logger)
		playbookService = mock_app.NewMockPlaybookService(mockCtrl)
		logger = mock_poster.NewMockLogger(mockCtrl)
		NewPlaybookHandler(handler.APIRouter, playbookService, client, logger, configService)
	}

	testData := []struct {
		testName           string
		sortField          icClient.Sort
		sortDirection      icClient.SortDirection
		expectedList       []app.Playbook
		expectedErr        error
		expectedStatusCode int
	}{
		{
			testName:           "get playbooks with invalid sort field",
			sortField:          "test",
			sortDirection:      "",
			expectedList:       nil,
			expectedErr:        errors.New("bad parameter 'sort' (test)"),
			expectedStatusCode: http.StatusBadRequest,
		},
		{
			testName:           "get playbooks with invalid sort direction",
			sortField:          "",
			sortDirection:      "test",
			expectedList:       nil,
			expectedErr:        errors.New("bad parameter 'direction' (test)"),
			expectedStatusCode: http.StatusBadRequest,
		},
		{
			testName:           "get playbooks with no sort fields",
			sortField:          "",
			sortDirection:      "",
			expectedList:       []app.Playbook{playbooktest1, playbooktest2, playbooktest3},
			expectedErr:        nil,
			expectedStatusCode: http.StatusOK,
		},
		{
			testName:           "get playbooks with sort=title direction=asc",
			sortField:          icClient.SortByTitle,
			sortDirection:      "asc",
			expectedList:       []app.Playbook{playbooktest1, playbooktest2, playbooktest3},
			expectedErr:        nil,
			expectedStatusCode: http.StatusOK,
		},
		{
			testName:           "get playbooks with sort=title direction=desc",
			sortField:          icClient.SortByTitle,
			sortDirection:      "desc",
			expectedList:       []app.Playbook{playbooktest3, playbooktest2, playbooktest1},
			expectedErr:        nil,
			expectedStatusCode: http.StatusOK,
		},
		{
			testName:           "get playbooks with sort=stages direction=asc",
			sortField:          icClient.SortByStages,
			sortDirection:      "asc",
			expectedList:       []app.Playbook{playbooktest1, playbooktest2, playbooktest3},
			expectedErr:        nil,
			expectedStatusCode: http.StatusOK,
		},
		{
			testName:           "get playbooks with sort=stages direction=desc",
			sortField:          icClient.SortByStages,
			sortDirection:      "desc",
			expectedList:       []app.Playbook{playbooktest3, playbooktest2, playbooktest1},
			expectedErr:        nil,
			expectedStatusCode: http.StatusOK,
		},
		{
			testName:           "get playbooks with sort=steps direction=asc",
			sortField:          icClient.SortBySteps,
			sortDirection:      "asc",
			expectedList:       []app.Playbook{playbooktest1, playbooktest2, playbooktest3},
			expectedErr:        nil,
			expectedStatusCode: http.StatusOK,
		},
		{
			testName:           "get playbooks with sort=steps direction=desc",
			sortField:          icClient.SortBySteps,
			sortDirection:      "desc",
			expectedList:       []app.Playbook{playbooktest3, playbooktest2, playbooktest1},
			expectedErr:        nil,
			expectedStatusCode: http.StatusOK,
		},
		{
			testName:           "get playbooks with sort=runs direction=asc",
			sortField:          icClient.SortByRuns,
			sortDirection:      "asc",
			expectedList:       []app.Playbook{playbooktest1, playbooktest2, playbooktest3},
			expectedErr:        nil,
			expectedStatusCode: http.StatusOK,
		},
		{
			testName:           "get playbooks with sort=runs direction=desc",
			sortField:          icClient.SortByRuns,
			sortDirection:      "desc",
			expectedList:       []app.Playbook{playbooktest3, playbooktest2, playbooktest1},
			expectedErr:        nil,
			expectedStatusCode: http.StatusOK,
		},
	}

	for _, data := range testData {
		t.Run(data.testName, func(t *testing.T) {
			reset(t)

			if data.expectedErr != nil {
				logger.EXPECT().Warnf(gomock.Any(), gomock.Any(), gomock.Any())
			}

			playbookResult := struct {
				TotalCount int            `json:"total_count"`
				PageCount  int            `json:"page_count"`
				HasMore    bool           `json:"has_more"`
				Items      []app.Playbook `json:"items"`
			}{
				TotalCount: 3,
				PageCount:  1,
				HasMore:    false,
				Items:      data.expectedList,
			}

			playbookService.EXPECT().
				GetPlaybooksForTeam(
					app.RequesterInfo{
						UserID:  "testuserid",
						TeamID:  "testteamid",
						IsAdmin: true,
					},
					"testteamid",
					gomock.Any(),
				).
				Return(playbookResult, nil).
				Times(1)

			pluginAPI.On("HasPermissionToTeam", "testuserid", "testteamid", model.PERMISSION_VIEW_TEAM).Return(true)
			pluginAPI.On("HasPermissionTo", "testuserid", model.PERMISSION_MANAGE_SYSTEM).Return(true)
			pluginAPI.On("GetUser", "testuserid").Return(&model.User{}, nil)

			actualList, err := c.Playbooks.List(context.TODO(), "testteamid", 0, 100, icClient.PlaybookListOptions{
				Sort:      data.sortField,
				Direction: data.sortDirection,
			})

			expectedList := &icClient.GetPlaybooksResults{
				TotalCount: playbookResult.TotalCount,
				PageCount:  playbookResult.PageCount,
				HasMore:    playbookResult.HasMore,
				Items:      toAPIPlaybooks(playbookResult.Items),
			}

			if data.expectedErr == nil {
				require.NoError(t, err)
				assert.Equal(t, expectedList, actualList)
			} else {
				requireErrorWithStatusCode(t, err, data.expectedStatusCode)
				assert.Contains(t, err.Error(), data.expectedErr.Error())
				require.Empty(t, actualList)
			}
		})
	}
}

func TestPagingPlaybooks(t *testing.T) {
	playbooktest1 := app.Playbook{
		Title:           "A",
		TeamID:          "testteamid",
		Checklists:      []app.Checklist{},
		MemberIDs:       []string{},
		InvitedUserIDs:  []string{},
		InvitedGroupIDs: []string{},
	}
	playbooktest2 := app.Playbook{
		Title:           "B",
		TeamID:          "testteamid",
		Checklists:      []app.Checklist{},
		MemberIDs:       []string{},
		InvitedUserIDs:  []string{},
		InvitedGroupIDs: []string{},
	}
	playbooktest3 := app.Playbook{
		Title:           "C",
		TeamID:          "testteamid",
		Checklists:      []app.Checklist{},
		MemberIDs:       []string{},
		InvitedUserIDs:  []string{},
		InvitedGroupIDs: []string{},
	}

	var mockCtrl *gomock.Controller
	var handler *Handler
	var configService *mock_config.MockService
	var logger *mock_poster.MockLogger
	var playbookService *mock_app.MockPlaybookService
	var pluginAPI *plugintest.API
	var client *pluginapi.Client

	// mattermostHandler simulates the Mattermost server routing HTTP requests to a plugin.
	mattermostHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		r.URL.Path = strings.TrimPrefix(r.URL.Path, "/plugins/com.mattermost.plugin-incident-management")
		r.Header.Add("Mattermost-User-ID", "testuserid")

		handler.ServeHTTP(w, r)
	})

	server := httptest.NewServer(mattermostHandler)
	t.Cleanup(server.Close)

	c, err := icClient.New(&model.Client4{Url: server.URL})
	require.NoError(t, err)

	reset := func(t *testing.T) {
		t.Helper()

		mockCtrl = gomock.NewController(t)
		configService = mock_config.NewMockService(mockCtrl)
		pluginAPI = &plugintest.API{}
		client = pluginapi.NewClient(pluginAPI, &plugintest.Driver{})
		logger = mock_poster.NewMockLogger(mockCtrl)
		handler = NewHandler(client, configService, logger)
		playbookService = mock_app.NewMockPlaybookService(mockCtrl)
		NewPlaybookHandler(handler.APIRouter, playbookService, client, logger, configService)
	}

	testData := []struct {
		testName           string
		page               int
		perPage            int
		expectedResult     app.GetPlaybooksResults
		emptyStore         bool
		expectedErr        error
		expectedStatusCode int
	}{
		{
			testName:           "get playbooks with negative page values",
			page:               -1,
			perPage:            -1,
			expectedResult:     app.GetPlaybooksResults{},
			expectedErr:        errors.New("bad parameter"),
			expectedStatusCode: http.StatusBadRequest,
		},
		{
			testName: "get playbooks with page=0 per_page=0 with empty store",
			page:     0,
			perPage:  0,
			expectedResult: app.GetPlaybooksResults{
				TotalCount: 0,
				PageCount:  0,
				HasMore:    false,
				Items:      []app.Playbook{},
			},
			emptyStore:         true,
			expectedErr:        nil,
			expectedStatusCode: http.StatusOK,
		},
		{
			testName: "get playbooks with page=1 per_page=1 with empty store",
			page:     1,
			perPage:  1,
			expectedResult: app.GetPlaybooksResults{
				TotalCount: 0,
				PageCount:  0,
				HasMore:    false,
				Items:      []app.Playbook{},
			},
			emptyStore:         true,
			expectedErr:        nil,
			expectedStatusCode: http.StatusOK,
		},
		{
			testName: "get playbooks with page=0 per_page=0",
			page:     0,
			perPage:  0,
			expectedResult: app.GetPlaybooksResults{
				TotalCount: 3,
				PageCount:  1,
				HasMore:    false,
				Items:      []app.Playbook{playbooktest1, playbooktest2, playbooktest3},
			},
			expectedErr:        nil,
			expectedStatusCode: http.StatusOK,
		},
		{
			testName: "get playbooks with page=0 per_page=3",
			page:     0,
			perPage:  3,
			expectedResult: app.GetPlaybooksResults{
				TotalCount: 3,
				PageCount:  1,
				HasMore:    false,
				Items:      []app.Playbook{playbooktest1, playbooktest2, playbooktest3},
			},
			expectedErr:        nil,
			expectedStatusCode: http.StatusOK,
		},
		{
			testName: "get playbooks with page=0 per_page=2",
			page:     0,
			perPage:  2,
			expectedResult: app.GetPlaybooksResults{
				TotalCount: 3,
				PageCount:  2,
				HasMore:    true,
				Items:      []app.Playbook{playbooktest1, playbooktest2},
			},
			expectedErr:        nil,
			expectedStatusCode: http.StatusOK,
		},
		{
			testName: "get playbooks with page=1 per_page=2",
			page:     1,
			perPage:  2,
			expectedResult: app.GetPlaybooksResults{
				TotalCount: 3,
				PageCount:  2,
				HasMore:    false,
				Items:      []app.Playbook{playbooktest3},
			},
			expectedErr:        nil,
			expectedStatusCode: http.StatusOK,
		},
		{
			testName: "get playbooks with page=2 per_page=2",
			page:     2,
			perPage:  2,
			expectedResult: app.GetPlaybooksResults{
				TotalCount: 3,
				PageCount:  2,
				HasMore:    false,
				Items:      []app.Playbook{},
			},
			expectedErr:        nil,
			expectedStatusCode: http.StatusOK,
		},
		{
			testName: "get playbooks with page=9999 per_page=2",
			page:     9999,
			perPage:  2,
			expectedResult: app.GetPlaybooksResults{
				TotalCount: 3,
				PageCount:  2,
				HasMore:    false,
				Items:      []app.Playbook{},
			},
			expectedErr:        nil,
			expectedStatusCode: http.StatusOK,
		},
	}

	for _, data := range testData {
		t.Run(data.testName, func(t *testing.T) {
			reset(t)

			if data.expectedErr != nil {
				logger.EXPECT().Warnf(gomock.Any(), gomock.Any(), gomock.Any())
			}

			playbookService.EXPECT().
				GetPlaybooksForTeam(
					app.RequesterInfo{
						UserID:  "testuserid",
						TeamID:  "testteamid",
						IsAdmin: true,
					},
					"testteamid",
					gomock.Any(),
				).
				Return(data.expectedResult, nil).
				Times(1)

			pluginAPI.On("HasPermissionToTeam", "testuserid", "testteamid", model.PERMISSION_VIEW_TEAM).Return(true)
			pluginAPI.On("HasPermissionTo", "testuserid", model.PERMISSION_MANAGE_SYSTEM).Return(true)
			pluginAPI.On("GetUser", "testuserid").Return(&model.User{}, nil)

			actualList, err := c.Playbooks.List(context.TODO(), "testteamid", data.page, data.perPage, icClient.PlaybookListOptions{})

			expectedList := &icClient.GetPlaybooksResults{
				TotalCount: data.expectedResult.TotalCount,
				PageCount:  data.expectedResult.PageCount,
				HasMore:    data.expectedResult.HasMore,
				Items:      toAPIPlaybooks(data.expectedResult.Items),
			}

			if data.expectedErr == nil {
				require.NoError(t, err)
				assert.Equal(t, expectedList, actualList)
			} else {
				requireErrorWithStatusCode(t, err, data.expectedStatusCode)
				assert.Contains(t, err.Error(), data.expectedErr.Error())
				require.Empty(t, actualList)
			}
		})
	}
}
