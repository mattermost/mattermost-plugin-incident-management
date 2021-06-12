package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/gorilla/mux"
	"github.com/mattermost/mattermost-plugin-incident-collaboration/client"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/pkg/errors"

	pluginapi "github.com/mattermost/mattermost-plugin-api"

	"github.com/mattermost/mattermost-plugin-incident-collaboration/server/app"
	"github.com/mattermost/mattermost-plugin-incident-collaboration/server/bot"
	"github.com/mattermost/mattermost-plugin-incident-collaboration/server/config"
)

// IncidentHandler is the API handler.
type IncidentHandler struct {
	*ErrorHandler
	config          config.Service
	incidentService app.IncidentService
	playbookService app.PlaybookService
	pluginAPI       *pluginapi.Client
	poster          bot.Poster
	log             bot.Logger
}

// NewIncidentHandler Creates a new Plugin API handler.
func NewIncidentHandler(router *mux.Router, incidentService app.IncidentService, playbookService app.PlaybookService,
	api *pluginapi.Client, poster bot.Poster, log bot.Logger, configService config.Service) *IncidentHandler {
	handler := &IncidentHandler{
		ErrorHandler:    &ErrorHandler{log: log},
		incidentService: incidentService,
		playbookService: playbookService,
		pluginAPI:       api,
		poster:          poster,
		log:             log,
		config:          configService,
	}

	incidentsRouter := router.PathPrefix("/incidents").Subrouter()
	incidentsRouter.HandleFunc("", handler.getIncidents).Methods(http.MethodGet)
	incidentsRouter.HandleFunc("", handler.createIncidentFromPost).Methods(http.MethodPost)

	incidentsRouter.HandleFunc("/dialog", handler.createIncidentFromDialog).Methods(http.MethodPost)
	incidentsRouter.HandleFunc("/add-to-timeline-dialog", handler.addToTimelineDialog).Methods(http.MethodPost)
	incidentsRouter.HandleFunc("/owners", handler.getOwners).Methods(http.MethodGet)
	incidentsRouter.HandleFunc("/channels", handler.getChannels).Methods(http.MethodGet)
	incidentsRouter.HandleFunc("/checklist-autocomplete", handler.getChecklistAutocomplete).Methods(http.MethodGet)
	incidentsRouter.HandleFunc("/checklist-autocomplete-item", handler.getChecklistAutocompleteItem).Methods(http.MethodGet)

	incidentRouter := incidentsRouter.PathPrefix("/{id:[A-Za-z0-9]+}").Subrouter()
	incidentRouter.HandleFunc("", handler.getIncident).Methods(http.MethodGet)
	incidentRouter.HandleFunc("/metadata", handler.getIncidentMetadata).Methods(http.MethodGet)

	incidentRouterAuthorized := incidentRouter.PathPrefix("").Subrouter()
	incidentRouterAuthorized.Use(handler.checkEditPermissions)
	incidentRouterAuthorized.HandleFunc("", handler.updateIncident).Methods(http.MethodPatch)
	incidentRouterAuthorized.HandleFunc("/owner", handler.changeOwner).Methods(http.MethodPost)
	incidentRouterAuthorized.HandleFunc("/status", handler.status).Methods(http.MethodPost)
	incidentRouterAuthorized.HandleFunc("/update-status-dialog", handler.updateStatusDialog).Methods(http.MethodPost)
	incidentRouterAuthorized.HandleFunc("/reminder/button-update", handler.reminderButtonUpdate).Methods(http.MethodPost)
	incidentRouterAuthorized.HandleFunc("/reminder/button-dismiss", handler.reminderButtonDismiss).Methods(http.MethodPost)
	incidentRouterAuthorized.HandleFunc("/no-retrospective-button", handler.noRetrospectiveButton).Methods(http.MethodPost)
	incidentRouterAuthorized.HandleFunc("/timeline/{eventID:[A-Za-z0-9]+}", handler.removeTimelineEvent).Methods(http.MethodDelete)
	incidentRouterAuthorized.HandleFunc("/check-and-send-message-on-join/{channel_id:[A-Za-z0-9]+}", handler.checkAndSendMessageOnJoin).Methods(http.MethodGet)

	channelRouter := incidentsRouter.PathPrefix("/channel").Subrouter()
	channelRouter.HandleFunc("/{channel_id:[A-Za-z0-9]+}", handler.getIncidentByChannel).Methods(http.MethodGet)

	checklistsRouter := incidentRouterAuthorized.PathPrefix("/checklists").Subrouter()

	checklistRouter := checklistsRouter.PathPrefix("/{checklist:[0-9]+}").Subrouter()
	checklistRouter.HandleFunc("/add", handler.addChecklistItem).Methods(http.MethodPut)
	checklistRouter.HandleFunc("/reorder", handler.reorderChecklist).Methods(http.MethodPut)
	checklistRouter.HandleFunc("/add-dialog", handler.addChecklistItemDialog).Methods(http.MethodPost)

	checklistItem := checklistRouter.PathPrefix("/item/{item:[0-9]+}").Subrouter()
	checklistItem.HandleFunc("", handler.itemDelete).Methods(http.MethodDelete)
	checklistItem.HandleFunc("", handler.itemEdit).Methods(http.MethodPut)
	checklistItem.HandleFunc("/state", handler.itemSetState).Methods(http.MethodPut)
	checklistItem.HandleFunc("/assignee", handler.itemSetAssignee).Methods(http.MethodPut)
	checklistItem.HandleFunc("/run", handler.itemRun).Methods(http.MethodPost)

	retrospectiveRouter := incidentRouterAuthorized.PathPrefix("/retrospective").Subrouter()
	retrospectiveRouter.HandleFunc("", handler.updateRetrospective).Methods(http.MethodPost)
	retrospectiveRouter.HandleFunc("/publish", handler.publishRetrospective).Methods(http.MethodPost)

	return handler
}

