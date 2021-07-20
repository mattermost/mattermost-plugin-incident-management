package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"strings"

	"github.com/gorilla/mux"
	"github.com/mattermost/mattermost-plugin-incident-collaboration/server/app"
	"github.com/mattermost/mattermost-plugin-incident-collaboration/server/bot"
	"github.com/mattermost/mattermost-plugin-incident-collaboration/server/config"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/pkg/errors"

	pluginapi "github.com/mattermost/mattermost-plugin-api"
)

// PlaybookHandler is the API handler.
type PlaybookHandler struct {
	*ErrorHandler
	playbookService app.PlaybookService
	pluginAPI       *pluginapi.Client
	log             bot.Logger
	config          config.Service
}

const SettingsKey = "global_settings"
const maxPlaybooksToAutocomplete = 15

// NewPlaybookHandler returns a new playbook api handler
func NewPlaybookHandler(router *mux.Router, playbookService app.PlaybookService, api *pluginapi.Client, log bot.Logger, configService config.Service) *PlaybookHandler {
	handler := &PlaybookHandler{
		ErrorHandler:    &ErrorHandler{log: log},
		playbookService: playbookService,
		pluginAPI:       api,
		log:             log,
		config:          configService,
	}

	playbooksRouter := router.PathPrefix("/playbooks").Subrouter()

	playbooksRouter.HandleFunc("", handler.createPlaybook).Methods(http.MethodPost)

	playbooksRouter.HandleFunc("", handler.getPlaybooks).Methods(http.MethodGet)
	playbooksRouter.HandleFunc("/autocomplete", handler.getPlaybooksAutoComplete).Methods(http.MethodGet)
	playbooksRouter.HandleFunc("/count", handler.getPlaybookCount).Methods(http.MethodGet)

	playbookRouter := playbooksRouter.PathPrefix("/{id:[A-Za-z0-9]+}").Subrouter()
	playbookRouter.HandleFunc("", handler.getPlaybook).Methods(http.MethodGet)
	playbookRouter.HandleFunc("", handler.updatePlaybook).Methods(http.MethodPut)
	playbookRouter.HandleFunc("", handler.deletePlaybook).Methods(http.MethodDelete)

	return handler
}

func (h *PlaybookHandler) createPlaybook(w http.ResponseWriter, r *http.Request) {
	userID := r.Header.Get("Mattermost-User-ID")

	var playbook app.Playbook
	if err := json.NewDecoder(r.Body).Decode(&playbook); err != nil {
		h.HandleErrorWithCode(w, http.StatusBadRequest, "unable to decode playbook", err)
		return
	}

	if playbook.ID != "" {
		h.HandleErrorWithCode(w, http.StatusBadRequest, "Playbook given already has ID", nil)
		return
	}

	if err := app.CreatePlaybook(userID, playbook, h.config, h.pluginAPI, h.playbookService); err != nil {
		h.HandleErrorWithCode(w, http.StatusForbidden, "Not authorized", err)
		return
	}

	if playbook.WebhookOnCreationEnabled {
		url, err := url.ParseRequestURI(playbook.WebhookOnCreationURL)
		if err != nil {
			h.HandleErrorWithCode(w, http.StatusBadRequest, "invalid creation webhook URL", err)
			return
		}

		if url.Scheme != "http" && url.Scheme != "https" {
			msg := fmt.Sprintf("protocol in creation webhook URL is %s; only HTTP and HTTPS are accepted", url.Scheme)
			h.HandleErrorWithCode(w, http.StatusBadRequest, msg, errors.Errorf(msg))
			return
		}
	}

	if playbook.WebhookOnStatusUpdateEnabled {
		url, err := url.ParseRequestURI(playbook.WebhookOnStatusUpdateURL)
		if err != nil {
			h.HandleErrorWithCode(w, http.StatusBadRequest, "invalid update webhook URL", err)
			return
		}

		if url.Scheme != "http" && url.Scheme != "https" {
			msg := fmt.Sprintf("protocol in update webhook URL is %s; only HTTP and HTTPS are accepted", url.Scheme)
			h.HandleErrorWithCode(w, http.StatusBadRequest, msg, errors.Errorf(msg))
			return
		}
	}

	if len(playbook.SignalAnyKeywords) != 0 {
		playbook.SignalAnyKeywords = removeDuplicates(playbook.SignalAnyKeywords)
	}

	id, err := h.playbookService.Create(playbook, userID)
	if err != nil {
		h.HandleError(w, err)
		return
	}

	result := struct {
		ID string `json:"id"`
	}{
		ID: id,
	}
	w.Header().Add("Location", fmt.Sprintf("/api/v0/playbooks/%s", playbook.ID))
	ReturnJSON(w, &result, http.StatusCreated)
}

