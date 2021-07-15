package sqlstore

import (
	"fmt"
	"math/rand"
	"sort"
	"strings"
	"testing"
	"time"

	sq "github.com/Masterminds/squirrel"
	"github.com/golang/mock/gomock"
	"github.com/jmoiron/sqlx"
	"github.com/mattermost/mattermost-plugin-incident-collaboration/server/app"
	mock_sqlstore "github.com/mattermost/mattermost-plugin-incident-collaboration/server/sqlstore/mocks"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/pkg/errors"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGetPlaybookRuns(t *testing.T) {
	team1id := model.NewId()
	team2id := model.NewId()
	team3id := model.NewId()

	owner1 := app.OwnerInfo{
		UserID:   model.NewId(),
		Username: "Owner 1",
	}
	owner2 := app.OwnerInfo{
		UserID:   model.NewId(),
		Username: "Owner 2",
	}
	owner3 := app.OwnerInfo{
		UserID:   model.NewId(),
		Username: "Owner 3",
	}
	owner4 := app.OwnerInfo{
		UserID:   model.NewId(),
		Username: "Owner 4",
	}

	lucy := userInfo{
		ID:   model.NewId(),
		Name: "Lucy",
	}

	bob := userInfo{
		ID:   model.NewId(),
		Name: "bob",
	}

	john := userInfo{
		ID:   model.NewId(),
		Name: "john",
	}

	jane := userInfo{
		ID:   model.NewId(),
		Name: "jane",
	}

	alice := userInfo{
		ID:   model.NewId(),
		Name: "alice",
	}

	charlotte := userInfo{
		ID:   model.NewId(),
		Name: "Charlotte",
	}

	channel01 := model.Channel{Id: model.NewId(), Type: "O", CreateAt: 123, DeleteAt: 0}
	channel02 := model.Channel{Id: model.NewId(), Type: "O", CreateAt: 199, DeleteAt: 0}
	channel03 := model.Channel{Id: model.NewId(), Type: "O", CreateAt: 222, DeleteAt: 0}
	channel04 := model.Channel{Id: model.NewId(), Type: "P", CreateAt: 333, DeleteAt: 0}
	channel05 := model.Channel{Id: model.NewId(), Type: "P", CreateAt: 400, DeleteAt: 0}
	channel06 := model.Channel{Id: model.NewId(), Type: "O", CreateAt: 444, DeleteAt: 0}
	channel07 := model.Channel{Id: model.NewId(), Type: "P", CreateAt: 555, DeleteAt: 0}
	channel08 := model.Channel{Id: model.NewId(), Type: "P", CreateAt: 555, DeleteAt: 0}
	channel09 := model.Channel{Id: model.NewId(), Type: "P", CreateAt: 556, DeleteAt: 0}

	inc01 := *NewBuilder(nil).
		WithName("pr 1 - wheel cat aliens wheelbarrow").
		WithDescription("this is a description, not very long, but it can be up to 2048 bytes").
		WithChannel(&channel01). // public
		WithOwnerUserID(owner1.UserID).
		WithTeamID(team1id).
		WithCreateAt(123).
		WithChecklists([]int{8}).
		WithPlaybookID("playbook1").
		WithParticipant(bob).
		WithParticipant(john).
		ToPlaybookRun()

	inc02 := *NewBuilder(nil).
		WithName("pr 2 - horse staple battery aliens shotgun mouse shotput").
		WithChannel(&channel02). // public
		WithOwnerUserID(owner2.UserID).
		WithTeamID(team1id).
		WithCreateAt(199).
		WithChecklists([]int{7}).
		WithPlaybookID("playbook1").
		WithParticipant(bob).
		WithParticipant(john).
		ToPlaybookRun()

	inc03 := *NewBuilder(nil).
		WithName("pr 3 - Horse stapler battery shotgun mouse shotput").
		WithChannel(&channel03). // public
		WithOwnerUserID(owner1.UserID).
		WithTeamID(team1id).
		WithCreateAt(222).
		WithChecklists([]int{6}).
		WithCurrentStatus("Archived").
		WithPlaybookID("playbook2").
		WithParticipant(bob).
		WithParticipant(john).
		WithParticipant(jane).
		ToPlaybookRun()

	inc04 := *NewBuilder(nil).
		WithName("pr 4 - titanic terminatoraliens").
		WithChannel(&channel04). // private
		WithOwnerUserID(owner3.UserID).
		WithTeamID(team1id).
		WithCreateAt(333).
		WithChecklists([]int{5}).
		WithCurrentStatus("Archived").
		WithParticipant(bob).
		WithParticipant(jane).
		ToPlaybookRun()

	inc05 := *NewBuilder(nil).
		WithName("pr 5 - titanic terminator aliens mouse").
		WithChannel(&channel05). // private
		WithOwnerUserID(owner3.UserID).
		WithTeamID(team1id).
		WithCreateAt(400).
		WithChecklists([]int{1}).
		WithParticipant(bob).
		WithParticipant(jane).
		ToPlaybookRun()

	inc06 := *NewBuilder(nil).
		WithName("pr 6 - ubik high castle electric sheep").
		WithChannel(&channel06). // public
		WithOwnerUserID(owner3.UserID).
		WithTeamID(team2id).
		WithCreateAt(444).
		WithChecklists([]int{4}).
		WithParticipant(bob).
		ToPlaybookRun()

	inc07 := *NewBuilder(nil).
		WithName("pr 7 - ubik high castle electric sheep").
		WithChannel(&channel07). // private
		WithOwnerUserID(owner3.UserID).
		WithTeamID(team2id).
		WithCreateAt(555).
		WithChecklists([]int{4}).
		WithParticipant(bob).
		ToPlaybookRun()

	inc08 := *NewBuilder(nil).
		WithName("pr 8 - ziggürat!").
		WithChannel(&channel08). // private
		WithOwnerUserID(owner4.UserID).
		WithTeamID(team3id).
		WithCreateAt(555).
		WithChecklists([]int{3}).
		WithParticipant(bob).
		ToPlaybookRun()

	inc09 := *NewBuilder(nil).
		WithName("pr 9 - Ziggürat!").
		WithChannel(&channel09). // private
		WithOwnerUserID(owner4.UserID).
		WithTeamID(team3id).
		WithCreateAt(556).
		WithChecklists([]int{2}).
		WithParticipant(bob).
		ToPlaybookRun()

	playbookRuns := []app.PlaybookRun{inc01, inc02, inc03, inc04, inc05, inc06, inc07, inc08, inc09}

	createPlaybookRuns := func(store *SQLStore, playbookRunStore app.PlaybookRunStore) {
		t.Helper()

		createdPlaybookRuns := make([]app.PlaybookRun, len(playbookRuns))

		for i := range playbookRuns {
			createdPlaybookRun, err := playbookRunStore.CreatePlaybookRun(&playbookRuns[i])
			require.NoError(t, err)

			createdPlaybookRuns[i] = *createdPlaybookRun
		}
	}

	testData := []struct {
		Name          string
		RequesterInfo app.RequesterInfo
		Options       app.PlaybookRunFilterOptions
		Want          app.GetPlaybookRunsResults
		ExpectedErr   error
	}{
		{
			Name: "no options - team1 - admin",
			RequesterInfo: app.RequesterInfo{
				UserID:  lucy.ID,
				IsAdmin: true,
			},
			Options: app.PlaybookRunFilterOptions{
				TeamID:    team1id,
				Sort:      app.SortByCreateAt,
				Direction: app.DirectionAsc,
				Page:      0,
				PerPage:   1000,
			},
			Want: app.GetPlaybookRunsResults{
				TotalCount: 5,
				PageCount:  1,
				HasMore:    false,
				Items:      []app.PlaybookRun{inc01, inc02, inc03, inc04, inc05},
			},
			ExpectedErr: nil,
		},
		{
			Name: "no options - team1 - guest - no channels",
			RequesterInfo: app.RequesterInfo{
				UserID:  lucy.ID,
				IsGuest: true,
			},
			Options: app.PlaybookRunFilterOptions{
				TeamID:    team1id,
				Sort:      app.SortByCreateAt,
				Direction: app.DirectionAsc,
				Page:      0,
				PerPage:   1000,
			},
			Want: app.GetPlaybookRunsResults{
				TotalCount: 0,
				PageCount:  0,
				HasMore:    false,
				Items:      []app.PlaybookRun{},
			},
			ExpectedErr: nil,
		},
		{
			Name: "no options - team1 - guest - has channels",
			RequesterInfo: app.RequesterInfo{
				UserID:  john.ID,
				IsGuest: true,
			},
			Options: app.PlaybookRunFilterOptions{
				TeamID:    team1id,
				Sort:      app.SortByCreateAt,
				Direction: app.DirectionAsc,
				Page:      0,
				PerPage:   1000,
			},
			Want: app.GetPlaybookRunsResults{
				TotalCount: 3,
				PageCount:  1,
				HasMore:    false,
				Items:      []app.PlaybookRun{inc01, inc02, inc03},
			},
			ExpectedErr: nil,
		},
		{
			Name: "team1 - desc - admin",
			RequesterInfo: app.RequesterInfo{
				UserID:  lucy.ID,
				IsAdmin: true,
			},
			Options: app.PlaybookRunFilterOptions{
				TeamID:    team1id,
				Sort:      app.SortByCreateAt,
				Direction: app.DirectionDesc,
				Page:      0,
				PerPage:   1000,
			},
			Want: app.GetPlaybookRunsResults{
				TotalCount: 5,
				PageCount:  1,
				HasMore:    false,
				Items:      []app.PlaybookRun{inc05, inc04, inc03, inc02, inc01},
			},
			ExpectedErr: nil,
		},
		{
			Name: "team2 - sort by CreateAt desc - admin",
			RequesterInfo: app.RequesterInfo{
				UserID:  lucy.ID,
				IsAdmin: true,
			},
			Options: app.PlaybookRunFilterOptions{
				TeamID:    team2id,
				Sort:      app.SortByCreateAt,
				Direction: app.DirectionDesc,
				Page:      0,
				PerPage:   1000,
			},
			Want: app.GetPlaybookRunsResults{
				TotalCount: 2,
				PageCount:  1,
				HasMore:    false,
				Items:      []app.PlaybookRun{inc07, inc06},
			},
			ExpectedErr: nil,
		},
		{
			Name: "no paging, team3, sort by Name",
			RequesterInfo: app.RequesterInfo{
				UserID:  lucy.ID,
				IsAdmin: true,
			},
			Options: app.PlaybookRunFilterOptions{
				TeamID:    team3id,
				Sort:      app.SortByName,
				Direction: app.DirectionAsc,
				Page:      0,
				PerPage:   1000,
			},
			Want: app.GetPlaybookRunsResults{
				TotalCount: 2,
				PageCount:  1,
				HasMore:    false,
				Items:      []app.PlaybookRun{inc08, inc09},
			},
			ExpectedErr: nil,
		},
		{
			Name: "no options, team paged by 1, admin",
			RequesterInfo: app.RequesterInfo{
				UserID:  lucy.ID,
				IsAdmin: true,
			},
			Options: app.PlaybookRunFilterOptions{
				TeamID:    team1id,
				Sort:      app.SortByCreateAt,
				Direction: app.DirectionAsc,
				Page:      0,
				PerPage:   1,
			},
			Want: app.GetPlaybookRunsResults{
				TotalCount: 5,
				PageCount:  5,
				HasMore:    true,
				Items:      []app.PlaybookRun{inc01},
			},
			ExpectedErr: nil,
		},
		{
			Name: "no options, team1 - paged by 3, page 0 - admin",
			RequesterInfo: app.RequesterInfo{
				UserID:  lucy.ID,
				IsAdmin: true,
			},
			Options: app.PlaybookRunFilterOptions{
				TeamID:    team1id,
				Sort:      app.SortByCreateAt,
				Direction: app.DirectionAsc,
				Page:      0,
				PerPage:   3,
			},
			Want: app.GetPlaybookRunsResults{
				TotalCount: 5,
				PageCount:  2,
				HasMore:    true,
				Items:      []app.PlaybookRun{inc01, inc02, inc03},
			},
			ExpectedErr: nil,
		},
		{
			Name: "no options, team1 - paged by 3, page 1 - admin",
			RequesterInfo: app.RequesterInfo{
				UserID:  lucy.ID,
				IsAdmin: true,
			},
			Options: app.PlaybookRunFilterOptions{
				TeamID:    team1id,
				Sort:      app.SortByCreateAt,
				Direction: app.DirectionAsc,
				Page:      1,
				PerPage:   3,
			},
			Want: app.GetPlaybookRunsResults{
				TotalCount: 5,
				PageCount:  2,
				HasMore:    false,
				Items:      []app.PlaybookRun{inc04, inc05},
			},
			ExpectedErr: nil,
		},
		{
			Name: "no options, team1 - paged by 3, page 2 - admin",
			RequesterInfo: app.RequesterInfo{
				UserID:  lucy.ID,
				IsAdmin: true,
			},
			Options: app.PlaybookRunFilterOptions{
				TeamID:    team1id,
				Sort:      app.SortByCreateAt,
				Direction: app.DirectionAsc,
				Page:      2,
				PerPage:   3,
			},
			Want: app.GetPlaybookRunsResults{
				TotalCount: 5,
				PageCount:  2,
				HasMore:    false,
				Items:      []app.PlaybookRun{},
			},
			ExpectedErr: nil,
		},
		{
			Name: "no options, team1 - paged by 3, page 999 - admin",
			RequesterInfo: app.RequesterInfo{
				UserID:  lucy.ID,
				IsAdmin: true,
			},
			Options: app.PlaybookRunFilterOptions{
				TeamID:    team1id,
				Sort:      app.SortByCreateAt,
				Direction: app.DirectionAsc,
				Page:      999,
				PerPage:   3,
			},
			Want: app.GetPlaybookRunsResults{
				TotalCount: 5,
				PageCount:  2,
				HasMore:    false,
				Items:      []app.PlaybookRun{},
			},
			ExpectedErr: nil,
		},
		{
			Name: "no options, team1 - page 2 by 2 - admin",
			RequesterInfo: app.RequesterInfo{
				UserID:  lucy.ID,
				IsAdmin: true,
			},
			Options: app.PlaybookRunFilterOptions{
				TeamID:    team1id,
				Sort:      app.SortByCreateAt,
				Direction: app.DirectionAsc,
				Page:      2,
				PerPage:   2,
			},
			Want: app.GetPlaybookRunsResults{
				TotalCount: 5,
				PageCount:  3,
				HasMore:    false,
				Items:      []app.PlaybookRun{inc05},
			},
			ExpectedErr: nil,
		},
		{
			Name: "no options, team1 - page 1 by 2 - admin",
			RequesterInfo: app.RequesterInfo{
				UserID:  lucy.ID,
				IsAdmin: true,
			},
			Options: app.PlaybookRunFilterOptions{
				TeamID:    team1id,
				Sort:      app.SortByCreateAt,
				Direction: app.DirectionAsc,
				Page:      1,
				PerPage:   2,
			},
			Want: app.GetPlaybookRunsResults{
				TotalCount: 5,
				PageCount:  3,
				HasMore:    true,
				Items:      []app.PlaybookRun{inc03, inc04},
			},
			ExpectedErr: nil,
		},
		{
			Name: "no options, team1 - page 1 by 4 - admin",
			RequesterInfo: app.RequesterInfo{
				UserID:  lucy.ID,
				IsAdmin: true,
			},
			Options: app.PlaybookRunFilterOptions{
				TeamID:    team1id,
				Sort:      app.SortByCreateAt,
				Direction: app.DirectionAsc,
				Page:      1,
				PerPage:   4,
			},
			Want: app.GetPlaybookRunsResults{
				TotalCount: 5,
				PageCount:  2,
				HasMore:    false,
				Items:      []app.PlaybookRun{inc05},
			},
			ExpectedErr: nil,
		},
		{
			Name: "team1 - only active, page 1 by 2 - admin",
			RequesterInfo: app.RequesterInfo{
				UserID:  lucy.ID,
				IsAdmin: true,
			},
			Options: app.PlaybookRunFilterOptions{
				TeamID:    team1id,
				Sort:      app.SortByCreateAt,
				Direction: app.DirectionAsc,
				Page:      1,
				PerPage:   2,
				Status:    app.StatusReported,
			},
			Want: app.GetPlaybookRunsResults{
				TotalCount: 3,
				PageCount:  2,
				HasMore:    false,
				Items:      []app.PlaybookRun{inc05},
			},
			ExpectedErr: nil,
		},
		{
			Name: "team1 - active, owner3, desc - admin ",
			RequesterInfo: app.RequesterInfo{
				UserID:  lucy.ID,
				IsAdmin: true,
			},
			Options: app.PlaybookRunFilterOptions{
				TeamID:    team1id,
				Status:    app.StatusReported,
				OwnerID:   owner3.UserID,
				Sort:      app.SortByCreateAt,
				Direction: app.DirectionDesc,
				Page:      0,
				PerPage:   1000,
			},
			Want: app.GetPlaybookRunsResults{
				TotalCount: 1,
				PageCount:  1,
				HasMore:    false,
				Items:      []app.PlaybookRun{inc05},
			},
			ExpectedErr: nil,
		},
		{
			Name: "team1 - status = archived ",
			RequesterInfo: app.RequesterInfo{
				UserID:  lucy.ID,
				IsAdmin: true,
			},
			Options: app.PlaybookRunFilterOptions{
				TeamID:    team1id,
				Sort:      app.SortByCreateAt,
				Direction: app.DirectionAsc,
				Statuses:  []string{app.StatusArchived},
				Page:      0,
				PerPage:   1000,
			},
			Want: app.GetPlaybookRunsResults{
				TotalCount: 2,
				PageCount:  1,
				HasMore:    false,
				Items:      []app.PlaybookRun{inc03, inc04},
			},
			ExpectedErr: nil,
		},
		{
			Name: "team1 - status = archived or reported ",
			RequesterInfo: app.RequesterInfo{
				UserID:  lucy.ID,
				IsAdmin: true,
			},
			Options: app.PlaybookRunFilterOptions{
				TeamID:    team1id,
				Sort:      app.SortByCreateAt,
				Direction: app.DirectionAsc,
				Statuses:  []string{app.StatusArchived, app.StatusReported},
				Page:      0,
				PerPage:   1000,
			},
			Want: app.GetPlaybookRunsResults{
				TotalCount: 5,
				PageCount:  1,
				HasMore:    false,
				Items:      []app.PlaybookRun{inc01, inc02, inc03, inc04, inc05},
			},
			ExpectedErr: nil,
		},
		{
			Name: "team1 - search for horse - admin",
			RequesterInfo: app.RequesterInfo{
				UserID:  lucy.ID,
				IsAdmin: true,
			},
			Options: app.PlaybookRunFilterOptions{
				TeamID:     team1id,
				SearchTerm: "horse",
				Sort:       app.SortByCreateAt,
				Direction:  app.DirectionAsc,
				Page:       0,
				PerPage:    1000,
			},
			Want: app.GetPlaybookRunsResults{
				TotalCount: 2,
				PageCount:  1,
				HasMore:    false,
				Items:      []app.PlaybookRun{inc02, inc03},
			},
			ExpectedErr: nil,
		},
		{
			Name: "team1 - search for aliens & owner3 - admin",
			RequesterInfo: app.RequesterInfo{
				UserID:  lucy.ID,
				IsAdmin: true,
			},
			Options: app.PlaybookRunFilterOptions{
				TeamID:     team1id,
				OwnerID:    owner3.UserID,
				SearchTerm: "aliens",
				Sort:       app.SortByCreateAt,
				Direction:  app.DirectionAsc,
				Page:       0,
				PerPage:    1000,
			},
			Want: app.GetPlaybookRunsResults{
				TotalCount: 2,
				PageCount:  1,
				HasMore:    false,
				Items:      []app.PlaybookRun{inc04, inc05},
			},
			ExpectedErr: nil,
		},
		{
			Name: "fuzzy search using starting characters -- not implemented",
			RequesterInfo: app.RequesterInfo{
				UserID:  lucy.ID,
				IsAdmin: true,
			},
			Options: app.PlaybookRunFilterOptions{
				TeamID:     team1id,
				SearchTerm: "sbsm",
				Sort:       app.SortByCreateAt,
				Direction:  app.DirectionAsc,
				Page:       0,
				PerPage:    1000,
			},
			Want: app.GetPlaybookRunsResults{
				TotalCount: 0,
				PageCount:  0,
				HasMore:    false,
				Items:      []app.PlaybookRun{},
			},
			ExpectedErr: nil,
		},
		{
			Name: "fuzzy search using starting characters, active -- not implemented",
			RequesterInfo: app.RequesterInfo{
				UserID:  lucy.ID,
				IsAdmin: true,
			},
			Options: app.PlaybookRunFilterOptions{
				TeamID:     team1id,
				SearchTerm: "sbsm",
				Status:     app.StatusReported,
				Sort:       app.SortByCreateAt,
				Direction:  app.DirectionAsc,
				Page:       0,
				PerPage:    1000,
			},
			Want: app.GetPlaybookRunsResults{
				TotalCount: 0,
				PageCount:  0,
				HasMore:    false,
				Items:      []app.PlaybookRun{},
			},
			ExpectedErr: nil,
		},
		{
			Name: "team3 - case-insensitive and unicode characters - admin",
			RequesterInfo: app.RequesterInfo{
				UserID:  lucy.ID,
				IsAdmin: true,
			},
			Options: app.PlaybookRunFilterOptions{
				TeamID:     team3id,
				SearchTerm: "ZiGgüRat",
				Sort:       app.SortByCreateAt,
				Direction:  app.DirectionAsc,
				Page:       0,
				PerPage:    1000,
			},
			Want: app.GetPlaybookRunsResults{
				TotalCount: 2,
				PageCount:  1,
				HasMore:    false,
				Items:      []app.PlaybookRun{inc08, inc09},
			},
			ExpectedErr: nil,
		},
		{
			Name: "bad parameter sort",
			RequesterInfo: app.RequesterInfo{
				UserID:  lucy.ID,
				IsAdmin: true,
			},
			Options: app.PlaybookRunFilterOptions{
				TeamID:    team2id,
				Sort:      "unknown_field",
				Direction: app.DirectionAsc,
				Page:      0,
				PerPage:   1000,
			},
			Want:        app.GetPlaybookRunsResults{},
			ExpectedErr: errors.New("failed to apply sort options: unsupported sort parameter 'unknown_field'"),
		},
		{
			Name: "no team",
			RequesterInfo: app.RequesterInfo{
				UserID:  lucy.ID,
				IsAdmin: true,
			},
			Options: app.PlaybookRunFilterOptions{
				TeamID:    "",
				Sort:      app.SortByCreateAt,
				Direction: app.DirectionAsc,
				Page:      0,
				PerPage:   1000,
			},
			Want: app.GetPlaybookRunsResults{
				TotalCount: 0,
				PageCount:  0,
				HasMore:    false,
				Items:      []app.PlaybookRun{},
			},
			ExpectedErr: nil,
		},
		{
			Name: "bad parameter direction by",
			RequesterInfo: app.RequesterInfo{
				UserID:  lucy.ID,
				IsAdmin: true,
			},
			Options: app.PlaybookRunFilterOptions{
				TeamID:    team2id,
				Sort:      app.SortByCreateAt,
				Direction: "invalid direction",
				Page:      0,
				PerPage:   1000,
			},
			Want:        app.GetPlaybookRunsResults{},
			ExpectedErr: errors.New("failed to apply sort options: unsupported direction parameter 'invalid direction'"),
		},
		{
			Name: "team1 - desc - Bob (in all channels)",
			RequesterInfo: app.RequesterInfo{
				UserID: bob.ID,
			},
			Options: app.PlaybookRunFilterOptions{
				TeamID:    team1id,
				Sort:      app.SortByCreateAt,
				Direction: app.DirectionDesc,
				Page:      0,
				PerPage:   1000,
			},
			Want: app.GetPlaybookRunsResults{
				TotalCount: 5,
				PageCount:  1,
				HasMore:    false,
				Items:      []app.PlaybookRun{inc05, inc04, inc03, inc02, inc01},
			},
			ExpectedErr: nil,
		},
		{
			Name: "team2 -  Bob (in all channels)",
			RequesterInfo: app.RequesterInfo{
				UserID: bob.ID,
			},
			Options: app.PlaybookRunFilterOptions{
				TeamID:    team2id,
				Sort:      app.SortByCreateAt,
				Direction: app.DirectionAsc,
				Page:      0,
				PerPage:   1000,
			},
			Want: app.GetPlaybookRunsResults{
				TotalCount: 2,
				PageCount:  1,
				HasMore:    false,
				Items:      []app.PlaybookRun{inc06, inc07},
			},
			ExpectedErr: nil,
		},
		{
			Name: "team1 - Alice (in no channels but member of team (because request must have made it through the API team membership test to the store), can see public playbook runs)",
			RequesterInfo: app.RequesterInfo{
				UserID: alice.ID,
			},
			Options: app.PlaybookRunFilterOptions{
				TeamID:    team1id,
				Sort:      app.SortByCreateAt,
				Direction: app.DirectionAsc,
				Page:      0,
				PerPage:   1000,
			},
			Want: app.GetPlaybookRunsResults{
				TotalCount: 3,
				PageCount:  1,
				HasMore:    false,
				Items:      []app.PlaybookRun{inc01, inc02, inc03},
			},
			ExpectedErr: nil,
		},
		{
			Name: "team2 - Charlotte (in no channels but member of team -- because her request must have made it to the store through the API's team membership check)",
			RequesterInfo: app.RequesterInfo{
				UserID: charlotte.ID,
			},
			Options: app.PlaybookRunFilterOptions{
				TeamID:    team2id,
				Sort:      app.SortByCreateAt,
				Direction: app.DirectionAsc,
				Page:      0,
				PerPage:   1000,
			},
			Want: app.GetPlaybookRunsResults{
				TotalCount: 1,
				PageCount:  1,
				HasMore:    false,
				Items:      []app.PlaybookRun{inc06},
			},
			ExpectedErr: nil,
		},
		{
			Name: "team1 - Admin gets playbook runs with John as member",
			RequesterInfo: app.RequesterInfo{
				UserID:  lucy.ID,
				IsAdmin: true,
			},
			Options: app.PlaybookRunFilterOptions{
				TeamID:    team1id,
				MemberID:  john.ID,
				Sort:      app.SortByCreateAt,
				Direction: app.DirectionAsc,
				Page:      0,
				PerPage:   1000,
			},
			Want: app.GetPlaybookRunsResults{
				TotalCount: 3,
				PageCount:  1,
				HasMore:    false,
				Items:      []app.PlaybookRun{inc01, inc02, inc03},
			},
			ExpectedErr: nil,
		},
		{
			Name: "team1 - Admin gets playbook runs with Jane as member",
			RequesterInfo: app.RequesterInfo{
				UserID:  lucy.ID,
				IsAdmin: true,
			},
			Options: app.PlaybookRunFilterOptions{
				TeamID:    team1id,
				MemberID:  jane.ID,
				Sort:      app.SortByCreateAt,
				Direction: app.DirectionAsc,
				Page:      0,
				PerPage:   1000,
			},
			Want: app.GetPlaybookRunsResults{
				TotalCount: 3,
				PageCount:  1,
				HasMore:    false,
				Items:      []app.PlaybookRun{inc03, inc04, inc05},
			},
			ExpectedErr: nil,
		},
		{
			Name: "team1 - John gets its own playbook runs",
			RequesterInfo: app.RequesterInfo{
				UserID: john.ID,
			},
			Options: app.PlaybookRunFilterOptions{
				TeamID:    team1id,
				MemberID:  john.ID,
				Sort:      app.SortByCreateAt,
				Direction: app.DirectionAsc,
				Page:      0,
				PerPage:   1000,
			},
			Want: app.GetPlaybookRunsResults{
				TotalCount: 3,
				PageCount:  1,
				HasMore:    false,
				Items:      []app.PlaybookRun{inc01, inc02, inc03},
			},
			ExpectedErr: nil,
		},
		{
			Name: "team1 - Jane gets its own playbook runs",
			RequesterInfo: app.RequesterInfo{
				UserID: jane.ID,
			},
			Options: app.PlaybookRunFilterOptions{
				TeamID:    team1id,
				MemberID:  jane.ID,
				Sort:      app.SortByCreateAt,
				Direction: app.DirectionAsc,
				Page:      0,
				PerPage:   1000,
			},
			Want: app.GetPlaybookRunsResults{
				TotalCount: 3,
				PageCount:  1,
				HasMore:    false,
				Items:      []app.PlaybookRun{inc03, inc04, inc05},
			},
			ExpectedErr: nil,
		},
		{
			Name: "team1 - playbook1 - desc - admin",
			RequesterInfo: app.RequesterInfo{
				UserID:  lucy.ID,
				IsAdmin: true,
			},
			Options: app.PlaybookRunFilterOptions{
				TeamID:     team1id,
				PlaybookID: "playbook1",
				Sort:       app.SortByCreateAt,
				Direction:  app.DirectionDesc,
				Page:       0,
				PerPage:    1000,
			},
			Want: app.GetPlaybookRunsResults{
				TotalCount: 2,
				PageCount:  1,
				HasMore:    false,
				Items:      []app.PlaybookRun{inc02, inc01},
			},
			ExpectedErr: nil,
		},
		{
			Name: "team1 - playbook2 - desc - admin",
			RequesterInfo: app.RequesterInfo{
				UserID:  lucy.ID,
				IsAdmin: true,
			},
			Options: app.PlaybookRunFilterOptions{
				TeamID:     team1id,
				PlaybookID: "playbook2",
				Sort:       app.SortByCreateAt,
				Direction:  app.DirectionDesc,
				Page:       0,
				PerPage:    1000,
			},
			Want: app.GetPlaybookRunsResults{
				TotalCount: 1,
				PageCount:  1,
				HasMore:    false,
				Items:      []app.PlaybookRun{inc03},
			},
			ExpectedErr: nil,
		},
	}

	for _, driverName := range driverNames {
		db := setupTestDB(t, driverName)
		playbookRunStore := setupPlaybookRunStore(t, db)

		_, store := setupSQLStore(t, db)
		setupUsersTable(t, db)
		setupTeamMembersTable(t, db)
		setupChannelMembersTable(t, db)
		setupChannelsTable(t, db)
		setupPostsTable(t, db)
		addUsers(t, store, []userInfo{lucy, bob, john, jane})
		addUsersToTeam(t, store, []userInfo{alice, charlotte, john, jane}, team1id)
		addUsersToTeam(t, store, []userInfo{charlotte}, team2id)
		createChannels(t, store, []model.Channel{channel01, channel02, channel03, channel04, channel05, channel06, channel07, channel08, channel09})
		addUsersToChannels(t, store, []userInfo{bob}, []string{channel01.Id, channel02.Id, channel03.Id, channel04.Id, channel05.Id, channel06.Id, channel07.Id, channel08.Id, channel09.Id})
		addUsersToChannels(t, store, []userInfo{john}, []string{channel01.Id, channel02.Id, channel03.Id})
		addUsersToChannels(t, store, []userInfo{jane}, []string{channel03.Id, channel04.Id, channel05.Id})
		makeAdmin(t, store, lucy)

		t.Run("zero playbook runs", func(t *testing.T) {
			result, err := playbookRunStore.GetPlaybookRuns(app.RequesterInfo{
				UserID: lucy.ID,
			},
				app.PlaybookRunFilterOptions{
					TeamID:    team1id,
					Sort:      app.SortByCreateAt,
					Direction: app.DirectionAsc,
					Page:      0,
					PerPage:   10,
				})
			require.NoError(t, err)

			require.Equal(t, 0, result.TotalCount)
			require.Equal(t, 0, result.PageCount)
			require.False(t, result.HasMore)
			require.Empty(t, result.Items)
		})

		createPlaybookRuns(store, playbookRunStore)

		for _, testCase := range testData {
			t.Run(driverName+" - "+testCase.Name, func(t *testing.T) {
				result, err := playbookRunStore.GetPlaybookRuns(testCase.RequesterInfo, testCase.Options)

				if testCase.ExpectedErr != nil {
					require.Nil(t, result)
					require.Error(t, err)
					require.Equal(t, testCase.ExpectedErr.Error(), err.Error())

					return
				}

				require.NoError(t, err)

				for i, item := range result.Items {
					require.True(t, model.IsValidId(item.ID))
					item.ID = ""
					result.Items[i] = item
				}

				// sort the participants so equality will work
				for i := range result.Items {
					sort.Strings(result.Items[i].ParticipantIDs)
				}

				require.Equal(t, testCase.Want, *result)
			})
		}
	}
}