func (h *IncidentHandler) checkEditPermissions(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		vars := mux.Vars(r)
		userID := r.Header.Get("Mattermost-User-ID")

		incident, err := h.incidentService.GetIncident(vars["id"])
		if err != nil {
			h.HandleError(w, err)
			return
		}

		if err := app.EditIncident(userID, incident.ChannelID, h.pluginAPI); err != nil {
			if errors.Is(err, app.ErrNoPermissions) {
				h.HandleErrorWithCode(w, http.StatusForbidden, "Not authorized", err)
				return
			}
			h.HandleError(w, err)
			return
		}

		next.ServeHTTP(w, r)
	})
}

// createIncidentFromPost handles the POST /incidents endpoint
func (h *IncidentHandler) createIncidentFromPost(w http.ResponseWriter, r *http.Request) {
	userID := r.Header.Get("Mattermost-User-ID")

	var incidentCreateOptions client.IncidentCreateOptions
	if err := json.NewDecoder(r.Body).Decode(&incidentCreateOptions); err != nil {
		h.HandleErrorWithCode(w, http.StatusBadRequest, "unable to decode incident create options", err)
		return
	}

	if !app.IsOnEnabledTeam(incidentCreateOptions.TeamID, h.config) {
		h.HandleErrorWithCode(w, http.StatusBadRequest, "not enabled on this team", nil)
		return
	}

	payloadIncident := app.Incident{
		OwnerUserID: incidentCreateOptions.OwnerUserID,
		TeamID:      incidentCreateOptions.TeamID,
		Name:        incidentCreateOptions.Name,
		Description: incidentCreateOptions.Description,
		PostID:      incidentCreateOptions.PostID,
		PlaybookID:  incidentCreateOptions.PlaybookID,
	}

	newIncident, err := h.createIncident(payloadIncident, userID)

	if errors.Is(err, app.ErrPermission) {
		h.HandleErrorWithCode(w, http.StatusForbidden, "unable to create incident", err)
		return
	}

	if errors.Is(err, app.ErrMalformedIncident) {
		h.HandleErrorWithCode(w, http.StatusBadRequest, "unable to create incident", err)
		return
	}

	if err != nil {
		h.HandleError(w, errors.Wrapf(err, "unable to create incident"))
		return
	}

	h.poster.PublishWebsocketEventToUser(app.IncidentCreatedWSEvent, map[string]interface{}{
		"incident": newIncident,
	}, userID)

	w.Header().Add("Location", fmt.Sprintf("/api/v0/incidents/%s", newIncident.ID))
	ReturnJSON(w, &newIncident, http.StatusCreated)
}

// Note that this currently does nothing. This is temporary given the removal of stages. Will be used by status.
func (h *IncidentHandler) updateIncident(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	incidentID := vars["id"]
	//userID := r.Header.Get("Mattermost-User-ID")

	oldIncident, err := h.incidentService.GetIncident(incidentID)
	if err != nil {
		h.HandleError(w, err)
		return
	}

	var updates app.UpdateOptions
	if err = json.NewDecoder(r.Body).Decode(&updates); err != nil {
		h.HandleErrorWithCode(w, http.StatusBadRequest, "unable to decode payload", err)
		return
	}

	updatedIncident := oldIncident

	ReturnJSON(w, updatedIncident, http.StatusOK)
}

// createIncidentFromDialog handles the interactive dialog submission when a user presses confirm on
// the create incident dialog.
func (h *IncidentHandler) createIncidentFromDialog(w http.ResponseWriter, r *http.Request) {
	userID := r.Header.Get("Mattermost-User-ID")

	request := model.SubmitDialogRequestFromJson(r.Body)
	if request == nil {
		h.HandleErrorWithCode(w, http.StatusBadRequest, "failed to decode SubmitDialogRequest", nil)
		return
	}

	if userID != request.UserId {
		h.HandleErrorWithCode(w, http.StatusBadRequest, "interactive dialog's userID must be the same as the requester's userID", nil)
		return
	}

	if !app.IsOnEnabledTeam(request.TeamId, h.config) {
		h.HandleErrorWithCode(w, http.StatusBadRequest, "not enabled on this team", nil)
		return
	}

	var state app.DialogState
	err := json.Unmarshal([]byte(request.State), &state)
	if err != nil {
		h.HandleErrorWithCode(w, http.StatusBadRequest, "failed to unmarshal dialog state", err)
		return
	}

	var playbookID, name string
	if rawPlaybookID, ok := request.Submission[app.DialogFieldPlaybookIDKey].(string); ok {
		playbookID = rawPlaybookID
	}
	if rawName, ok := request.Submission[app.DialogFieldNameKey].(string); ok {
		name = rawName
	}

	payloadIncident := app.Incident{
		OwnerUserID: request.UserId,
		TeamID:      request.TeamId,
		Name:        name,
		PostID:      state.PostID,
		PlaybookID:  playbookID,
	}

	newIncident, err := h.createIncident(payloadIncident, request.UserId)
	if err != nil {
		if errors.Is(err, app.ErrMalformedIncident) {
			h.HandleErrorWithCode(w, http.StatusBadRequest, "unable to create incident", err)
			return
		}

		var msg string

		if errors.Is(err, app.ErrChannelDisplayNameInvalid) {
			msg = "The incident name is invalid or too long. Please use a valid name with fewer than 64 characters."
		} else if errors.Is(err, app.ErrPermission) {
			msg = err.Error()
		}

		if msg != "" {
			resp := &model.SubmitDialogResponse{
				Errors: map[string]string{
					app.DialogFieldNameKey: msg,
				},
			}
			_, _ = w.Write(resp.ToJson())
			return
		}

		h.HandleError(w, err)
		return
	}

	h.poster.PublishWebsocketEventToUser(app.IncidentCreatedWSEvent, map[string]interface{}{
		"client_id": state.ClientID,
		"incident":  newIncident,
	}, request.UserId)

	if err := h.postIncidentCreatedMessage(newIncident, request.ChannelId); err != nil {
		h.HandleError(w, err)
		return
	}

	w.Header().Add("Location", fmt.Sprintf("/api/v0/incidents/%s", newIncident.ID))
	w.WriteHeader(http.StatusCreated)
}