func (h *PlaybookHandler) getPlaybook(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	userID := r.Header.Get("Mattermost-User-ID")

	playbook, err := h.playbookService.Get(vars["id"])
	if err != nil {
		h.HandleError(w, err)
		return
	}

	if err := app.PlaybookAccess(userID, playbook, h.pluginAPI); err != nil {
		h.HandleErrorWithCode(w, http.StatusForbidden, "Not authorized", err)
		return
	}

	ReturnJSON(w, &playbook, http.StatusOK)
}

func (h *PlaybookHandler) updatePlaybook(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	userID := r.Header.Get("Mattermost-User-ID")
	var playbook app.Playbook
	if err := json.NewDecoder(r.Body).Decode(&playbook); err != nil {
		h.HandleErrorWithCode(w, http.StatusBadRequest, "unable to decode playbook", err)
		return
	}

	// Force parsed playbook id to be URL parameter id
	playbook.ID = vars["id"]

	oldPlaybook, err := h.playbookService.Get(vars["id"])
	if err != nil {
		h.HandleError(w, err)
		return
	}

	if err3 := app.PlaybookModify(userID, playbook, oldPlaybook, h.config, h.pluginAPI, h.playbookService); err3 != nil {
		h.HandleErrorWithCode(w, http.StatusForbidden, "Not authorized", err3)
		return
	}

	if err4 := doPlaybookModificationChecks(&playbook, userID, h.pluginAPI); err4 != nil {
		h.HandleErrorWithCode(w, http.StatusForbidden, "Not authorized", err4)
		return
	}

	if playbook.WebhookOnCreationEnabled {
		url, err2 := url.ParseRequestURI(playbook.WebhookOnCreationURL)
		if err2 != nil {
			h.HandleErrorWithCode(w, http.StatusBadRequest, "invalid creation webhook URL", err2)
			return
		}

		if url.Scheme != "http" && url.Scheme != "https" {
			msg := fmt.Sprintf("protocol in creation webhook URL is %s; only HTTP and HTTPS are accepted", url.Scheme)
			h.HandleErrorWithCode(w, http.StatusBadRequest, msg, errors.Errorf(msg))
			return
		}
	}

	if playbook.WebhookOnStatusUpdateEnabled {
		url, err2 := url.ParseRequestURI(playbook.WebhookOnStatusUpdateURL)
		if err2 != nil {
			h.HandleErrorWithCode(w, http.StatusBadRequest, "invalid update webhook URL", err2)
			return
		}

		if url.Scheme != "http" && url.Scheme != "https" {
			msg := fmt.Sprintf("protocol in update webhook URL is %s; only HTTP and HTTPS are accepted", url.Scheme)
			h.HandleErrorWithCode(w, http.StatusBadRequest, msg, errors.Errorf(msg))
			return
		}
	}

	if len(playbook.SignalAnyKeywords) != 0 {
		playbook.SignalAnyKeywords = removeDuplicates(playbook.SignalAnyKeywords)
	}

	err = h.playbookService.Update(playbook, userID)
	if err != nil {
		h.HandleError(w, err)
		return
	}

	w.WriteHeader(http.StatusOK)
}