func TestCreateAndGetPlaybookRun(t *testing.T) {
	for _, driverName := range driverNames {
		db := setupTestDB(t, driverName)
		_, store := setupSQLStore(t, db)
		playbookRunStore := setupPlaybookRunStore(t, db)
		setupChannelsTable(t, db)
		setupPostsTable(t, db)

		validPlaybookRuns := []struct {
			Name        string
			PlaybookRun *app.PlaybookRun
			ExpectedErr error
		}{
			{
				Name:        "Empty values",
				PlaybookRun: &app.PlaybookRun{},
				ExpectedErr: nil,
			},
			{
				Name:        "Base playbook run",
				PlaybookRun: NewBuilder(t).ToPlaybookRun(),
				ExpectedErr: nil,
			},
			{
				Name:        "Name with unicode characters",
				PlaybookRun: NewBuilder(t).WithName("valid unicode: ñäåö").ToPlaybookRun(),
				ExpectedErr: nil,
			},
			{
				Name:        "Created at 0",
				PlaybookRun: NewBuilder(t).WithCreateAt(0).ToPlaybookRun(),
				ExpectedErr: nil,
			},
			{
				Name:        "Deleted playbook run",
				PlaybookRun: NewBuilder(t).WithDeleteAt(model.GetMillis()).ToPlaybookRun(),
				ExpectedErr: nil,
			},
			{
				Name:        "PlaybookRun with one checklist and 10 items",
				PlaybookRun: NewBuilder(t).WithChecklists([]int{10}).ToPlaybookRun(),
				ExpectedErr: nil,
			},
			{
				Name:        "PlaybookRun with five checklists with different number of items",
				PlaybookRun: NewBuilder(t).WithChecklists([]int{1, 2, 3, 4, 5}).ToPlaybookRun(),
				ExpectedErr: nil,
			},
			{
				Name:        "PlaybookRun should not be nil",
				PlaybookRun: nil,
				ExpectedErr: errors.New("playbook run is nil"),
			},
			{
				Name:        "PlaybookRun /can/ contain checklists with no items",
				PlaybookRun: NewBuilder(t).WithChecklists([]int{0}).ToPlaybookRun(),
				ExpectedErr: nil,
			},
		}

		for _, testCase := range validPlaybookRuns {
			t.Run(testCase.Name, func(t *testing.T) {
				var expectedPlaybookRun app.PlaybookRun
				if testCase.PlaybookRun != nil {
					expectedPlaybookRun = *testCase.PlaybookRun
				}

				returned, err := playbookRunStore.CreatePlaybookRun(testCase.PlaybookRun)

				if testCase.ExpectedErr != nil {
					require.Error(t, err)
					require.Equal(t, testCase.ExpectedErr.Error(), err.Error())
					require.Nil(t, returned)
					return
				}

				require.NoError(t, err)
				require.True(t, model.IsValidId(returned.ID))
				expectedPlaybookRun.ID = returned.ID

				createPlaybookRunChannel(t, store, testCase.PlaybookRun)

				_, err = playbookRunStore.GetPlaybookRun(expectedPlaybookRun.ID)
				require.NoError(t, err)
			})
		}
	}
}