// addToTimelineDialog handles the interactive dialog submission when a user clicks the post action
// menu option "Add to incident timeline".
func (h *IncidentHandler) addToTimelineDialog(w http.ResponseWriter, r *http.Request) {
	userID := r.Header.Get("Mattermost-User-ID")

	request := model.SubmitDialogRequestFromJson(r.Body)
	if request == nil {
		h.HandleErrorWithCode(w, http.StatusBadRequest, "failed to decode SubmitDialogRequest", nil)
		return
	}

	if userID != request.UserId {
		h.HandleErrorWithCode(w, http.StatusBadRequest, "interactive dialog's userID must be the same as the requester's userID", nil)
		return
	}

	var incidentID, summary string
	if rawIncidentID, ok := request.Submission[app.DialogFieldIncidentKey].(string); ok {
		incidentID = rawIncidentID
	}
	if rawSummary, ok := request.Submission[app.DialogFieldSummary].(string); ok {
		summary = rawSummary
	}

	incident, incErr := h.incidentService.GetIncident(incidentID)
	if incErr != nil {
		h.HandleError(w, incErr)
		return
	}

	if err := app.EditIncident(userID, incident.ChannelID, h.pluginAPI); err != nil {
		return
	}

	var state app.DialogStateAddToTimeline
	err := json.Unmarshal([]byte(request.State), &state)
	if err != nil {
		h.HandleErrorWithCode(w, http.StatusBadRequest, "failed to unmarshal dialog state", err)
		return
	}

	if err = h.incidentService.AddPostToTimeline(incidentID, userID, state.PostID, summary); err != nil {
		h.HandleError(w, errors.Wrap(err, "failed to add post to timeline"))
		return
	}

	w.WriteHeader(http.StatusOK)
}

func (h *IncidentHandler) createIncident(newIncident app.Incident, userID string) (*app.Incident, error) {
	if newIncident.ID != "" {
		return nil, errors.Wrap(app.ErrMalformedIncident, "incident already has an id")
	}

	if newIncident.ChannelID != "" {
		return nil, errors.Wrap(app.ErrMalformedIncident, "incident channel already has an id")
	}

	if newIncident.CreateAt != 0 {
		return nil, errors.Wrap(app.ErrMalformedIncident, "incident channel already has created at date")
	}

	if newIncident.TeamID == "" {
		return nil, errors.Wrap(app.ErrMalformedIncident, "missing team id of incident")
	}

	if newIncident.OwnerUserID == "" {
		return nil, errors.Wrap(app.ErrMalformedIncident, "missing owner user id of incident")
	}

	if newIncident.Name == "" {
		return nil, errors.Wrap(app.ErrMalformedIncident, "missing name of incident")
	}

	// Owner should have permission to the team
	if !app.CanViewTeam(newIncident.OwnerUserID, newIncident.TeamID, h.pluginAPI) {
		return nil, errors.Wrap(app.ErrPermission, "owner user does not have permissions for the team")
	}

	public := true
	var thePlaybook *app.Playbook
	if newIncident.PlaybookID != "" {
		pb, err := h.playbookService.Get(newIncident.PlaybookID)
		if err != nil {
			return nil, errors.Wrapf(err, "failed to get playbook")
		}

		if len(pb.MemberIDs) != 0 && !sliceContains(pb.MemberIDs, userID) {
			return nil, errors.New("userID is not a member of playbook")
		}

		newIncident.Checklists = pb.Checklists
		public = pb.CreatePublicIncident

		newIncident.BroadcastChannelID = pb.BroadcastChannelID
		newIncident.Description = pb.Description
		newIncident.ReminderMessageTemplate = pb.ReminderMessageTemplate
		newIncident.PreviousReminder = time.Duration(pb.ReminderTimerDefaultSeconds) * time.Second

		newIncident.InvitedUserIDs = []string{}
		newIncident.InvitedGroupIDs = []string{}
		if pb.InviteUsersEnabled {
			newIncident.InvitedUserIDs = pb.InvitedUserIDs
			newIncident.InvitedGroupIDs = pb.InvitedGroupIDs
		}

		if pb.DefaultOwnerEnabled {
			newIncident.DefaultOwnerID = pb.DefaultOwnerID
		}

		if pb.AnnouncementChannelEnabled {
			newIncident.AnnouncementChannelID = pb.AnnouncementChannelID
		}

		if pb.WebhookOnCreationEnabled {
			newIncident.WebhookOnCreationURL = pb.WebhookOnCreationURL
		}

		if pb.WebhookOnStatusUpdateEnabled {
			newIncident.WebhookOnStatusUpdateURL = pb.WebhookOnStatusUpdateURL
		}

		if pb.MessageOnJoinEnabled {
			newIncident.MessageOnJoin = pb.MessageOnJoin
		}

		newIncident.RetrospectiveReminderIntervalSeconds = pb.RetrospectiveReminderIntervalSeconds
		newIncident.Retrospective = pb.RetrospectiveTemplate

		thePlaybook = &pb
	}

	permission := model.PERMISSION_CREATE_PRIVATE_CHANNEL
	permissionMessage := "You are not able to create a private channel"
	if public {
		permission = model.PERMISSION_CREATE_PUBLIC_CHANNEL
		permissionMessage = "You are not able to create a public channel"
	}
	if !h.pluginAPI.User.HasPermissionToTeam(userID, newIncident.TeamID, permission) {
		return nil, errors.Wrap(app.ErrPermission, permissionMessage)
	}

	if newIncident.PostID != "" {
		post, err := h.pluginAPI.Post.GetPost(newIncident.PostID)
		if err != nil {
			return nil, errors.Wrapf(err, "failed to get incident original post")
		}
		if !app.MemberOfChannelID(userID, post.ChannelId, h.pluginAPI) {
			return nil, errors.New("user is not a member of the channel containing the incident's original post")
		}
	}
	return h.incidentService.CreateIncident(&newIncident, thePlaybook, userID, public)
}

func (h *IncidentHandler) getRequesterInfo(userID string) (app.RequesterInfo, error) {
	return app.GetRequesterInfo(userID, h.pluginAPI)
}