// doPlaybookModificationChecks performs permissions checks that can be resolved though modification of the input.
// This function modifies the playbook argument.
func doPlaybookModificationChecks(playbook *app.Playbook, userID string, pluginAPI *pluginapi.Client) error {
	filteredUsers := []string{}
	for _, userID := range playbook.InvitedUserIDs {
		if !pluginAPI.User.HasPermissionToTeam(userID, playbook.TeamID, model.PERMISSION_VIEW_TEAM) {
			pluginAPI.Log.Warn("user does not have permissions to playbook's team, removing from automated invite list", "teamID", playbook.TeamID, "userID", userID)
			continue
		}
		filteredUsers = append(filteredUsers, userID)
	}
	playbook.InvitedUserIDs = filteredUsers

	filteredGroups := []string{}
	for _, groupID := range playbook.InvitedGroupIDs {
		var group *model.Group
		group, err := pluginAPI.Group.Get(groupID)
		if err != nil {
			pluginAPI.Log.Warn("failed to query group", "group_id", groupID)
			continue
		}

		if !group.AllowReference {
			pluginAPI.Log.Warn("group does not allow references, removing from automated invite list", "group_id", groupID)
			continue
		}

		filteredGroups = append(filteredGroups, groupID)
	}
	playbook.InvitedGroupIDs = filteredGroups

	if playbook.DefaultOwnerID != "" && !app.IsMemberOfTeamID(playbook.DefaultOwnerID, playbook.TeamID, pluginAPI) {
		pluginAPI.Log.Warn("owner is not a member of the playbook's team, disabling default owner", "teamID", playbook.TeamID, "userID", playbook.DefaultOwnerID)
		playbook.DefaultOwnerID = ""
		playbook.DefaultOwnerEnabled = false
	}

	if playbook.AnnouncementChannelID != "" &&
		!pluginAPI.User.HasPermissionToChannel(userID, playbook.AnnouncementChannelID, model.PERMISSION_CREATE_POST) {
		pluginAPI.Log.Warn("announcement channel is not valid, disabling announcement channel setting")
		playbook.AnnouncementChannelID = ""
		playbook.AnnouncementChannelEnabled = false
	}

	return nil
}