// TestGetPlaybookRun only tests getting a non-existent playbook run, since getting existing playbook runs
// is tested in TestCreateAndGetPlaybookRun above.
func TestGetPlaybookRun(t *testing.T) {
	for _, driverName := range driverNames {
		db := setupTestDB(t, driverName)
		playbookRunStore := setupPlaybookRunStore(t, db)
		setupChannelsTable(t, db)

		validPlaybookRuns := []struct {
			Name        string
			ID          string
			ExpectedErr error
		}{
			{
				Name:        "Get a non-existing playbook run",
				ID:          "nonexisting",
				ExpectedErr: errors.New("playbook run with id 'nonexisting' does not exist: not found"),
			},
			{
				Name:        "Get without ID",
				ID:          "",
				ExpectedErr: errors.New("ID cannot be empty"),
			},
		}

		for _, testCase := range validPlaybookRuns {
			t.Run(testCase.Name, func(t *testing.T) {
				returned, err := playbookRunStore.GetPlaybookRun(testCase.ID)

				require.Error(t, err)
				require.Equal(t, testCase.ExpectedErr.Error(), err.Error())
				require.Nil(t, returned)
			})
		}
	}
}

func TestUpdatePlaybookRun(t *testing.T) {
	post1 := &model.Post{
		Id:       model.NewId(),
		CreateAt: 10000000,
		DeleteAt: 0,
	}
	post2 := &model.Post{
		Id:       model.NewId(),
		CreateAt: 20000000,
		DeleteAt: 0,
	}
	post3 := &model.Post{
		Id:       model.NewId(),
		CreateAt: 30000000,
		DeleteAt: 0,
	}
	post4 := &model.Post{
		Id:       model.NewId(),
		CreateAt: 40000000,
		DeleteAt: 40300000,
	}
	post5 := &model.Post{
		Id:       model.NewId(),
		CreateAt: 40000001,
		DeleteAt: 0,
	}
	post6 := &model.Post{
		Id:       model.NewId(),
		CreateAt: 40000002,
		DeleteAt: 0,
	}
	allPosts := []*model.Post{post1, post2, post3, post4, post5, post6}

	for _, driverName := range driverNames {
		db := setupTestDB(t, driverName)
		playbookRunStore := setupPlaybookRunStore(t, db)
		_, store := setupSQLStore(t, db)

		setupChannelsTable(t, db)
		setupPostsTable(t, db)
		savePosts(t, store, allPosts)

		validPlaybookRuns := []struct {
			Name        string
			PlaybookRun *app.PlaybookRun
			Update      func(app.PlaybookRun) *app.PlaybookRun
			ExpectedErr error
		}{
			{
				Name:        "nil playbook run",
				PlaybookRun: NewBuilder(t).ToPlaybookRun(),
				Update: func(old app.PlaybookRun) *app.PlaybookRun {
					return nil
				},
				ExpectedErr: errors.New("playbook run is nil"),
			},
			{
				Name:        "id should not be empty",
				PlaybookRun: NewBuilder(t).ToPlaybookRun(),
				Update: func(old app.PlaybookRun) *app.PlaybookRun {
					old.ID = ""
					return &old
				},
				ExpectedErr: errors.New("ID should not be empty"),
			},
			{
				Name:        "PlaybookRun /can/ contain checklists with no items",
				PlaybookRun: NewBuilder(t).WithChecklists([]int{1}).ToPlaybookRun(),
				Update: func(old app.PlaybookRun) *app.PlaybookRun {
					old.Checklists[0].Items = nil
					return &old
				},
				ExpectedErr: nil,
			},
			{
				Name:        "new description",
				PlaybookRun: NewBuilder(t).WithDescription("old description").ToPlaybookRun(),
				Update: func(old app.PlaybookRun) *app.PlaybookRun {
					old.Description = "new description"
					return &old
				},
				ExpectedErr: nil,
			},
			{
				Name:        "PlaybookRun with 2 checklists, update the checklists a bit",
				PlaybookRun: NewBuilder(t).WithChecklists([]int{1, 1}).ToPlaybookRun(),
				Update: func(old app.PlaybookRun) *app.PlaybookRun {
					old.Checklists[0].Items[0].State = app.ChecklistItemStateClosed
					old.Checklists[1].Items[0].Title = "new title"
					return &old
				},
				ExpectedErr: nil,
			},
		}

		for _, testCase := range validPlaybookRuns {
			t.Run(testCase.Name, func(t *testing.T) {
				returned, err := playbookRunStore.CreatePlaybookRun(testCase.PlaybookRun)
				require.NoError(t, err)
				createPlaybookRunChannel(t, store, returned)

				expected := testCase.Update(*returned)

				err = playbookRunStore.UpdatePlaybookRun(expected)

				if testCase.ExpectedErr != nil {
					require.Error(t, err)
					require.Equal(t, testCase.ExpectedErr.Error(), err.Error())
					return
				}

				require.NoError(t, err)

				actual, err := playbookRunStore.GetPlaybookRun(expected.ID)
				require.NoError(t, err)
				require.Equal(t, expected, actual)
			})
		}
	}
}