// getIncidents handles the GET /incidents endpoint.
func (h *IncidentHandler) getIncidents(w http.ResponseWriter, r *http.Request) {
	filterOptions, err := parseIncidentsFilterOptions(r.URL)
	if err != nil {
		h.HandleErrorWithCode(w, http.StatusBadRequest, "Bad parameter", err)
		return
	}

	userID := r.Header.Get("Mattermost-User-ID")
	// More detailed permissions checked on DB level.
	if !app.CanViewTeam(userID, filterOptions.TeamID, h.pluginAPI) {
		h.HandleErrorWithCode(w, http.StatusForbidden, "permissions error", errors.Errorf(
			"userID %s does not have view permission for teamID %s", userID, filterOptions.TeamID))
		return
	}

	if !app.IsOnEnabledTeam(filterOptions.TeamID, h.config) {
		ReturnJSON(w, map[string]bool{"disabled": true}, http.StatusOK)
		return
	}

	requesterInfo, err := h.getRequesterInfo(userID)
	if err != nil {
		h.HandleError(w, err)
		return
	}

	results, err := h.incidentService.GetIncidents(requesterInfo, *filterOptions)
	if err != nil {
		h.HandleError(w, err)
		return
	}

	ReturnJSON(w, results, http.StatusOK)
}

// getIncident handles the /incidents/{id} endpoint.
func (h *IncidentHandler) getIncident(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	incidentID := vars["id"]
	userID := r.Header.Get("Mattermost-User-ID")

	incidentToGet, err := h.incidentService.GetIncident(incidentID)
	if err != nil {
		h.HandleError(w, err)
		return
	}

	if err := app.ViewIncidentFromChannelID(userID, incidentToGet.ChannelID, h.pluginAPI); err != nil {
		h.HandleErrorWithCode(w, http.StatusForbidden, "User doesn't have permissions to incident.", nil)
		return
	}

	ReturnJSON(w, incidentToGet, http.StatusOK)
}

// getIncidentMetadata handles the /incidents/{id}/metadata endpoint.
func (h *IncidentHandler) getIncidentMetadata(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	incidentID := vars["id"]
	userID := r.Header.Get("Mattermost-User-ID")

	incidentToGet, incErr := h.incidentService.GetIncident(incidentID)
	if incErr != nil {
		h.HandleError(w, incErr)
		return
	}

	if err := app.ViewIncidentFromChannelID(userID, incidentToGet.ChannelID, h.pluginAPI); err != nil {
		h.HandleErrorWithCode(w, http.StatusForbidden, "Not authorized",
			errors.Errorf("userid: %s does not have permissions to view the incident details", userID))
		return
	}

	incidentMetadata, err := h.incidentService.GetIncidentMetadata(incidentID)
	if err != nil {
		h.HandleError(w, err)
		return
	}

	ReturnJSON(w, incidentMetadata, http.StatusOK)
}

// getIncidentByChannel handles the /incidents/channel/{channel_id} endpoint.
func (h *IncidentHandler) getIncidentByChannel(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	channelID := vars["channel_id"]
	userID := r.Header.Get("Mattermost-User-ID")

	if err := app.ViewIncidentFromChannelID(userID, channelID, h.pluginAPI); err != nil {
		h.log.Warnf("User %s does not have permissions to get incident for channel %s", userID, channelID)
		h.HandleErrorWithCode(w, http.StatusNotFound, "Not found",
			errors.Errorf("incident for channel id %s not found", channelID))
		return
	}

	incidentID, err := h.incidentService.GetIncidentIDForChannel(channelID)
	if err != nil {
		if errors.Is(err, app.ErrNotFound) {
			h.HandleErrorWithCode(w, http.StatusNotFound, "Not found",
				errors.Errorf("incident for channel id %s not found", channelID))

			return
		}
		h.HandleError(w, err)
		return
	}

	incidentToGet, err := h.incidentService.GetIncident(incidentID)
	if err != nil {
		h.HandleError(w, err)
		return
	}

	ReturnJSON(w, incidentToGet, http.StatusOK)
}

// getOwners handles the /incidents/owners api endpoint.
func (h *IncidentHandler) getOwners(w http.ResponseWriter, r *http.Request) {
	teamID := r.URL.Query().Get("team_id")
	if teamID == "" {
		h.HandleErrorWithCode(w, http.StatusBadRequest, "Bad parameter: team_id", errors.New("team_id required"))
	}

	userID := r.Header.Get("Mattermost-User-ID")
	if !app.CanViewTeam(userID, teamID, h.pluginAPI) {
		h.HandleErrorWithCode(w, http.StatusForbidden, "permissions error", errors.Errorf(
			"userID %s does not have view permission for teamID %s",
			userID,
			teamID,
		))
		return
	}

	options := app.IncidentFilterOptions{
		TeamID: teamID,
	}

	requesterInfo, err := h.getRequesterInfo(userID)
	if err != nil {
		h.HandleError(w, err)
		return
	}

	owners, err := h.incidentService.GetOwners(requesterInfo, options)
	if err != nil {
		h.HandleError(w, errors.Wrapf(err, "failed to get owners"))
		return
	}

	if owners == nil {
		owners = []app.OwnerInfo{}
	}

	ReturnJSON(w, owners, http.StatusOK)
}

func (h *IncidentHandler) getChannels(w http.ResponseWriter, r *http.Request) {
	filterOptions, err := parseIncidentsFilterOptions(r.URL)
	if err != nil {
		h.HandleErrorWithCode(w, http.StatusBadRequest, "Bad parameter", err)
		return
	}

	userID := r.Header.Get("Mattermost-User-ID")
	if !app.CanViewTeam(userID, filterOptions.TeamID, h.pluginAPI) {
		h.HandleErrorWithCode(w, http.StatusForbidden, "permissions error", errors.Errorf(
			"userID %s does not have view permission for teamID %s",
			userID,
			filterOptions.TeamID,
		))
		return
	}

	requesterInfo, err := h.getRequesterInfo(userID)
	if err != nil {
		h.HandleError(w, err)
		return
	}

	incidents, err := h.incidentService.GetIncidents(requesterInfo, *filterOptions)
	if err != nil {
		h.HandleError(w, errors.Wrapf(err, "failed to get owners"))
		return
	}

	channelIds := make([]string, 0, len(incidents.Items))
	for _, incident := range incidents.Items {
		channelIds = append(channelIds, incident.ChannelID)
	}

	ReturnJSON(w, channelIds, http.StatusOK)
}

