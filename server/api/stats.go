package api

import (
	"math"
	"net/http"
	"net/url"

	"github.com/mattermost/mattermost-plugin-incident-collaboration/server/permissions"
	"github.com/mattermost/mattermost-plugin-incident-collaboration/server/playbook"

	"github.com/gorilla/mux"
	pluginapi "github.com/mattermost/mattermost-plugin-api"
	"github.com/mattermost/mattermost-plugin-incident-collaboration/server/bot"
	"github.com/mattermost/mattermost-plugin-incident-collaboration/server/sqlstore"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/pkg/errors"
)

type StatsHandler struct {
	*ErrorHandler
	pluginAPI       *pluginapi.Client
	log             bot.Logger
	statsStore      *sqlstore.StatsStore
	playbookService playbook.Service
}

func NewStatsHandler(router *mux.Router, api *pluginapi.Client, log bot.Logger, statsStore *sqlstore.StatsStore, playbookService playbook.Service) *StatsHandler {
	handler := &StatsHandler{
		ErrorHandler:    &ErrorHandler{log: log},
		pluginAPI:       api,
		log:             log,
		statsStore:      statsStore,
		playbookService: playbookService,
	}

	statsRouter := router.PathPrefix("/stats").Subrouter()
	statsRouter.HandleFunc("/playbook", handler.playbookStats).Methods(http.MethodGet)
	statsRouter.HandleFunc("", handler.stats).Methods(http.MethodGet)

	return handler
}

type Stats struct {
	TotalReportedIncidents                int `json:"total_reported_incidents"`
	TotalActiveIncidents                  int `json:"total_active_incidents"`
	TotalActiveParticipants               int `json:"total_active_participants"`
	AverageDurationActiveIncidentsMinutes int `json:"average_duration_active_incidents_minutes"`

	ActiveIncidents        []int `json:"active_incidents"`
	PeopleInIncidents      []int `json:"people_in_incidents"`
	AverageStartToActive   []int `json:"average_start_to_active"`
	AverageStartToResolved []int `json:"average_start_to_resolved"`
}

type PlaybookStats struct {
	RunsInProgress                 int      `json:"runs_in_progress"`
	ParticipantsActive             int      `json:"participants_active"`
	RunsFinishedPrev30Days         int      `json:"runs_finished_prev_30_days"`
	RunsFinishedPercentageChange   int      `json:"runs_finished_percentage_change"`
	RunsStartedPerWeek             []int    `json:"runs_started_per_week"`
	RunsStartedPerWeekLabels       []string `json:"runs_started_per_week_labels"`
	ActiveRunsPerDay               []int    `json:"active_runs_per_day"`
	ActiveRunsPerDayLabels         []string `json:"active_runs_per_day_labels"`
	ActiveParticipantsPerDay       []int    `json:"active_participants_per_day"`
	ActiveParticipantsPerDayLabels []string `json:"active_participants_per_day_labels"`
}

func parseStatsFilters(u *url.URL) (*sqlstore.StatsFilters, error) {
	teamID := u.Query().Get("team_id")
	if teamID == "" {
		return nil, errors.New("bad parameter 'team_id'; 'team_id' is required")
	}

	return &sqlstore.StatsFilters{
		TeamID: teamID,
	}, nil
}

func parsePlaybookStatsFilters(u *url.URL) (*sqlstore.StatsFilters, error) {
	playbookID := u.Query().Get("playbook_id")
	if playbookID == "" {
		return nil, errors.New("bad parameter 'playbook_id'; 'playbook_id' is required")
	}

	return &sqlstore.StatsFilters{
		PlaybookID: playbookID,
	}, nil
}

func (h *StatsHandler) stats(w http.ResponseWriter, r *http.Request) {
	userID := r.Header.Get("Mattermost-User-ID")

	filters, err := parseStatsFilters(r.URL)
	if err != nil {
		h.HandleErrorWithCode(w, http.StatusBadRequest, "Bad filters", err)
		return
	}

	if !h.pluginAPI.User.HasPermissionToTeam(userID, filters.TeamID, model.PERMISSION_LIST_TEAM_CHANNELS) {
		h.HandleErrorWithCode(w, http.StatusForbidden, "permissions error", errors.Errorf(
			"userID %s does not have view permission for teamID %s", userID, filters.TeamID))
		return
	}

	stats := Stats{
		TotalReportedIncidents:                h.statsStore.TotalReportedIncidents(filters),
		TotalActiveIncidents:                  h.statsStore.TotalActiveIncidents(filters),
		TotalActiveParticipants:               h.statsStore.TotalActiveParticipants(filters),
		AverageDurationActiveIncidentsMinutes: h.statsStore.AverageDurationActiveIncidentsMinutes(filters),

		ActiveIncidents:        h.statsStore.CountActiveIncidentsByDay(filters),
		PeopleInIncidents:      h.statsStore.UniquePeopleInIncidents(filters),
		AverageStartToActive:   h.statsStore.AverageStartToActive(filters),
		AverageStartToResolved: h.statsStore.AverageStartToResolved(filters),
	}

	ReturnJSON(w, stats, http.StatusOK)
}

func (h *StatsHandler) playbookStats(w http.ResponseWriter, r *http.Request) {
	userID := r.Header.Get("Mattermost-User-ID")

	filters, err := parsePlaybookStatsFilters(r.URL)
	if err != nil {
		h.HandleErrorWithCode(w, http.StatusBadRequest, "Bad filters", err)
		return
	}

	playbookOfInterest, err := h.playbookService.Get(filters.PlaybookID)
	if err != nil {
		h.HandleError(w, err)
		return
	}

	if err2 := permissions.PlaybookAccess(userID, playbookOfInterest, h.pluginAPI); err2 != nil {
		h.HandleErrorWithCode(w, http.StatusForbidden, "Not authorized", err2)
		return
	}

	runsFinishedLast30Days := h.statsStore.RunsFinishedBetweenDays(filters, 30, 0)
	runsFinishedBetween60and30DaysAgo := h.statsStore.RunsFinishedBetweenDays(filters, 60, 31)
	var percentageChange int
	if runsFinishedBetween60and30DaysAgo == 0 {
		percentageChange = 99999999
	} else {
		percentageChange = int(math.Floor(float64((runsFinishedLast30Days-runsFinishedBetween60and30DaysAgo)/runsFinishedBetween60and30DaysAgo) * 100))
	}
	runsStartedPerWeek, runsStartedPerWeekLabels := h.statsStore.RunsStartedPerWeekLastXWeeks(12, filters)
	activeRunsPerDay, activeRunsPerDayLabels := h.statsStore.ActiveRunsPerDayLastXDays(14, filters)
	activeParticipantsPerDay, activeParticipantsPerDayLabels := h.statsStore.ActiveParticipantsPerDayLastXDays(14, filters)

	ReturnJSON(w, &PlaybookStats{
		RunsInProgress:                 h.statsStore.TotalInProgressIncidents(filters),
		ParticipantsActive:             h.statsStore.TotalActiveParticipants(filters),
		RunsFinishedPrev30Days:         runsFinishedLast30Days,
		RunsFinishedPercentageChange:   percentageChange,
		RunsStartedPerWeek:             runsStartedPerWeek,
		RunsStartedPerWeekLabels:       runsStartedPerWeekLabels,
		ActiveRunsPerDay:               activeRunsPerDay,
		ActiveRunsPerDayLabels:         activeRunsPerDayLabels,
		ActiveParticipantsPerDay:       activeParticipantsPerDay,
		ActiveParticipantsPerDayLabels: activeParticipantsPerDayLabels,
	}, http.StatusOK)
}