func (h *PlaybookHandler) deletePlaybook(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	userID := r.Header.Get("Mattermost-User-ID")

	playbookToDelete, err := h.playbookService.Get(vars["id"])
	if err != nil {
		h.HandleError(w, err)
		return
	}

	if err2 := app.PlaybookAccess(userID, playbookToDelete, h.pluginAPI); err2 != nil {
		h.HandleErrorWithCode(w, http.StatusForbidden, "Not authorized", err2)
		return
	}

	err = h.playbookService.Delete(playbookToDelete, userID)
	if err != nil {
		h.HandleError(w, err)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (h *PlaybookHandler) getPlaybooks(w http.ResponseWriter, r *http.Request) {
	params := r.URL.Query()
	teamID := params.Get("team_id")
	userID := r.Header.Get("Mattermost-User-ID")
	opts, err := parseGetPlaybooksOptions(r.URL)
	if err != nil {
		h.HandleErrorWithCode(w, http.StatusBadRequest, fmt.Sprintf("failed to get playbooks: %s", err.Error()), nil)
		return
	}

	if teamID != "" && !app.CanViewTeam(userID, teamID, h.pluginAPI) {
		h.HandleErrorWithCode(w, http.StatusForbidden, "Not authorized", errors.Errorf(
			"userID %s does not have permission to get playbooks on teamID %s",
			userID,
			teamID,
		))
		return
	}

	// Exclude guest users
	if isGuest, errg := app.IsGuest(userID, h.pluginAPI); errg != nil {
		h.HandleError(w, errg)
		return
	} else if isGuest {
		h.HandleErrorWithCode(w, http.StatusForbidden, "Not authorized", errors.Errorf(
			"userID %s does not have permission to get playbooks on teamID %s because they are a guest",
			userID,
			teamID,
		))
		return
	}

	requesterInfo := app.RequesterInfo{
		UserID:  userID,
		TeamID:  teamID,
		IsAdmin: app.IsAdmin(userID, h.pluginAPI),
	}

	playbookResults, err := h.playbookService.GetPlaybooksForTeam(requesterInfo, teamID, opts)
	if err != nil {
		h.HandleError(w, err)
		return
	}

	ReturnJSON(w, playbookResults, http.StatusOK)
}

func (h *PlaybookHandler) getPlaybooksAutoComplete(w http.ResponseWriter, r *http.Request) {
	query := r.URL.Query()
	teamID := query.Get("team_id")
	userID := r.Header.Get("Mattermost-User-ID")

	if teamID != "" && !app.CanViewTeam(userID, teamID, h.pluginAPI) {
		h.HandleErrorWithCode(w, http.StatusForbidden, "user does not have permissions to view team", nil)
		return
	}

	requesterInfo := app.RequesterInfo{
		UserID:  userID,
		TeamID:  teamID,
		IsAdmin: app.IsAdmin(userID, h.pluginAPI),
	}

	playbooksResult, err := h.playbookService.GetPlaybooksForTeam(requesterInfo, teamID, app.PlaybookFilterOptions{
		Page:    0,
		PerPage: maxPlaybooksToAutocomplete,
	})
	if err != nil {
		h.HandleError(w, err)
		return
	}

	list := make([]model.AutocompleteListItem, 0)

	for _, playbook := range playbooksResult.Items {
		list = append(list, model.AutocompleteListItem{
			Item:     playbook.ID,
			HelpText: playbook.Title,
		})
	}

	ReturnJSON(w, list, http.StatusOK)
}

func (h *PlaybookHandler) getPlaybookCount(w http.ResponseWriter, r *http.Request) {
	query := r.URL.Query()
	teamID := query.Get("team_id")
	userID := r.Header.Get("Mattermost-User-ID")

	if teamID != "" && !app.CanViewTeam(userID, teamID, h.pluginAPI) {
		h.HandleErrorWithCode(w, http.StatusForbidden, "user does not have permissions to view team", nil)
		return
	}

	count, err := h.playbookService.GetNumPlaybooksForTeam(teamID)
	if err != nil {
		h.HandleError(w, err)
		return
	}

	countStruct := struct {
		Count int `json:"count"`
	}{count}

	ReturnJSON(w, countStruct, http.StatusOK)
}

func parseGetPlaybooksOptions(u *url.URL) (app.PlaybookFilterOptions, error) {
	params := u.Query()

	var sortField app.SortField
	param := strings.ToLower(params.Get("sort"))
	switch param {
	case "title", "":
		sortField = app.SortByTitle
	case "stages":
		sortField = app.SortByStages
	case "steps":
		sortField = app.SortBySteps
	default:
		return app.PlaybookFilterOptions{}, errors.Errorf("bad parameter 'sort' (%s): it should be empty or one of 'title', 'stages' or 'steps'", param)
	}

	var sortDirection app.SortDirection
	param = strings.ToLower(params.Get("direction"))
	switch param {
	case "asc", "":
		sortDirection = app.DirectionAsc
	case "desc":
		sortDirection = app.DirectionDesc
	default:
		return app.PlaybookFilterOptions{}, errors.Errorf("bad parameter 'direction' (%s): it should be empty or one of 'asc' or 'desc'", param)
	}

	pageParam := params.Get("page")
	if pageParam == "" {
		pageParam = "0"
	}
	page, err := strconv.Atoi(pageParam)
	if err != nil {
		return app.PlaybookFilterOptions{}, errors.Wrapf(err, "bad parameter 'page': it should be a number")
	}
	if page < 0 {
		return app.PlaybookFilterOptions{}, errors.Errorf("bad parameter 'page': it should be a positive number")
	}

	perPageParam := params.Get("per_page")
	if perPageParam == "" || perPageParam == "0" {
		perPageParam = "1000"
	}
	perPage, err := strconv.Atoi(perPageParam)
	if err != nil {
		return app.PlaybookFilterOptions{}, errors.Wrapf(err, "bad parameter 'per_page': it should be a number")
	}
	if perPage < 0 {
		return app.PlaybookFilterOptions{}, errors.Errorf("bad parameter 'per_page': it should be a positive number")
	}

	return app.PlaybookFilterOptions{
		Sort:      sortField,
		Direction: sortDirection,
		Page:      page,
		PerPage:   perPage,
	}, nil
}

func removeDuplicates(a []string) []string {
	items := make(map[string]bool)
	for _, item := range a {
		if item != "" {
			items[item] = true
		}
	}
	res := make([]string, 0, len(items))
	for item := range items {
		res = append(res, item)
	}
	return res
}