// changeOwner handles the /incidents/{id}/change-owner api endpoint.
func (h *IncidentHandler) changeOwner(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	userID := r.Header.Get("Mattermost-User-ID")

	var params struct {
		OwnerID string `json:"owner_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&params); err != nil {
		h.HandleErrorWithCode(w, http.StatusBadRequest, "could not decode request body", err)
		return
	}

	incident, err := h.incidentService.GetIncident(vars["id"])
	if err != nil {
		h.HandleError(w, err)
		return
	}

	// Check if the target user (params.OwnerID) has permissions
	if err := app.EditIncident(params.OwnerID, incident.ChannelID, h.pluginAPI); err != nil {
		if errors.Is(err, app.ErrNoPermissions) {
			h.HandleErrorWithCode(w, http.StatusForbidden, "Not authorized",
				errors.Errorf("userid: %s does not have permissions to incident channel; cannot be made owner", params.OwnerID))
			return
		}
		h.HandleError(w, err)
		return
	}

	if err := h.incidentService.ChangeOwner(vars["id"], userID, params.OwnerID); err != nil {
		h.HandleError(w, err)
		return
	}

	ReturnJSON(w, map[string]interface{}{}, http.StatusOK)
}

// updateStatusD handles the POST /incidents/{id}/status endpoint, user has edit permissions
func (h *IncidentHandler) status(w http.ResponseWriter, r *http.Request) {
	incidentID := mux.Vars(r)["id"]
	userID := r.Header.Get("Mattermost-User-ID")

	incidentToModify, err := h.incidentService.GetIncident(incidentID)
	if err != nil {
		h.HandleError(w, err)
		return
	}

	if !app.CanPostToChannel(userID, incidentToModify.ChannelID, h.pluginAPI) {
		h.HandleErrorWithCode(w, http.StatusForbidden, "Not authorized", fmt.Errorf("user %s cannot post to incident channel %s", userID, incidentToModify.ChannelID))
		return
	}

	var options app.StatusUpdateOptions
	if err = json.NewDecoder(r.Body).Decode(&options); err != nil {
		h.HandleErrorWithCode(w, http.StatusBadRequest, "unable to decode body into StatusUpdateOptions", err)
		return
	}

	options.Description = strings.TrimSpace(options.Description)
	if options.Description == "" {
		h.HandleErrorWithCode(w, http.StatusBadRequest, "description must not be empty", errors.New("description field empty"))
		return
	}

	options.Message = strings.TrimSpace(options.Message)
	if options.Message == "" {
		h.HandleErrorWithCode(w, http.StatusBadRequest, "message must not be empty", errors.New("message field empty"))
		return
	}

	options.Reminder = options.Reminder * time.Second

	options.Status = strings.TrimSpace(options.Status)
	if options.Status == "" {
		h.HandleErrorWithCode(w, http.StatusBadRequest, "status must not be empty", errors.New("status field empty"))
		return
	}
	switch options.Status {
	case app.StatusActive:
	case app.StatusArchived:
	case app.StatusReported:
	case app.StatusResolved:
		break
	default:
		h.HandleErrorWithCode(w, http.StatusBadRequest, "invalid status", nil)
		return
	}

	err = h.incidentService.UpdateStatus(incidentID, userID, options)
	if err != nil {
		h.HandleError(w, err)
		return
	}

	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte(`{"status":"OK"}`))
}

// updateStatusDialog handles the POST /incidents/{id}/update-status-dialog endpoint, called when a
// user submits the Update Status dialog.
func (h *IncidentHandler) updateStatusDialog(w http.ResponseWriter, r *http.Request) {
	incidentID := mux.Vars(r)["id"]
	userID := r.Header.Get("Mattermost-User-ID")

	incidentToModify, err := h.incidentService.GetIncident(incidentID)
	if err != nil {
		h.HandleError(w, err)
		return
	}

	if !app.CanPostToChannel(userID, incidentToModify.ChannelID, h.pluginAPI) {
		h.HandleErrorWithCode(w, http.StatusForbidden, "Not authorized", fmt.Errorf("user %s cannot post to incident channel %s", userID, incidentToModify.ChannelID))
		return
	}

	request := model.SubmitDialogRequestFromJson(r.Body)
	if request == nil {
		h.HandleErrorWithCode(w, http.StatusBadRequest, "failed to decode SubmitDialogRequest", nil)
		return
	}

	var options app.StatusUpdateOptions
	if message, ok := request.Submission[app.DialogFieldMessageKey]; ok {
		options.Message = strings.TrimSpace(message.(string))
	}
	if options.Message == "" {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(fmt.Sprintf(`{"errors": {"%s":"This field is required."}}`, app.DialogFieldMessageKey)))
		return
	}

	if description, ok := request.Submission[app.DialogFieldDescriptionKey]; ok {
		options.Description = strings.TrimSpace(description.(string))
	}
	if options.Description == "" {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(fmt.Sprintf(`{"errors": {"%s":"This field is required."}}`, app.DialogFieldDescriptionKey)))
		return
	}

	if reminderI, ok := request.Submission[app.DialogFieldReminderInSecondsKey]; ok {
		if reminder, err2 := strconv.Atoi(reminderI.(string)); err2 == nil {
			options.Reminder = time.Duration(reminder) * time.Second
		}
	}

	if status, ok := request.Submission[app.DialogFieldStatusKey]; ok {
		options.Status = status.(string)
	}

	switch options.Status {
	case app.StatusActive:
	case app.StatusArchived:
	case app.StatusReported:
	case app.StatusResolved:
		break
	default:
		h.HandleErrorWithCode(w, http.StatusBadRequest, "invalid status", nil)
		return
	}

	err = h.incidentService.UpdateStatus(incidentID, userID, options)
	if err != nil {
		h.HandleError(w, err)
		return
	}

	w.WriteHeader(http.StatusOK)
}

// reminderButtonUpdate handles the POST /incidents/{id}/reminder/button-update endpoint, called when a
// user clicks on the reminder interactive button
func (h *IncidentHandler) reminderButtonUpdate(w http.ResponseWriter, r *http.Request) {
	requestData := model.PostActionIntegrationRequestFromJson(r.Body)
	if requestData == nil {
		h.HandleErrorWithCode(w, http.StatusBadRequest, "missing request data", nil)
		return
	}

	incidentID, err := h.incidentService.GetIncidentIDForChannel(requestData.ChannelId)
	if err != nil {
		h.HandleErrorWithCode(w, http.StatusInternalServerError, "error getting incident",
			errors.Wrapf(err, "reminderButtonUpdate failed to find incidentID for channelID: %s", requestData.ChannelId))
		return
	}

	if err = app.EditIncident(requestData.UserId, requestData.ChannelId, h.pluginAPI); err != nil {
		if errors.Is(err, app.ErrNoPermissions) {
			ReturnJSON(w, nil, http.StatusForbidden)
			return
		}
		h.HandleErrorWithCode(w, http.StatusInternalServerError, "error getting permissions", err)
		return
	}

	if err = h.incidentService.OpenUpdateStatusDialog(incidentID, requestData.TriggerId); err != nil {
		h.HandleError(w, errors.New("reminderButtonUpdate failed to open update status dialog"))
		return
	}

	ReturnJSON(w, nil, http.StatusOK)
}

// reminderButtonDismiss handles the POST /incidents/{id}/reminder/button-dismiss endpoint, called when a
// user clicks on the reminder interactive button
func (h *IncidentHandler) reminderButtonDismiss(w http.ResponseWriter, r *http.Request) {
	requestData := model.PostActionIntegrationRequestFromJson(r.Body)
	if requestData == nil {
		h.HandleErrorWithCode(w, http.StatusBadRequest, "missing request data", nil)
		return
	}

	incidentID, err := h.incidentService.GetIncidentIDForChannel(requestData.ChannelId)
	if err != nil {
		h.log.Errorf("reminderButtonDismiss: no incident for requestData's channelID: %s", requestData.ChannelId)
		h.HandleErrorWithCode(w, http.StatusBadRequest, "no incident for requestData's channelID", err)
		return
	}

	if err = app.EditIncident(requestData.UserId, requestData.ChannelId, h.pluginAPI); err != nil {
		if errors.Is(err, app.ErrNoPermissions) {
			ReturnJSON(w, nil, http.StatusForbidden)
			return
		}
		h.HandleErrorWithCode(w, http.StatusInternalServerError, "error getting permissions", err)
		return
	}

	if err = h.incidentService.RemoveReminderPost(incidentID); err != nil {
		h.log.Errorf("reminderButtonDismiss: error removing reminder for channelID: %s; error: %s", requestData.ChannelId, err.Error())
		h.HandleErrorWithCode(w, http.StatusBadRequest, "error removing reminder", err)
		return
	}

	ReturnJSON(w, nil, http.StatusOK)
}

func (h *IncidentHandler) noRetrospectiveButton(w http.ResponseWriter, r *http.Request) {
	incidentID := mux.Vars(r)["id"]
	userID := r.Header.Get("Mattermost-User-ID")

	incidentToCancelRetro, err := h.incidentService.GetIncident(incidentID)
	if err != nil {
		h.HandleError(w, err)
		return
	}

	if err = app.EditIncident(userID, incidentToCancelRetro.ChannelID, h.pluginAPI); err != nil {
		if errors.Is(err, app.ErrNoPermissions) {
			ReturnJSON(w, nil, http.StatusForbidden)
			return
		}
		h.HandleErrorWithCode(w, http.StatusInternalServerError, "error getting permissions", err)
		return
	}

	if err := h.incidentService.CancelRetrospective(incidentID, userID); err != nil {
		h.HandleErrorWithCode(w, http.StatusInternalServerError, "unable to cancel retrospective", err)
		return
	}

	ReturnJSON(w, nil, http.StatusOK)
}

// removeTimelineEvent handles the DELETE /incidents/{id}/timeline/{eventID} endpoint.
// User has been authenticated to edit the incident.
func (h *IncidentHandler) removeTimelineEvent(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]
	userID := r.Header.Get("Mattermost-User-ID")
	eventID := vars["eventID"]

	if err := h.incidentService.RemoveTimelineEvent(id, userID, eventID); err != nil {
		h.HandleError(w, err)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// checkAndSendMessageOnJoin handles the GET /incident/{id}/check_and_send_message_on_join/{channel_id} endpoint.
func (h *IncidentHandler) checkAndSendMessageOnJoin(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	incidentID := vars["id"]
	channelID := vars["channel_id"]
	userID := r.Header.Get("Mattermost-User-ID")

	hasViewed := h.incidentService.CheckAndSendMessageOnJoin(userID, incidentID, channelID)
	ReturnJSON(w, map[string]interface{}{"viewed": hasViewed}, http.StatusOK)
}

func (h *IncidentHandler) getChecklistAutocompleteItem(w http.ResponseWriter, r *http.Request) {
	query := r.URL.Query()
	channelID := query.Get("channel_id")
	userID := r.Header.Get("Mattermost-User-ID")

	incidentID, err := h.incidentService.GetIncidentIDForChannel(channelID)
	if err != nil {
		h.HandleError(w, err)
		return
	}

	if err = app.ViewIncidentFromChannelID(userID, channelID, h.pluginAPI); err != nil {
		h.HandleErrorWithCode(w, http.StatusForbidden, "user does not have permissions", err)
		return
	}

	data, err := h.incidentService.GetChecklistItemAutocomplete(incidentID)
	if err != nil {
		h.HandleError(w, err)
		return
	}

	ReturnJSON(w, data, http.StatusOK)
}

func (h *IncidentHandler) getChecklistAutocomplete(w http.ResponseWriter, r *http.Request) {
	query := r.URL.Query()
	channelID := query.Get("channel_id")
	userID := r.Header.Get("Mattermost-User-ID")

	incidentID, err := h.incidentService.GetIncidentIDForChannel(channelID)
	if err != nil {
		h.HandleError(w, err)
		return
	}

	if err = app.ViewIncidentFromChannelID(userID, channelID, h.pluginAPI); err != nil {
		h.HandleErrorWithCode(w, http.StatusForbidden, "user does not have permissions", err)
		return
	}

	data, err := h.incidentService.GetChecklistAutocomplete(incidentID)
	if err != nil {
		h.HandleError(w, err)
		return
	}

	ReturnJSON(w, data, http.StatusOK)
}

func (h *IncidentHandler) itemSetState(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]
	checklistNum, err := strconv.Atoi(vars["checklist"])
	if err != nil {
		h.HandleErrorWithCode(w, http.StatusBadRequest, "failed to parse checklist", err)
		return
	}
	itemNum, err := strconv.Atoi(vars["item"])
	if err != nil {
		h.HandleErrorWithCode(w, http.StatusBadRequest, "failed to parse item", err)
		return
	}
	userID := r.Header.Get("Mattermost-User-ID")

	var params struct {
		NewState string `json:"new_state"`
	}
	if err := json.NewDecoder(r.Body).Decode(&params); err != nil {
		h.HandleErrorWithCode(w, http.StatusBadRequest, "failed to unmarshal", err)
		return
	}

	if !app.IsValidChecklistItemState(params.NewState) {
		h.HandleErrorWithCode(w, http.StatusBadRequest, "bad parameter new state", nil)
		return
	}

	if err := h.incidentService.ModifyCheckedState(id, userID, params.NewState, checklistNum, itemNum); err != nil {
		h.HandleError(w, err)
		return
	}

	ReturnJSON(w, map[string]interface{}{}, http.StatusOK)
}

func (h *IncidentHandler) itemSetAssignee(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]
	checklistNum, err := strconv.Atoi(vars["checklist"])
	if err != nil {
		h.HandleErrorWithCode(w, http.StatusBadRequest, "failed to parse checklist", err)
		return
	}
	itemNum, err := strconv.Atoi(vars["item"])
	if err != nil {
		h.HandleErrorWithCode(w, http.StatusBadRequest, "failed to parse item", err)
		return
	}
	userID := r.Header.Get("Mattermost-User-ID")

	var params struct {
		AssigneeID string `json:"assignee_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&params); err != nil {
		h.HandleErrorWithCode(w, http.StatusBadRequest, "failed to unmarshal", err)
		return
	}

	if err := h.incidentService.SetAssignee(id, userID, params.AssigneeID, checklistNum, itemNum); err != nil {
		h.HandleError(w, err)
		return
	}

	ReturnJSON(w, map[string]interface{}{}, http.StatusOK)
}