// intended to catch problems with the code assembling StatusPosts
func TestStressTestGetPlaybookRuns(t *testing.T) {
	rand.Seed(time.Now().UTC().UnixNano())

	// Change these to larger numbers to stress test. Keep them low for CI.
	numPlaybookRuns := 100
	postsPerPlaybookRun := 3
	perPage := 10
	verifyPages := []int{0, 2, 4, 6, 8}

	for _, driverName := range driverNames {
		db := setupTestDB(t, driverName)
		playbookRunStore := setupPlaybookRunStore(t, db)
		_, store := setupSQLStore(t, db)

		setupChannelsTable(t, db)
		setupPostsTable(t, db)
		teamID := model.NewId()
		withPosts := createPlaybookRunsAndPosts(t, store, playbookRunStore, numPlaybookRuns, postsPerPlaybookRun, teamID)

		t.Run("stress test status posts retrieval", func(t *testing.T) {
			for _, p := range verifyPages {
				returned, err := playbookRunStore.GetPlaybookRuns(app.RequesterInfo{
					UserID:  "testID",
					IsAdmin: true,
				}, app.PlaybookRunFilterOptions{
					TeamID:    teamID,
					Sort:      app.SortByCreateAt,
					Direction: app.DirectionAsc,
					Page:      p,
					PerPage:   perPage,
				})
				require.NoError(t, err)
				numRet := min(perPage, len(withPosts))
				require.Equal(t, numRet, len(returned.Items))
				for i := 0; i < numRet; i++ {
					idx := p*perPage + i
					assert.ElementsMatch(t, withPosts[idx].StatusPosts, returned.Items[i].StatusPosts)
					expWithoutStatusPosts := withPosts[idx]
					expWithoutStatusPosts.StatusPosts = nil
					actWithoutStatusPosts := returned.Items[i]
					actWithoutStatusPosts.StatusPosts = nil
					assert.Equal(t, expWithoutStatusPosts, actWithoutStatusPosts)
				}
			}
		})
	}
}