func (h *IncidentHandler) itemRun(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	incidentID := vars["id"]
	checklistNum, err := strconv.Atoi(vars["checklist"])
	if err != nil {
		h.HandleErrorWithCode(w, http.StatusBadRequest, "failed to parse checklist", err)
		return
	}
	itemNum, err := strconv.Atoi(vars["item"])
	if err != nil {
		h.HandleErrorWithCode(w, http.StatusBadRequest, "failed to parse item", err)
		return
	}
	userID := r.Header.Get("Mattermost-User-ID")

	triggerID, err := h.incidentService.RunChecklistItemSlashCommand(incidentID, userID, checklistNum, itemNum)
	if err != nil {
		h.HandleError(w, err)
		return
	}

	ReturnJSON(w, map[string]interface{}{"trigger_id": triggerID}, http.StatusOK)
}

func (h *IncidentHandler) addChecklistItem(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]
	checklistNum, err := strconv.Atoi(vars["checklist"])
	if err != nil {
		h.HandleErrorWithCode(w, http.StatusBadRequest, "failed to parse checklist", err)
		return
	}
	userID := r.Header.Get("Mattermost-User-ID")

	var checklistItem app.ChecklistItem
	if err := json.NewDecoder(r.Body).Decode(&checklistItem); err != nil {
		h.HandleErrorWithCode(w, http.StatusBadRequest, "failed to decode ChecklistItem", err)
		return
	}

	checklistItem.Title = strings.TrimSpace(checklistItem.Title)
	if checklistItem.Title == "" {
		h.HandleErrorWithCode(w, http.StatusBadRequest, "bad parameter: checklist item title",
			errors.New("checklist item title must not be blank"))
		return
	}

	if err := h.incidentService.AddChecklistItem(id, userID, checklistNum, checklistItem); err != nil {
		h.HandleError(w, err)
		return
	}

	w.WriteHeader(http.StatusCreated)
}