func TestStressTestGetPlaybookRunsStats(t *testing.T) {
	// don't need to assemble stats in CI
	t.SkipNow()

	rand.Seed(time.Now().UTC().UnixNano())

	// Change these to larger numbers to stress test.
	numPlaybookRuns := 1000
	postsPerPlaybookRun := 3
	perPage := 10

	// For stats:
	numReps := 30

	// so we don't start returning pages with 0 playbook runs:
	require.LessOrEqual(t, numReps*perPage, numPlaybookRuns)

	for _, driverName := range driverNames {
		db := setupTestDB(t, driverName)
		playbookRunStore := setupPlaybookRunStore(t, db)
		_, store := setupSQLStore(t, db)

		setupChannelsTable(t, db)
		setupPostsTable(t, db)
		teamID := model.NewId()
		_ = createPlaybookRunsAndPosts(t, store, playbookRunStore, numPlaybookRuns, postsPerPlaybookRun, teamID)

		t.Run("stress test status posts retrieval", func(t *testing.T) {
			intervals := make([]int64, 0, numReps)
			for i := 0; i < numReps; i++ {
				start := time.Now()
				_, err := playbookRunStore.GetPlaybookRuns(app.RequesterInfo{
					UserID:  "testID",
					IsAdmin: true,
				}, app.PlaybookRunFilterOptions{
					TeamID:    teamID,
					Sort:      app.SortByCreateAt,
					Direction: app.DirectionAsc,
					Page:      i,
					PerPage:   perPage,
				})
				intervals = append(intervals, time.Since(start).Milliseconds())
				require.NoError(t, err)
			}
			cil, ciu := ciForN30(intervals)
			fmt.Printf("Mean: %.2f\tStdErr: %.2f\t95%% CI: (%.2f, %.2f)\n",
				mean(intervals), stdErr(intervals), cil, ciu)
		})
	}
}

func createPlaybookRunsAndPosts(t testing.TB, store *SQLStore, playbookRunStore app.PlaybookRunStore, numPlaybookRuns, maxPostsPerPlaybookRun int, teamID string) []app.PlaybookRun {
	playbookRunsSorted := make([]app.PlaybookRun, 0, numPlaybookRuns)
	for i := 0; i < numPlaybookRuns; i++ {
		numPosts := maxPostsPerPlaybookRun
		posts := make([]*model.Post, 0, numPosts)
		for j := 0; j < numPosts; j++ {
			post := newPost(rand.Intn(2) == 0)
			posts = append(posts, post)
		}
		savePosts(t, store, posts)

		inc := NewBuilder(t).
			WithTeamID(teamID).
			WithCreateAt(int64(100000 + i)).
			WithName(fmt.Sprintf("playbook run %d", i)).
			WithChecklists([]int{1}).
			ToPlaybookRun()
		ret, err := playbookRunStore.CreatePlaybookRun(inc)
		require.NoError(t, err)
		createPlaybookRunChannel(t, store, ret)
		playbookRunsSorted = append(playbookRunsSorted, *ret)
	}

	return playbookRunsSorted
}

func newPost(deleted bool) *model.Post {
	createAt := rand.Int63()
	deleteAt := int64(0)
	if deleted {
		deleteAt = createAt + 100
	}
	return &model.Post{
		Id:       model.NewId(),
		CreateAt: createAt,
		DeleteAt: deleteAt,
	}
}

func TestGetPlaybookRunIDForChannel(t *testing.T) {
	for _, driverName := range driverNames {
		db := setupTestDB(t, driverName)
		_, store := setupSQLStore(t, db)
		playbookRunStore := setupPlaybookRunStore(t, db)
		setupChannelsTable(t, db)

		t.Run("retrieve existing playbookRunID", func(t *testing.T) {
			playbookRun1 := NewBuilder(t).ToPlaybookRun()
			playbookRun2 := NewBuilder(t).ToPlaybookRun()

			returned1, err := playbookRunStore.CreatePlaybookRun(playbookRun1)
			require.NoError(t, err)
			createPlaybookRunChannel(t, store, playbookRun1)

			returned2, err := playbookRunStore.CreatePlaybookRun(playbookRun2)
			require.NoError(t, err)
			createPlaybookRunChannel(t, store, playbookRun2)

			id1, err := playbookRunStore.GetPlaybookRunIDForChannel(playbookRun1.ChannelID)
			require.NoError(t, err)
			require.Equal(t, returned1.ID, id1)
			id2, err := playbookRunStore.GetPlaybookRunIDForChannel(playbookRun2.ChannelID)
			require.NoError(t, err)
			require.Equal(t, returned2.ID, id2)
		})
		t.Run("fail to retrieve non-existing playbookRunID", func(t *testing.T) {
			id1, err := playbookRunStore.GetPlaybookRunIDForChannel("nonexistingid")
			require.Error(t, err)
			require.Equal(t, "", id1)
			require.True(t, strings.HasPrefix(err.Error(),
				"channel with id (nonexistingid) does not have a playbook run"))
		})
	}
}