// addChecklistItemDialog handles the interactive dialog submission when a user clicks add new task
func (h *IncidentHandler) addChecklistItemDialog(w http.ResponseWriter, r *http.Request) {
	userID := r.Header.Get("Mattermost-User-ID")
	vars := mux.Vars(r)
	incidentID := vars["id"]
	checklistNum, err := strconv.Atoi(vars["checklist"])
	if err != nil {
		h.HandleErrorWithCode(w, http.StatusBadRequest, "failed to parse checklist", err)
		return
	}

	request := model.SubmitDialogRequestFromJson(r.Body)
	if request == nil {
		h.HandleErrorWithCode(w, http.StatusBadRequest, "failed to decode SubmitDialogRequest", nil)
		return
	}

	if userID != request.UserId {
		h.HandleErrorWithCode(w, http.StatusBadRequest, "interactive dialog's userID must be the same as the requester's userID", nil)
		return
	}

	var name, description string
	if rawName, ok := request.Submission[app.DialogFieldItemNameKey].(string); ok {
		name = rawName
	}
	if rawDescription, ok := request.Submission[app.DialogFieldItemDescriptionKey].(string); ok {
		description = rawDescription
	}

	checklistItem := app.ChecklistItem{
		Title:       name,
		Description: description,
	}

	checklistItem.Title = strings.TrimSpace(checklistItem.Title)
	if checklistItem.Title == "" {
		h.HandleErrorWithCode(w, http.StatusBadRequest, "bad parameter: checklist item title",
			errors.New("checklist item title must not be blank"))
		return
	}

	if err := h.incidentService.AddChecklistItem(incidentID, userID, checklistNum, checklistItem); err != nil {
		h.HandleError(w, err)
		return
	}

	w.WriteHeader(http.StatusOK)

}