func TestGetOwners(t *testing.T) {
	team1id := model.NewId()
	team2id := model.NewId()
	team3id := model.NewId()

	owner1 := app.OwnerInfo{
		UserID:   model.NewId(),
		Username: "Owner 1",
	}
	owner2 := app.OwnerInfo{
		UserID:   model.NewId(),
		Username: "Owner 2",
	}
	owner3 := app.OwnerInfo{
		UserID:   model.NewId(),
		Username: "Owner 3",
	}
	owner4 := app.OwnerInfo{
		UserID:   model.NewId(),
		Username: "Owner 4",
	}

	owners := []app.OwnerInfo{owner1, owner2, owner3, owner4}

	lucy := userInfo{
		ID:   model.NewId(),
		Name: "Lucy",
	}

	bob := userInfo{
		ID:   model.NewId(),
		Name: "bob",
	}

	alice := userInfo{
		ID:   model.NewId(),
		Name: "alice",
	}

	charlotte := userInfo{
		ID:   model.NewId(),
		Name: "Charlotte",
	}

	channel01 := model.Channel{Id: model.NewId(), Type: "O"}
	channel02 := model.Channel{Id: model.NewId(), Type: "O"}
	channel03 := model.Channel{Id: model.NewId(), Type: "O"}
	channel04 := model.Channel{Id: model.NewId(), Type: "P"}
	channel05 := model.Channel{Id: model.NewId(), Type: "P"}
	channel06 := model.Channel{Id: model.NewId(), Type: "O"}
	channel07 := model.Channel{Id: model.NewId(), Type: "P"}
	channel08 := model.Channel{Id: model.NewId(), Type: "P"}
	channel09 := model.Channel{Id: model.NewId(), Type: "P"}

	channels := []model.Channel{channel01, channel02, channel03, channel04, channel05, channel06, channel07, channel08, channel09}

	inc01 := *NewBuilder(nil).
		WithName("pr 1 - wheel cat aliens wheelbarrow").
		WithDescription("this is a description, not very long, but it can be up to 2048 bytes").
		WithChannel(&channel01). // public
		WithOwnerUserID(owner1.UserID).
		WithTeamID(team1id).
		WithCreateAt(123).
		WithChecklists([]int{8}).
		WithParticipant(bob).
		ToPlaybookRun()

	inc02 := *NewBuilder(nil).
		WithName("pr 2 - horse staple battery aliens shotgun mouse shotputmouse").
		WithChannel(&channel02). // public
		WithOwnerUserID(owner2.UserID).
		WithTeamID(team1id).
		WithCreateAt(199).
		WithChecklists([]int{7}).
		WithParticipant(bob).
		ToPlaybookRun()

	inc03 := *NewBuilder(nil).
		WithName("pr 3 - Horse stapler battery shotgun mouse shotputmouse").
		WithChannel(&channel03). // public
		WithOwnerUserID(owner1.UserID).
		WithTeamID(team1id).
		WithCreateAt(222).
		WithChecklists([]int{6}).
		WithParticipant(bob).
		ToPlaybookRun()

	inc04 := *NewBuilder(nil).
		WithName("pr 4 - titanic terminatoraliens").
		WithChannel(&channel04). // private
		WithOwnerUserID(owner3.UserID).
		WithTeamID(team1id).
		WithCreateAt(333).
		WithChecklists([]int{5}).
		WithParticipant(bob).
		ToPlaybookRun()

	inc05 := *NewBuilder(nil).
		WithName("pr 5 - titanic terminator aliens mouse").
		WithChannel(&channel05). // private
		WithOwnerUserID(owner3.UserID).
		WithTeamID(team1id).
		WithCreateAt(400).
		WithChecklists([]int{1}).
		WithParticipant(bob).
		ToPlaybookRun()

	inc06 := *NewBuilder(nil).
		WithName("pr 6 - ubik high castle electric sheep").
		WithChannel(&channel06). // public
		WithOwnerUserID(owner3.UserID).
		WithTeamID(team2id).
		WithCreateAt(444).
		WithChecklists([]int{4}).
		WithParticipant(bob).
		ToPlaybookRun()

	inc07 := *NewBuilder(nil).
		WithName("pr 7 - ubik high castle electric sheep").
		WithChannel(&channel07). // private
		WithOwnerUserID(owner3.UserID).
		WithTeamID(team2id).
		WithCreateAt(555).
		WithChecklists([]int{4}).
		WithParticipant(bob).
		ToPlaybookRun()

	inc08 := *NewBuilder(nil).
		WithName("pr 8 - ziggürat!").
		WithChannel(&channel08). // private
		WithOwnerUserID(owner4.UserID).
		WithTeamID(team3id).
		WithCreateAt(555).
		WithChecklists([]int{3}).
		WithParticipant(bob).
		ToPlaybookRun()

	inc09 := *NewBuilder(nil).
		WithName("pr 9 - Ziggürat!").
		WithChannel(&channel09). // private
		WithOwnerUserID(owner4.UserID).
		WithTeamID(team3id).
		WithCreateAt(556).
		WithChecklists([]int{2}).
		WithParticipant(bob).
		ToPlaybookRun()

	playbookRuns := []app.PlaybookRun{inc01, inc02, inc03, inc04, inc05, inc06, inc07, inc08, inc09}

	cases := []struct {
		Name          string
		RequesterInfo app.RequesterInfo
		Options       app.PlaybookRunFilterOptions
		Expected      []app.OwnerInfo
		ExpectedErr   error
	}{
		{
			Name: "team 1 - admin",
			RequesterInfo: app.RequesterInfo{
				UserID:  lucy.ID,
				IsAdmin: true,
			},
			Options: app.PlaybookRunFilterOptions{
				TeamID: team1id,
			},
			Expected:    []app.OwnerInfo{owner1, owner2, owner3},
			ExpectedErr: nil,
		},
		{
			Name: "team 2 - admin",
			RequesterInfo: app.RequesterInfo{
				UserID:  lucy.ID,
				IsAdmin: true,
			},
			Options: app.PlaybookRunFilterOptions{
				TeamID:    team2id,
				Sort:      app.SortByCreateAt,
				Direction: app.DirectionAsc,
				Page:      0,
				PerPage:   1000,
			},
			Expected:    []app.OwnerInfo{owner3},
			ExpectedErr: nil,
		},
		{
			Name: "team 3 - admin",
			RequesterInfo: app.RequesterInfo{
				UserID:  lucy.ID,
				IsAdmin: true,
			},
			Options: app.PlaybookRunFilterOptions{
				TeamID:    team3id,
				Sort:      app.SortByCreateAt,
				Direction: app.DirectionAsc,
				Page:      0,
				PerPage:   1000,
			},
			Expected:    []app.OwnerInfo{owner4},
			ExpectedErr: nil,
		},
		{
			Name: "team1 - Alice (in no channels but member of team (because must have made it through API team membership test), can see public playbook runs)",
			RequesterInfo: app.RequesterInfo{
				UserID: "Alice",
			},
			Options: app.PlaybookRunFilterOptions{
				TeamID:    team1id,
				Sort:      app.SortByCreateAt,
				Direction: app.DirectionAsc,
				Page:      0,
				PerPage:   1000,
			},
			Expected:    []app.OwnerInfo{owner1, owner2},
			ExpectedErr: nil,
		},
		{
			Name: "team2 - Charlotte (in no channels but member of team, because must have made it through API team membership test)",
			RequesterInfo: app.RequesterInfo{
				UserID: "Charlotte",
			},
			Options: app.PlaybookRunFilterOptions{
				TeamID:    team2id,
				Sort:      app.SortByCreateAt,
				Direction: app.DirectionAsc,
				Page:      0,
				PerPage:   1000,
			},
			Expected:    []app.OwnerInfo{owner3},
			ExpectedErr: nil,
		},
		{
			Name: "no team - admin",
			RequesterInfo: app.RequesterInfo{
				UserID:  lucy.ID,
				IsAdmin: true,
			},
			Options: app.PlaybookRunFilterOptions{
				Sort:      app.SortByCreateAt,
				Direction: app.DirectionAsc,
				Page:      0,
				PerPage:   1000,
			},
			Expected:    []app.OwnerInfo{},
			ExpectedErr: nil,
		},
	}

	for _, driverName := range driverNames {
		db := setupTestDB(t, driverName)
		playbookRunStore := setupPlaybookRunStore(t, db)

		_, store := setupSQLStore(t, db)
		setupUsersTable(t, db)
		setupChannelMemberHistoryTable(t, db)
		setupTeamMembersTable(t, db)
		setupChannelMembersTable(t, db)
		setupChannelsTable(t, db)
		setupPostsTable(t, db)
		addUsers(t, store, []userInfo{lucy})
		makeAdmin(t, store, lucy)
		addUsersToTeam(t, store, []userInfo{alice, charlotte}, team1id)
		addUsersToTeam(t, store, []userInfo{charlotte}, team2id)
		addUsersToChannels(t, store, []userInfo{bob}, []string{channel01.Id, channel02.Id, channel03.Id, channel04.Id, channel05.Id, channel06.Id, channel07.Id, channel08.Id, channel09.Id})

		queryBuilder := sq.StatementBuilder.PlaceholderFormat(sq.Question)
		if driverName == model.DATABASE_DRIVER_POSTGRES {
			queryBuilder = queryBuilder.PlaceholderFormat(sq.Dollar)
		}

		insertOwner := queryBuilder.Insert("Users").Columns("ID", "Username")
		for _, owner := range owners {
			insertOwner = insertOwner.Values(owner.UserID, owner.Username)
		}

		query, args, err := insertOwner.ToSql()
		require.NoError(t, err)
		_, err = db.Exec(query, args...)
		require.NoError(t, err)

		for i := range playbookRuns {
			_, err := playbookRunStore.CreatePlaybookRun(&playbookRuns[i])
			require.NoError(t, err)
		}

		createChannels(t, store, channels)

		for _, testCase := range cases {
			t.Run(testCase.Name, func(t *testing.T) {
				actual, actualErr := playbookRunStore.GetOwners(testCase.RequesterInfo, testCase.Options)

				if testCase.ExpectedErr != nil {
					require.EqualError(t, actualErr, testCase.ExpectedErr.Error())
					require.Nil(t, actual)
					return
				}

				require.NoError(t, actualErr)

				require.ElementsMatch(t, testCase.Expected, actual)
			})
		}
	}
}