func (h *IncidentHandler) itemDelete(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]
	checklistNum, err := strconv.Atoi(vars["checklist"])
	if err != nil {
		h.HandleErrorWithCode(w, http.StatusBadRequest, "failed to parse checklist", err)
		return
	}
	itemNum, err := strconv.Atoi(vars["item"])
	if err != nil {
		h.HandleErrorWithCode(w, http.StatusBadRequest, "failed to parse item", err)
		return
	}
	userID := r.Header.Get("Mattermost-User-ID")

	if err := h.incidentService.RemoveChecklistItem(id, userID, checklistNum, itemNum); err != nil {
		h.HandleError(w, err)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (h *IncidentHandler) itemEdit(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]
	checklistNum, err := strconv.Atoi(vars["checklist"])
	if err != nil {
		h.HandleErrorWithCode(w, http.StatusBadRequest, "failed to parse checklist", err)
		return
	}
	itemNum, err := strconv.Atoi(vars["item"])
	if err != nil {
		h.HandleErrorWithCode(w, http.StatusBadRequest, "failed to parse item", err)
		return
	}
	userID := r.Header.Get("Mattermost-User-ID")

	var params struct {
		Title       string `json:"title"`
		Command     string `json:"command"`
		Description string `json:"description"`
	}
	if err := json.NewDecoder(r.Body).Decode(&params); err != nil {
		h.HandleErrorWithCode(w, http.StatusBadRequest, "failed to unmarshal edit params state", err)
		return
	}

	if err := h.incidentService.EditChecklistItem(id, userID, checklistNum, itemNum, params.Title, params.Command, params.Description); err != nil {
		h.HandleError(w, err)
		return
	}

	w.WriteHeader(http.StatusOK)
}

func (h *IncidentHandler) reorderChecklist(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]
	checklistNum, err := strconv.Atoi(vars["checklist"])
	if err != nil {
		h.HandleErrorWithCode(w, http.StatusBadRequest, "failed to parse checklist", err)
		return
	}
	userID := r.Header.Get("Mattermost-User-ID")

	var modificationParams struct {
		ItemNum     int `json:"item_num"`
		NewLocation int `json:"new_location"`
	}
	if err := json.NewDecoder(r.Body).Decode(&modificationParams); err != nil {
		h.HandleErrorWithCode(w, http.StatusBadRequest, "failed to unmarshal edit params", err)
		return
	}

	if err := h.incidentService.MoveChecklistItem(id, userID, checklistNum, modificationParams.ItemNum, modificationParams.NewLocation); err != nil {
		h.HandleError(w, err)
		return
	}

	w.WriteHeader(http.StatusOK)
}

func (h *IncidentHandler) postIncidentCreatedMessage(incident *app.Incident, channelID string) error {
	channel, err := h.pluginAPI.Channel.Get(incident.ChannelID)
	if err != nil {
		return err
	}

	post := &model.Post{
		Message: fmt.Sprintf("Incident %s started in ~%s", incident.Name, channel.Name),
	}
	h.poster.EphemeralPost(incident.OwnerUserID, channelID, post)

	return nil
}

func (h *IncidentHandler) updateRetrospective(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	incidentID := vars["id"]
	userID := r.Header.Get("Mattermost-User-ID")

	var retroUpdate struct {
		Retrospective string `json:"retrospective"`
	}

	if err := json.NewDecoder(r.Body).Decode(&retroUpdate); err != nil {
		h.HandleErrorWithCode(w, http.StatusBadRequest, "unable to decode payload", err)
		return
	}

	if err := h.incidentService.UpdateRetrospective(incidentID, userID, retroUpdate.Retrospective); err != nil {
		h.HandleErrorWithCode(w, http.StatusInternalServerError, "unable to update retrospective", err)
		return
	}

	w.WriteHeader(http.StatusOK)
}

func (h *IncidentHandler) publishRetrospective(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	incidentID := vars["id"]
	userID := r.Header.Get("Mattermost-User-ID")

	var retroUpdate struct {
		Retrospective string `json:"retrospective"`
	}

	if err := json.NewDecoder(r.Body).Decode(&retroUpdate); err != nil {
		h.HandleErrorWithCode(w, http.StatusBadRequest, "unable to decode payload", err)
		return
	}

	if err := h.incidentService.PublishRetrospective(incidentID, retroUpdate.Retrospective, userID); err != nil {
		h.HandleErrorWithCode(w, http.StatusInternalServerError, "unable to publish retrospective", err)
		return
	}

	w.WriteHeader(http.StatusOK)
}

// parseIncidentsFilterOptions is only for parsing. Put validation logic in app.validateOptions.
func parseIncidentsFilterOptions(u *url.URL) (*app.IncidentFilterOptions, error) {
	teamID := u.Query().Get("team_id")
	if teamID == "" {
		return nil, errors.New("bad parameter 'team_id'; 'team_id' is required")
	}

	pageParam := u.Query().Get("page")
	if pageParam == "" {
		pageParam = "0"
	}
	page, err := strconv.Atoi(pageParam)
	if err != nil {
		return nil, errors.Wrapf(err, "bad parameter 'page'")
	}

	perPageParam := u.Query().Get("per_page")
	if perPageParam == "" {
		perPageParam = "0"
	}
	perPage, err := strconv.Atoi(perPageParam)
	if err != nil {
		return nil, errors.Wrapf(err, "bad parameter 'per_page'")
	}

	sort := u.Query().Get("sort")
	direction := u.Query().Get("direction")

	status := u.Query().Get("status")

	ownerID := u.Query().Get("owner_user_id")
	searchTerm := u.Query().Get("search_term")

	memberID := u.Query().Get("member_id")

	playbookID := u.Query().Get("playbook_id")

	options := app.IncidentFilterOptions{
		TeamID:     teamID,
		Page:       page,
		PerPage:    perPage,
		Sort:       app.SortField(sort),
		Direction:  app.SortDirection(direction),
		Status:     status,
		OwnerID:    ownerID,
		SearchTerm: searchTerm,
		MemberID:   memberID,
		PlaybookID: playbookID,
	}

	err = options.IsValid()
	if err != nil {
		return nil, err
	}

	return &options, nil
}

func sliceContains(strs []string, target string) bool {
	for _, s := range strs {
		if s == target {
			return true
		}
	}
	return false
}