func TestNukeDB(t *testing.T) {
	team1id := model.NewId()

	alice := userInfo{
		ID:   model.NewId(),
		Name: "alice",
	}

	bob := userInfo{
		ID:   model.NewId(),
		Name: "bob",
	}

	for _, driverName := range driverNames {
		db := setupTestDB(t, driverName)
		_, store := setupSQLStore(t, db)

		setupChannelsTable(t, db)
		setupUsersTable(t, db)
		setupTeamMembersTable(t, db)

		playbookRunStore := setupPlaybookRunStore(t, db)
		playbookStore := setupPlaybookStore(t, db)

		t.Run("nuke db with a few playbook runs in it", func(t *testing.T) {
			for i := 0; i < 10; i++ {
				newPlaybookRun := NewBuilder(t).ToPlaybookRun()
				_, err := playbookRunStore.CreatePlaybookRun(newPlaybookRun)
				require.NoError(t, err)
				createPlaybookRunChannel(t, store, newPlaybookRun)
			}

			var rows int64
			err := db.Get(&rows, "SELECT COUNT(*) FROM IR_Incident")
			require.NoError(t, err)
			require.Equal(t, 10, int(rows))

			err = playbookRunStore.NukeDB()
			require.NoError(t, err)

			err = db.Get(&rows, "SELECT COUNT(*) FROM IR_Incident")
			require.NoError(t, err)
			require.Equal(t, 0, int(rows))
		})

		t.Run("nuke db with playbooks", func(t *testing.T) {
			members := []userInfo{alice, bob}
			addUsers(t, store, members)
			addUsersToTeam(t, store, members, team1id)

			for i := 0; i < 10; i++ {
				newPlaybook := NewPBBuilder().WithMembers(members).ToPlaybook()
				_, err := playbookStore.Create(newPlaybook)
				require.NoError(t, err)
			}

			var rows int64

			err := db.Get(&rows, "SELECT COUNT(*) FROM IR_Playbook")
			require.NoError(t, err)
			require.Equal(t, 10, int(rows))

			err = db.Get(&rows, "SELECT COUNT(*) FROM IR_PlaybookMember")
			require.NoError(t, err)
			require.Equal(t, 20, int(rows))

			err = playbookRunStore.NukeDB()
			require.NoError(t, err)

			err = db.Get(&rows, "SELECT COUNT(*) FROM IR_Playbook")
			require.NoError(t, err)
			require.Equal(t, 0, int(rows))

			err = db.Get(&rows, "SELECT COUNT(*) FROM IR_PlaybookMember")
			require.NoError(t, err)
			require.Equal(t, 0, int(rows))
		})
	}
}

func TestCheckAndSendMessageOnJoin(t *testing.T) {
	for _, driverName := range driverNames {
		db := setupTestDB(t, driverName)
		_, _ = setupSQLStore(t, db)
		playbookRunStore := setupPlaybookRunStore(t, db)

		t.Run("two new users get welcome messages, one old user doesn't", func(t *testing.T) {
			channelID := model.NewId()

			oldID := model.NewId()
			newID1 := model.NewId()
			newID2 := model.NewId()

			err := playbookRunStore.SetViewedChannel(oldID, channelID)
			require.NoError(t, err)

			// Setting multiple times is okay
			err = playbookRunStore.SetViewedChannel(oldID, channelID)
			require.NoError(t, err)
			err = playbookRunStore.SetViewedChannel(oldID, channelID)
			require.NoError(t, err)

			// new users get welcome messages
			hasViewed := playbookRunStore.HasViewedChannel(newID1, channelID)
			require.False(t, hasViewed)
			err = playbookRunStore.SetViewedChannel(newID1, channelID)
			require.NoError(t, err)

			hasViewed = playbookRunStore.HasViewedChannel(newID2, channelID)
			require.False(t, hasViewed)
			err = playbookRunStore.SetViewedChannel(newID2, channelID)
			require.NoError(t, err)

			// old user does not
			hasViewed = playbookRunStore.HasViewedChannel(oldID, channelID)
			require.True(t, hasViewed)

			// new users do not, now:
			hasViewed = playbookRunStore.HasViewedChannel(newID1, channelID)
			require.True(t, hasViewed)
			hasViewed = playbookRunStore.HasViewedChannel(newID2, channelID)
			require.True(t, hasViewed)

			var rows int64
			err = db.Get(&rows, "SELECT COUNT(*) FROM IR_ViewedChannel")
			require.NoError(t, err)
			require.Equal(t, 3, int(rows))

			// cannot add a duplicate row
			if driverName == model.DATABASE_DRIVER_POSTGRES {
				_, err = db.Exec("INSERT INTO IR_ViewedChannel (UserID, ChannelID) VALUES ($1, $2)", oldID, channelID)
				require.Error(t, err)
				require.Contains(t, err.Error(), "duplicate key value")
			} else {
				_, err = db.Exec("INSERT INTO IR_ViewedChannel (UserID, ChannelID) VALUES (?, ?)", oldID, channelID)
				require.Error(t, err)
				require.Contains(t, err.Error(), "Duplicate entry")
			}

			err = db.Get(&rows, "SELECT COUNT(*) FROM IR_ViewedChannel")
			require.NoError(t, err)
			require.Equal(t, 3, int(rows))
		})
	}
}

func setupPlaybookRunStore(t *testing.T, db *sqlx.DB) app.PlaybookRunStore {
	mockCtrl := gomock.NewController(t)

	kvAPI := mock_sqlstore.NewMockKVAPI(mockCtrl)
	configAPI := mock_sqlstore.NewMockConfigurationAPI(mockCtrl)
	pluginAPIClient := PluginAPIClient{
		KV:            kvAPI,
		Configuration: configAPI,
	}

	logger, sqlStore := setupSQLStore(t, db)

	return NewPlaybookRunStore(pluginAPIClient, logger, sqlStore)
}

// PlaybookRunBuilder is a utility to build playbook runs with a default base.
// Use it as:
// NewBuilder.WithName("name").WithXYZ(xyz)....ToPlaybookRun()
type PlaybookRunBuilder struct {
	t           testing.TB
	playbookRun *app.PlaybookRun
}

func NewBuilder(t testing.TB) *PlaybookRunBuilder {
	return &PlaybookRunBuilder{
		t: t,
		playbookRun: &app.PlaybookRun{
			Name:          "base playbook run",
			OwnerUserID:   model.NewId(),
			TeamID:        model.NewId(),
			ChannelID:     model.NewId(),
			CreateAt:      model.GetMillis(),
			DeleteAt:      0,
			PostID:        model.NewId(),
			PlaybookID:    model.NewId(),
			Checklists:    nil,
			CurrentStatus: "Reported",
		},
	}
}

func (ib *PlaybookRunBuilder) WithName(name string) *PlaybookRunBuilder {
	ib.playbookRun.Name = name

	return ib
}

func (ib *PlaybookRunBuilder) WithDescription(desc string) *PlaybookRunBuilder {
	ib.playbookRun.Description = desc

	return ib
}

func (ib *PlaybookRunBuilder) WithID() *PlaybookRunBuilder {
	ib.playbookRun.ID = model.NewId()

	return ib
}

func (ib *PlaybookRunBuilder) WithParticipant(user userInfo) *PlaybookRunBuilder {
	ib.playbookRun.ParticipantIDs = append(ib.playbookRun.ParticipantIDs, user.ID)
	sort.Strings(ib.playbookRun.ParticipantIDs)

	return ib
}

func (ib *PlaybookRunBuilder) ToPlaybookRun() *app.PlaybookRun {
	return ib.playbookRun
}

func (ib *PlaybookRunBuilder) WithCreateAt(createAt int64) *PlaybookRunBuilder {
	ib.playbookRun.CreateAt = createAt

	return ib
}

func (ib *PlaybookRunBuilder) WithDeleteAt(deleteAt int64) *PlaybookRunBuilder {
	ib.playbookRun.DeleteAt = deleteAt

	return ib
}

func (ib *PlaybookRunBuilder) WithChecklists(itemsPerChecklist []int) *PlaybookRunBuilder {
	ib.playbookRun.Checklists = make([]app.Checklist, len(itemsPerChecklist))

	for i, numItems := range itemsPerChecklist {
		var items []app.ChecklistItem
		for j := 0; j < numItems; j++ {
			items = append(items, app.ChecklistItem{
				ID:    model.NewId(),
				Title: fmt.Sprint("Checklist ", i, " - item ", j),
			})
		}

		ib.playbookRun.Checklists[i] = app.Checklist{
			ID:    model.NewId(),
			Title: fmt.Sprint("Checklist ", i),
			Items: items,
		}
	}

	return ib
}

func (ib *PlaybookRunBuilder) WithOwnerUserID(id string) *PlaybookRunBuilder {
	ib.playbookRun.OwnerUserID = id

	return ib
}

func (ib *PlaybookRunBuilder) WithTeamID(id string) *PlaybookRunBuilder {
	ib.playbookRun.TeamID = id

	return ib
}

func (ib *PlaybookRunBuilder) WithCurrentStatus(status string) *PlaybookRunBuilder {
	ib.playbookRun.CurrentStatus = status

	if status == "Resolved" || status == "Archived" {
		ib.playbookRun.EndAt = ib.playbookRun.CreateAt + 100
	}

	return ib
}

func (ib *PlaybookRunBuilder) WithChannel(channel *model.Channel) *PlaybookRunBuilder {
	ib.playbookRun.ChannelID = channel.Id

	// Consider the playbook run name as authoritative.
	channel.DisplayName = ib.playbookRun.Name

	return ib
}

func (ib *PlaybookRunBuilder) WithPlaybookID(id string) *PlaybookRunBuilder {
	ib.playbookRun.PlaybookID = id

	return ib
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
