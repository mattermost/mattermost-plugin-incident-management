package incident

import (
	"encoding/json"
	"fmt"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/pkg/errors"
	stripmd "github.com/writeas/go-strip-markdown"

	pluginapi "github.com/mattermost/mattermost-plugin-api"
	"github.com/mattermost/mattermost-plugin-api/cluster"
	"github.com/mattermost/mattermost-plugin-incident-management/server/bot"
	"github.com/mattermost/mattermost-plugin-incident-management/server/config"
	"github.com/mattermost/mattermost-plugin-incident-management/server/playbook"
	"github.com/mattermost/mattermost-plugin-incident-management/server/timeutils"
	"github.com/mattermost/mattermost-server/v5/model"
)

const (
	// IncidentCreatedWSEvent is for incident creation.
	IncidentCreatedWSEvent = "incident_created"
	incidentUpdatedWSEvent = "incident_updated"
	noAssigneeName         = "No Assignee"
)

// ServiceImpl holds the information needed by the IncidentService's methods to complete their functions.
type ServiceImpl struct {
	pluginAPI     *pluginapi.Client
	configService config.Service
	store         Store
	poster        bot.Poster
	logger        bot.Logger
	scheduler     *cluster.JobOnceScheduler
	telemetry     Telemetry
}

var allNonSpaceNonWordRegex = regexp.MustCompile(`[^\w\s]`)

// DialogFieldPlaybookIDKey is the key for the playbook ID field used in OpenCreateIncidentDialog.
const DialogFieldPlaybookIDKey = "playbookID"

// DialogFieldNameKey is the key for the incident name field used in OpenCreateIncidentDialog.
const DialogFieldNameKey = "incidentName"

// DialogFieldDescriptionKey is the key for the incident description field used in OpenCreateIncidentDialog.
const DialogFieldDescriptionKey = "incidentDescription"

// DialogFieldMessageKey is the key for the message textarea field used in UpdateIncidentDialog
const DialogFieldMessageKey = "message"

// DialogFieldReminderInMinutesKey is the key for the reminder select field used in UpdateIncidentDialog
const DialogFieldReminderInMinutesKey = "reminder"

// NewService creates a new incident ServiceImpl.
func NewService(pluginAPI *pluginapi.Client, store Store, poster bot.Poster, logger bot.Logger,
	configService config.Service, scheduler *cluster.JobOnceScheduler, telemetry Telemetry) *ServiceImpl {
	return &ServiceImpl{
		pluginAPI:     pluginAPI,
		store:         store,
		poster:        poster,
		logger:        logger,
		configService: configService,
		scheduler:     scheduler,
		telemetry:     telemetry,
	}
}

// GetIncidents returns filtered incidents and the total count before paging.
func (s *ServiceImpl) GetIncidents(requesterInfo RequesterInfo, options HeaderFilterOptions) (*GetIncidentsResults, error) {
	return s.store.GetIncidents(requesterInfo, options)
}

// CreateIncident creates a new incident. userID is the user who initiated the CreateIncident.
func (s *ServiceImpl) CreateIncident(incdnt *Incident, userID string, public bool) (*Incident, error) {
	// Try to create the channel first
	channel, err := s.createIncidentChannel(incdnt, public)
	if err != nil {
		return nil, err
	}

	// New incidents are always active
	incdnt.IsActive = true
	incdnt.ChannelID = channel.Id
	incdnt.CreateAt = model.GetMillis()

	// Start with a blank playbook with one empty checklist if one isn't provided
	if incdnt.PlaybookID == "" {
		incdnt.Checklists = []playbook.Checklist{
			{
				Title: "Checklist",
				Items: []playbook.ChecklistItem{},
			},
		}
	}

	// Make sure ActiveStage is correct and ActiveStageTitle is synced
	numChecklists := len(incdnt.Checklists)
	if numChecklists > 0 {
		idx := incdnt.ActiveStage
		if idx < 0 || idx >= numChecklists {
			return nil, errors.Errorf("active stage %d out of bounds: incident %s has %d stages", idx, incdnt.ID, numChecklists)
		}

		incdnt.ActiveStageTitle = incdnt.Checklists[idx].Title
	}

	incdnt, err = s.store.CreateIncident(incdnt)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to create incident")
	}

	s.poster.PublishWebsocketEventToChannel(incidentUpdatedWSEvent, incdnt, incdnt.ChannelID)
	s.telemetry.CreateIncident(incdnt, userID, public)

	user, err := s.pluginAPI.User.Get(incdnt.CommanderUserID)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to resolve user %s", incdnt.CommanderUserID)
	}

	if _, err = s.poster.PostMessage(channel.Id, "This incident has been started by @%s", user.Username); err != nil {
		return nil, errors.Wrapf(err, "failed to post to incident channel")
	}

	if incdnt.PostID == "" {
		return incdnt, nil
	}

	// Post the content and link of the original post
	post, err := s.pluginAPI.Post.GetPost(incdnt.PostID)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to get incident original post")
	}

	siteURL := model.SERVICE_SETTINGS_DEFAULT_SITE_URL
	if s.pluginAPI.Configuration.GetConfig().ServiceSettings.SiteURL != nil {
		siteURL = *s.pluginAPI.Configuration.GetConfig().ServiceSettings.SiteURL
	}
	postURL := fmt.Sprintf("%s/_redirect/pl/%s", siteURL, incdnt.PostID)
	postMessage := fmt.Sprintf("[Original Post](%s)\n > %s", postURL, post.Message)

	if _, err := s.poster.PostMessage(channel.Id, postMessage); err != nil {
		return nil, errors.Wrapf(err, "failed to post to incident channel")
	}

	return incdnt, nil
}

// OpenCreateIncidentDialog opens a interactive dialog to start a new incident.
func (s *ServiceImpl) OpenCreateIncidentDialog(teamID, commanderID, triggerID, postID, clientID string, playbooks []playbook.Playbook, isMobileApp bool) error {
	dialog, err := s.newIncidentDialog(teamID, commanderID, postID, clientID, playbooks, isMobileApp)
	if err != nil {
		return errors.Wrapf(err, "failed to create new incident dialog")
	}

	dialogRequest := model.OpenDialogRequest{
		URL: fmt.Sprintf("/plugins/%s/api/v0/incidents/dialog",
			s.configService.GetManifest().Id),
		Dialog:    *dialog,
		TriggerId: triggerID,
	}

	if err := s.pluginAPI.Frontend.OpenInteractiveDialog(dialogRequest); err != nil {
		return errors.Wrapf(err, "failed to open new incident dialog")
	}

	return nil
}

// EndIncident completes the incident. It returns an ErrIncidentNotActive if the caller tries to
// end an incident which is not active.
func (s *ServiceImpl) EndIncident(incidentID, userID string) error {
	incdnt, err := s.store.GetIncident(incidentID)
	if err != nil {
		return errors.Wrapf(err, "failed to end incident")
	}

	if !incdnt.IsActive {
		return ErrIncidentNotActive
	}

	// Close the incident
	incdnt.IsActive = false
	incdnt.EndAt = model.GetMillis()

	if err = s.store.UpdateIncident(incdnt); err != nil {
		return errors.Wrapf(err, "failed to end incident")
	}

	s.poster.PublishWebsocketEventToChannel(incidentUpdatedWSEvent, incdnt, incdnt.ChannelID)
	s.telemetry.EndIncident(incdnt, userID)

	user, err := s.pluginAPI.User.Get(userID)
	if err != nil {
		return errors.Wrapf(err, "failed to to resolve user %s", userID)
	}

	// Post in the  main incident channel that @user has ended the incident.
	// Main channel is the only channel in the incident for now.
	if _, err := s.poster.PostMessage(incdnt.ChannelID, "This incident has been closed by @%v", user.Username); err != nil {
		return errors.Wrap(err, "failed to post end incident messsage")
	}

	return nil
}

// RestartIncident restarts the incident with the given ID by the given user.
func (s *ServiceImpl) RestartIncident(incidentID, userID string) error {
	currentIncident, err := s.store.GetIncident(incidentID)
	if err != nil {
		return errors.Wrapf(err, "failed to retrieve incident")
	}

	if currentIncident.IsActive {
		return ErrIncidentActive
	}

	currentIncident.IsActive = true
	currentIncident.EndAt = 0

	if err = s.store.UpdateIncident(currentIncident); err != nil {
		return errors.Wrapf(err, "failed to restart incident")
	}

	s.poster.PublishWebsocketEventToChannel(incidentUpdatedWSEvent, currentIncident,
		currentIncident.ChannelID)
	s.telemetry.RestartIncident(currentIncident, userID)

	user, err := s.pluginAPI.User.Get(userID)
	if err != nil {
		return errors.Wrapf(err, "failed to to resolve user %s", userID)
	}

	// Post in the  main incident channel that @user has restarted the incident.
	// Main channel is the only channel in the incident for now.
	if _, err := s.poster.PostMessage(currentIncident.ChannelID,
		"This incident has been restarted by @%v", user.Username); err != nil {
		return errors.Wrap(err, "failed to post restart incident messsage")
	}

	return nil
}

// OpenEndIncidentDialog opens a interactive dialog so the user can confirm an incident should
// be ended.
func (s *ServiceImpl) OpenEndIncidentDialog(incidentID, triggerID string) error {
	currentIncident, err := s.store.GetIncident(incidentID)
	if err != nil {
		return errors.Wrapf(err, "failed to retrieve incident")
	}

	if !currentIncident.IsActive {
		return ErrIncidentNotActive
	}

	dialog := model.Dialog{
		Title:            "Confirm End Incident",
		SubmitLabel:      "Confirm",
		IntroductionText: "Ending the incident stops the duration timer and notifies the channel that the incident has ended. It remains possible to change stages and complete steps, or even restart the incident.",
		NotifyOnCancel:   false,
		State:            incidentID,
	}

	dialogRequest := model.OpenDialogRequest{
		URL: fmt.Sprintf(
			"/plugins/%s/api/v0/incidents/%s/end",
			s.configService.GetManifest().Id,
			incidentID,
		),
		Dialog:    dialog,
		TriggerId: triggerID,
	}

	if err := s.pluginAPI.Frontend.OpenInteractiveDialog(dialogRequest); err != nil {
		return errors.Wrapf(err, "failed to open new incident dialog")
	}

	return nil
}

func (s *ServiceImpl) OpenUpdateStatusDialog(incidentID string, triggerID string) error {
	currentIncident, err := s.store.GetIncident(incidentID)
	if err != nil {
		return errors.Wrap(err, "failed to retrieve incident")
	}

	if !currentIncident.IsActive {
		return ErrIncidentNotActive
	}

	message := ""
	newestPostID := findNewestNonDeletedPostID(currentIncident.StatusPosts)
	if newestPostID != "" {
		var post *model.Post
		post, err = s.pluginAPI.Post.GetPost(newestPostID)
		if err != nil {
			return errors.Wrap(err, "failed to find newest post")
		}
		message = post.Message
	}
	// TODO: if there is no newestPost, use the message template: https://mattermost.atlassian.net/browse/MM-30519

	dialog, err := s.newUpdateIncidentDialog(message, currentIncident.BroadcastChannelID)
	if err != nil {
		return errors.Wrap(err, "failed to create update status dialog")
	}

	dialogRequest := model.OpenDialogRequest{
		URL: fmt.Sprintf("/plugins/%s/api/v0/incidents/%s/update-status-dialog",
			s.configService.GetManifest().Id,
			incidentID),
		Dialog:    *dialog,
		TriggerId: triggerID,
	}

	if err := s.pluginAPI.Frontend.OpenInteractiveDialog(dialogRequest); err != nil {
		return errors.Wrap(err, "failed to open update status dialog")
	}

	return nil
}

func (s *ServiceImpl) broadcastStatusUpdate(statusUpdate string, theIncident *Incident, authorID, originalPostID string) error {
	incidentChannel, err := s.pluginAPI.Channel.Get(theIncident.ChannelID)
	if err != nil {
		return err
	}

	incidentTeam, err := s.pluginAPI.Team.Get(theIncident.TeamID)
	if err != nil {
		return err
	}

	author, err := s.pluginAPI.User.Get(authorID)
	if err != nil {
		return err
	}

	duration := timeutils.DurationString(timeutils.GetTimeForMillis(theIncident.CreateAt), time.Now())
	status := "Ongoing"
	if !theIncident.IsActive {
		status = "Ended"
	}

	broadcastedMsg := fmt.Sprintf("# Incident Update: [%s](/%s/pl/%s)\n", incidentChannel.DisplayName, incidentTeam.Name, originalPostID)
	broadcastedMsg += fmt.Sprintf("By @%s | Duration: %s | Status: %s\n", author.Username, duration, status)
	broadcastedMsg += "***\n"
	broadcastedMsg += statusUpdate

	if _, err := s.poster.PostMessage(theIncident.BroadcastChannelID, broadcastedMsg); err != nil {
		return err
	}

	return nil
}

// UpdateStatus updates an incident's status.
func (s *ServiceImpl) UpdateStatus(incidentID, userID string, options StatusUpdateOptions) error {
	incidentToModify, err := s.store.GetIncident(incidentID)
	if err != nil {
		return errors.Wrap(err, "failed to retrieve incident")
	}

	if !incidentToModify.IsActive {
		return ErrIncidentNotActive
	}

	post := model.Post{
		Message:   options.Message,
		UserId:    userID,
		ChannelId: incidentToModify.ChannelID,
	}
	if err = s.pluginAPI.Post.CreatePost(&post); err != nil {
		return errors.Wrap(err, "failed to post update status message")
	}

	incidentToModify.StatusPostIDs = append(incidentToModify.StatusPostIDs, post.Id)
	if err = s.store.UpdateIncident(incidentToModify); err != nil {
		return errors.Wrap(err, "failed to update incident")
	}

	if err2 := s.broadcastStatusUpdate(options.Message, incidentToModify, userID, post.Id); err2 != nil {
		s.pluginAPI.Log.Warn("failed to broadcast the status update to channel", "ChannelID", incidentToModify.BroadcastChannelID)
	}

	incidentToModify.StatusPosts = append(incidentToModify.StatusPosts,
		StatusPost{
			ID:       post.Id,
			CreateAt: post.CreateAt,
			DeleteAt: post.DeleteAt,
		})

	s.poster.PublishWebsocketEventToChannel(incidentUpdatedWSEvent, incidentToModify, incidentToModify.ChannelID)

	s.telemetry.UpdateStatus(incidentToModify, userID)

	// Remove pending reminder (if any), even if current reminder was set to "none" (0 minutes)
	s.RemoveReminder(incidentID)

	if options.Reminder != 0 {
		if err = s.SetReminder(incidentID, options.Reminder); err != nil {
			return errors.Wrap(err, "failed to set the reminder for incident")
		}
	}

	if err = s.RemoveReminderPost(incidentID); err != nil {
		return errors.Wrap(err, "failed to remove reminder post")
	}

	return nil
}

// GetIncident gets an incident by ID. Returns error if it could not be found.
func (s *ServiceImpl) GetIncident(incidentID string) (*Incident, error) {
	return s.store.GetIncident(incidentID)
}

// GetIncidentMetadata gets ancillary metadata about an incident.
func (s *ServiceImpl) GetIncidentMetadata(incidentID string) (*Metadata, error) {
	incident, err := s.GetIncident(incidentID)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to retrieve incident '%s'", incidentID)
	}

	// Get main channel details
	channel, err := s.pluginAPI.Channel.Get(incident.ChannelID)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to retrieve channel id '%s'", incident.ChannelID)
	}
	team, err := s.pluginAPI.Team.Get(channel.TeamId)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to retrieve team id '%s'", channel.TeamId)
	}

	numMembers, err := s.store.GetAllIncidentMembersCount(incident.ChannelID)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to get the count of incident members for channel id '%s'", incident.ChannelID)
	}

	return &Metadata{
		ChannelName:        channel.Name,
		ChannelDisplayName: channel.DisplayName,
		TeamName:           team.Name,
		TotalPosts:         channel.TotalMsgCount,
		NumMembers:         numMembers,
	}, nil
}

// GetIncidentIDForChannel get the incidentID associated with this channel. Returns ErrNotFound
// if there is no incident associated with this channel.
func (s *ServiceImpl) GetIncidentIDForChannel(channelID string) (string, error) {
	incidentID, err := s.store.GetIncidentIDForChannel(channelID)
	if err != nil {
		return "", err
	}
	return incidentID, nil
}

// GetCommanders returns all the commanders of the incidents selected by options
func (s *ServiceImpl) GetCommanders(requesterInfo RequesterInfo, options HeaderFilterOptions) ([]CommanderInfo, error) {
	return s.store.GetCommanders(requesterInfo, options)
}

// IsCommander returns true if the userID is the commander for incidentID.
func (s *ServiceImpl) IsCommander(incidentID, userID string) bool {
	incdnt, err := s.store.GetIncident(incidentID)
	if err != nil {
		return false
	}
	return incdnt.CommanderUserID == userID
}

// ChangeCommander processes a request from userID to change the commander for incidentID
// to commanderID. Changing to the same commanderID is a no-op.
func (s *ServiceImpl) ChangeCommander(incidentID, userID, commanderID string) error {
	incidentToModify, err := s.store.GetIncident(incidentID)
	if err != nil {
		return err
	}

	if incidentToModify.CommanderUserID == commanderID {
		return nil
	}

	oldCommander, err := s.pluginAPI.User.Get(incidentToModify.CommanderUserID)
	if err != nil {
		return errors.Wrapf(err, "failed to to resolve user %s", incidentToModify.CommanderUserID)
	}
	newCommander, err := s.pluginAPI.User.Get(commanderID)
	if err != nil {
		return errors.Wrapf(err, "failed to to resolve user %s", commanderID)
	}

	incidentToModify.CommanderUserID = commanderID
	if err = s.store.UpdateIncident(incidentToModify); err != nil {
		return errors.Wrapf(err, "failed to update incident")
	}

	s.poster.PublishWebsocketEventToChannel(incidentUpdatedWSEvent, incidentToModify, incidentToModify.ChannelID)
	s.telemetry.ChangeCommander(incidentToModify, userID)

	mainChannelID := incidentToModify.ChannelID
	modifyMessage := fmt.Sprintf("changed the incident commander from **@%s** to **@%s**.",
		oldCommander.Username, newCommander.Username)
	if _, err := s.modificationMessage(userID, mainChannelID, modifyMessage); err != nil {
		return err
	}

	return nil
}

// ModifyCheckedState checks or unchecks the specified checklist item. Idempotent, will not perform
// any action if the checklist item is already in the given checked state
func (s *ServiceImpl) ModifyCheckedState(incidentID, userID, newState string, checklistNumber, itemNumber int) error {
	incidentToModify, err := s.checklistItemParamsVerify(incidentID, userID, checklistNumber, itemNumber)
	if err != nil {
		return err
	}

	if !playbook.IsValidChecklistItemIndex(incidentToModify.Checklists, checklistNumber, itemNumber) {
		return errors.New("invalid checklist item indicies")
	}

	itemToCheck := incidentToModify.Checklists[checklistNumber].Items[itemNumber]
	if newState == itemToCheck.State {
		return nil
	}

	// Send modification message before the actual modification because we need the postID
	// from the notification message.
	s.telemetry.ModifyCheckedState(incidentID, userID, newState, incidentToModify.CommanderUserID == userID, itemToCheck.AssigneeID == userID)

	mainChannelID := incidentToModify.ChannelID
	modifyMessage := fmt.Sprintf("checked off checklist item **%v**", stripmd.Strip(itemToCheck.Title))
	if newState == playbook.ChecklistItemStateOpen {
		modifyMessage = fmt.Sprintf("unchecked checklist item **%v**", stripmd.Strip(itemToCheck.Title))
	}
	postID, err := s.modificationMessage(userID, mainChannelID, modifyMessage)
	if err != nil {
		return err
	}

	itemToCheck.State = newState
	itemToCheck.StateModified = model.GetMillis()
	itemToCheck.StateModifiedPostID = postID
	incidentToModify.Checklists[checklistNumber].Items[itemNumber] = itemToCheck

	if err = s.store.UpdateIncident(incidentToModify); err != nil {
		return errors.Wrapf(err, "failed to update incident, is now in inconsistent state")
	}

	s.poster.PublishWebsocketEventToChannel(incidentUpdatedWSEvent, incidentToModify, incidentToModify.ChannelID)

	return nil
}

// ToggleCheckedState checks or unchecks the specified checklist item
func (s *ServiceImpl) ToggleCheckedState(incidentID, userID string, checklistNumber, itemNumber int) error {
	incidentToModify, err := s.checklistItemParamsVerify(incidentID, userID, checklistNumber, itemNumber)
	if err != nil {
		return err
	}

	if !playbook.IsValidChecklistItemIndex(incidentToModify.Checklists, checklistNumber, itemNumber) {
		return errors.New("invalid checklist item indices")
	}

	isOpen := incidentToModify.Checklists[checklistNumber].Items[itemNumber].State == playbook.ChecklistItemStateOpen
	newState := playbook.ChecklistItemStateOpen
	if isOpen {
		newState = playbook.ChecklistItemStateClosed
	}

	return s.ModifyCheckedState(incidentID, userID, newState, checklistNumber, itemNumber)
}

// SetAssignee sets the assignee for the specified checklist item
// Idempotent, will not perform any actions if the checklist item is already assigned to assigneeID
func (s *ServiceImpl) SetAssignee(incidentID, userID, assigneeID string, checklistNumber, itemNumber int) error {
	incidentToModify, err := s.checklistItemParamsVerify(incidentID, userID, checklistNumber, itemNumber)
	if err != nil {
		return err
	}

	if !playbook.IsValidChecklistItemIndex(incidentToModify.Checklists, checklistNumber, itemNumber) {
		return errors.New("invalid checklist item indices")
	}

	itemToCheck := incidentToModify.Checklists[checklistNumber].Items[itemNumber]
	if assigneeID == itemToCheck.AssigneeID {
		return nil
	}

	newAssigneeUsername := noAssigneeName
	if assigneeID != "" {
		newUser, err2 := s.pluginAPI.User.Get(assigneeID)
		if err2 != nil {
			return errors.Wrapf(err, "failed to to resolve user %s", assigneeID)
		}
		newAssigneeUsername = "@" + newUser.Username
	}

	oldAssigneeUsername := noAssigneeName
	if itemToCheck.AssigneeID != "" {
		oldUser, err2 := s.pluginAPI.User.Get(itemToCheck.AssigneeID)
		if err2 != nil {
			return errors.Wrapf(err, "failed to to resolve user %s", assigneeID)
		}
		oldAssigneeUsername = oldUser.Username
	}

	mainChannelID := incidentToModify.ChannelID
	modifyMessage := fmt.Sprintf("changed assignee of checklist item **%s** from **%s** to **%s**",
		stripmd.Strip(itemToCheck.Title), oldAssigneeUsername, newAssigneeUsername)

	// Send modification message before the actual modification because we need the postID
	// from the notification message.
	postID, err := s.modificationMessage(userID, mainChannelID, modifyMessage)
	if err != nil {
		return err
	}

	itemToCheck.AssigneeID = assigneeID
	itemToCheck.AssigneeModified = model.GetMillis()
	itemToCheck.AssigneeModifiedPostID = postID
	incidentToModify.Checklists[checklistNumber].Items[itemNumber] = itemToCheck

	if err = s.store.UpdateIncident(incidentToModify); err != nil {
		return errors.Wrapf(err, "failed to update incident; it is now in an inconsistent state")
	}

	s.telemetry.SetAssignee(incidentID, userID)
	s.poster.PublishWebsocketEventToChannel(incidentUpdatedWSEvent, incidentToModify, incidentToModify.ChannelID)

	return nil
}

// RunChecklistItemSlashCommand executes the slash command associated with the specified checklist
// item.
func (s *ServiceImpl) RunChecklistItemSlashCommand(incidentID, userID string, checklistNumber, itemNumber int) (string, error) {
	incident, err := s.checklistItemParamsVerify(incidentID, userID, checklistNumber, itemNumber)
	if err != nil {
		return "", err
	}

	if !playbook.IsValidChecklistItemIndex(incident.Checklists, checklistNumber, itemNumber) {
		return "", errors.New("invalid checklist item indices")
	}

	itemToRun := incident.Checklists[checklistNumber].Items[itemNumber]
	if strings.TrimSpace(itemToRun.Command) == "" {
		return "", errors.New("no slash command associated with this checklist item")
	}

	cmdResponse, err := s.pluginAPI.SlashCommand.Execute(&model.CommandArgs{
		Command:   itemToRun.Command,
		UserId:    userID,
		TeamId:    incident.TeamID,
		ChannelId: incident.ChannelID,
	})
	if err == pluginapi.ErrNotFound {
		trigger := strings.Fields(itemToRun.Command)[0]
		s.poster.EphemeralPost(userID, incident.ChannelID, &model.Post{Message: fmt.Sprintf("Failed to find slash command **%s**", trigger)})

		return "", errors.Wrap(err, "failed to find slash command")
	} else if err != nil {
		s.poster.EphemeralPost(userID, incident.ChannelID, &model.Post{Message: fmt.Sprintf("Failed to execute slash command **%s**", itemToRun.Command)})

		return "", errors.Wrap(err, "failed to run slash command")
	}

	// Record the last (successful) run time.
	incident.Checklists[checklistNumber].Items[itemNumber].CommandLastRun = model.GetMillis()
	if err = s.store.UpdateIncident(incident); err != nil {
		return "", errors.Wrapf(err, "failed to update incident recording run of slash command")
	}

	s.poster.PublishWebsocketEventToChannel(incidentUpdatedWSEvent, incident, incident.ChannelID)
	s.telemetry.RunTaskSlashCommand(incidentID, userID)

	return cmdResponse.TriggerId, nil
}

// AddChecklistItem adds an item to the specified checklist
func (s *ServiceImpl) AddChecklistItem(incidentID, userID string, checklistNumber int, checklistItem playbook.ChecklistItem) error {
	incidentToModify, err := s.checklistParamsVerify(incidentID, userID, checklistNumber)
	if err != nil {
		return err
	}

	incidentToModify.Checklists[checklistNumber].Items = append(incidentToModify.Checklists[checklistNumber].Items, checklistItem)

	if err = s.store.UpdateIncident(incidentToModify); err != nil {
		return errors.Wrapf(err, "failed to update incident")
	}

	s.poster.PublishWebsocketEventToChannel(incidentUpdatedWSEvent, incidentToModify, incidentToModify.ChannelID)
	s.telemetry.AddTask(incidentID, userID)

	return nil
}

// RemoveChecklistItem removes the item at the given index from the given checklist
func (s *ServiceImpl) RemoveChecklistItem(incidentID, userID string, checklistNumber, itemNumber int) error {
	incidentToModify, err := s.checklistItemParamsVerify(incidentID, userID, checklistNumber, itemNumber)
	if err != nil {
		return err
	}

	incidentToModify.Checklists[checklistNumber].Items = append(
		incidentToModify.Checklists[checklistNumber].Items[:itemNumber],
		incidentToModify.Checklists[checklistNumber].Items[itemNumber+1:]...,
	)

	if err = s.store.UpdateIncident(incidentToModify); err != nil {
		return errors.Wrapf(err, "failed to update incident")
	}

	s.poster.PublishWebsocketEventToChannel(incidentUpdatedWSEvent, incidentToModify, incidentToModify.ChannelID)
	s.telemetry.RemoveTask(incidentID, userID)

	return nil
}

// ChangeActiveStage processes a request from userID to change the active
// stage of incidentID to stageIdx.
func (s *ServiceImpl) ChangeActiveStage(incidentID, userID string, stageIdx int) (*Incident, error) {
	incidentToModify, err := s.store.GetIncident(incidentID)
	if err != nil {
		return nil, err
	}

	if incidentToModify.ActiveStage == stageIdx {
		return incidentToModify, nil
	}

	if stageIdx < 0 || stageIdx >= len(incidentToModify.Checklists) {
		return nil, errors.Errorf("index %d out of bounds: incident %s has %d stages", stageIdx, incidentID, len(incidentToModify.Checklists))
	}

	oldActiveStage := incidentToModify.ActiveStage
	incidentToModify.ActiveStage = stageIdx

	if len(incidentToModify.Checklists) > 0 {
		incidentToModify.ActiveStageTitle = incidentToModify.Checklists[stageIdx].Title
	}

	if err = s.store.UpdateIncident(incidentToModify); err != nil {
		return nil, errors.Wrapf(err, "failed to update incident")
	}

	s.poster.PublishWebsocketEventToChannel(incidentUpdatedWSEvent, incidentToModify, incidentToModify.ChannelID)
	s.telemetry.ChangeStage(incidentToModify, userID)

	modifyMessage := fmt.Sprintf("changed the active stage from **%s** to **%s**.",
		incidentToModify.Checklists[oldActiveStage].Title,
		incidentToModify.Checklists[stageIdx].Title,
	)

	mainChannelID := incidentToModify.ChannelID
	if _, err := s.modificationMessage(userID, mainChannelID, modifyMessage); err != nil {
		return nil, err
	}

	return incidentToModify, nil
}

// OpenNextStageDialog opens an interactive dialog so the user can confirm
// going to the next stage
func (s *ServiceImpl) OpenNextStageDialog(incidentID string, nextStage int, triggerID string) error {
	dialog := model.Dialog{
		Title:            "Not all tasks in this stage are complete.",
		IntroductionText: "Are you sure you want to advance to the next stage?",
		SubmitLabel:      "Confirm",
		NotifyOnCancel:   false,
		State:            strconv.Itoa(nextStage),
	}

	dialogRequest := model.OpenDialogRequest{
		URL: fmt.Sprintf("/plugins/%s/api/v0/incidents/%s/next-stage-dialog",
			s.configService.GetManifest().Id,
			incidentID,
		),
		Dialog:    dialog,
		TriggerId: triggerID,
	}

	if err := s.pluginAPI.Frontend.OpenInteractiveDialog(dialogRequest); err != nil {
		return errors.Wrapf(err, "failed to open new incident dialog")
	}

	return nil
}

// RenameChecklistItem changes the title of a specified checklist item
func (s *ServiceImpl) RenameChecklistItem(incidentID, userID string, checklistNumber, itemNumber int, newTitle, newCommand string) error {
	incidentToModify, err := s.checklistItemParamsVerify(incidentID, userID, checklistNumber, itemNumber)
	if err != nil {
		return err
	}

	incidentToModify.Checklists[checklistNumber].Items[itemNumber].Title = newTitle
	incidentToModify.Checklists[checklistNumber].Items[itemNumber].Command = newCommand

	if err = s.store.UpdateIncident(incidentToModify); err != nil {
		return errors.Wrapf(err, "failed to update incident")
	}

	s.poster.PublishWebsocketEventToChannel(incidentUpdatedWSEvent, incidentToModify, incidentToModify.ChannelID)
	s.telemetry.RenameTask(incidentID, userID)

	return nil
}

// MoveChecklistItem moves a checklist item to a new location
func (s *ServiceImpl) MoveChecklistItem(incidentID, userID string, checklistNumber, itemNumber, newLocation int) error {
	incidentToModify, err := s.checklistItemParamsVerify(incidentID, userID, checklistNumber, itemNumber)
	if err != nil {
		return err
	}

	if newLocation >= len(incidentToModify.Checklists[checklistNumber].Items) {
		return errors.New("invalid targetNumber")
	}

	// Move item
	checklist := incidentToModify.Checklists[checklistNumber].Items
	itemMoved := checklist[itemNumber]
	// Delete item to move
	checklist = append(checklist[:itemNumber], checklist[itemNumber+1:]...)
	// Insert item in new location
	checklist = append(checklist, playbook.ChecklistItem{})
	copy(checklist[newLocation+1:], checklist[newLocation:])
	checklist[newLocation] = itemMoved
	incidentToModify.Checklists[checklistNumber].Items = checklist

	if err = s.store.UpdateIncident(incidentToModify); err != nil {
		return errors.Wrapf(err, "failed to update incident")
	}

	s.poster.PublishWebsocketEventToChannel(incidentUpdatedWSEvent, incidentToModify, incidentToModify.ChannelID)
	s.telemetry.MoveTask(incidentID, userID)

	return nil
}

// GetChecklistAutocomplete returns the list of checklist items for incidentID to be used in autocomplete
func (s *ServiceImpl) GetChecklistAutocomplete(incidentID string) ([]model.AutocompleteListItem, error) {
	theIncident, err := s.store.GetIncident(incidentID)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to retrieve incident")
	}

	ret := make([]model.AutocompleteListItem, 0)

	for i, checklist := range theIncident.Checklists {
		for j, item := range checklist.Items {
			ret = append(ret, model.AutocompleteListItem{
				Item:     fmt.Sprintf("%d %d", i, j),
				Hint:     fmt.Sprintf("\"%s\"", stripmd.Strip(item.Title)),
				HelpText: "Check/uncheck this item",
			})
		}
	}

	return ret, nil
}

func (s *ServiceImpl) checklistParamsVerify(incidentID, userID string, checklistNumber int) (*Incident, error) {
	incidentToModify, err := s.store.GetIncident(incidentID)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to retrieve incident")
	}

	if !s.hasPermissionToModifyIncident(incidentToModify, userID) {
		return nil, errors.New("user does not have permission to modify incident")
	}

	if checklistNumber >= len(incidentToModify.Checklists) {
		return nil, errors.New("invalid checklist number")
	}

	return incidentToModify, nil
}

func (s *ServiceImpl) modificationMessage(userID, channelID, message string) (string, error) {
	user, err := s.pluginAPI.User.Get(userID)
	if err != nil {
		return "", errors.Wrapf(err, "failed to to resolve user %s", userID)
	}

	postID, err := s.poster.PostMessage(channelID, user.Username+" "+message)
	if err != nil {
		return "", errors.Wrapf(err, "failed to post end incident messsage")
	}

	return postID, nil
}

func (s *ServiceImpl) checklistItemParamsVerify(incidentID, userID string, checklistNumber, itemNumber int) (*Incident, error) {
	incidentToModify, err := s.checklistParamsVerify(incidentID, userID, checklistNumber)
	if err != nil {
		return nil, err
	}

	if itemNumber >= len(incidentToModify.Checklists[checklistNumber].Items) {
		return nil, errors.New("invalid item number")
	}

	return incidentToModify, nil
}

// NukeDB removes all incident related data.
func (s *ServiceImpl) NukeDB() error {
	return s.store.NukeDB()
}

// ChangeCreationDate changes the creation date of the incident.
func (s *ServiceImpl) ChangeCreationDate(incidentID string, creationTimestamp time.Time) error {
	return s.store.ChangeCreationDate(incidentID, creationTimestamp)
}

func (s *ServiceImpl) hasPermissionToModifyIncident(incident *Incident, userID string) bool {
	// Incident main channel membership is required to modify incident
	return s.pluginAPI.User.HasPermissionToChannel(userID, incident.ChannelID, model.PERMISSION_READ_CHANNEL)
}

func (s *ServiceImpl) createIncidentChannel(incdnt *Incident, public bool) (*model.Channel, error) {
	channelHeader := "The channel was created by the Incident Management plugin."

	if incdnt.Description != "" {
		channelHeader = incdnt.Description
	}

	channelType := model.CHANNEL_PRIVATE
	if public {
		channelType = model.CHANNEL_OPEN
	}

	channel := &model.Channel{
		TeamId:      incdnt.TeamID,
		Type:        channelType,
		DisplayName: incdnt.Name,
		Name:        cleanChannelName(incdnt.Name),
		Header:      channelHeader,
	}

	// Prefer the channel name the user chose. But if it already exists, add some random bits
	// and try exactly once more.
	err := s.pluginAPI.Channel.Create(channel)
	if err != nil {
		if appErr, ok := err.(*model.AppError); ok {
			// Let the user correct display name errors:
			if appErr.Id == "model.channel.is_valid.display_name.app_error" ||
				appErr.Id == "model.channel.is_valid.2_or_more.app_error" {
				return nil, ErrChannelDisplayNameInvalid
			}

			// We can fix channel Name errors:
			if appErr.Id == "store.sql_channel.save_channel.exists.app_error" {
				channel.Name = addRandomBits(channel.Name)
				err = s.pluginAPI.Channel.Create(channel)
			}
		}

		if err != nil {
			return nil, errors.Wrapf(err, "failed to create incident channel")
		}
	}

	if _, err := s.pluginAPI.Channel.AddUser(channel.Id, incdnt.CommanderUserID, s.configService.GetConfiguration().BotUserID); err != nil {
		return nil, errors.Wrapf(err, "failed to add user to channel")
	}

	return channel, nil
}

func (s *ServiceImpl) newIncidentDialog(teamID, commanderID, postID, clientID string, playbooks []playbook.Playbook, isMobileApp bool) (*model.Dialog, error) {
	team, err := s.pluginAPI.Team.Get(teamID)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to fetch team")
	}

	user, err := s.pluginAPI.User.Get(commanderID)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to fetch commander user")
	}

	state, err := json.Marshal(DialogState{
		PostID:   postID,
		ClientID: clientID,
	})
	if err != nil {
		return nil, errors.Wrapf(err, "failed to marshal DialogState")
	}

	var options []*model.PostActionOptions
	for _, playbook := range playbooks {
		options = append(options, &model.PostActionOptions{
			Text:  playbook.Title,
			Value: playbook.ID,
		})
	}

	siteURL := model.SERVICE_SETTINGS_DEFAULT_SITE_URL
	if s.pluginAPI.Configuration.GetConfig().ServiceSettings.SiteURL != nil {
		siteURL = *s.pluginAPI.Configuration.GetConfig().ServiceSettings.SiteURL
	}
	newPlaybookMarkdown := ""
	if siteURL != "" && !isMobileApp {
		url := fmt.Sprintf("%s/%s/%s/playbooks/new", siteURL, team.Name, s.configService.GetManifest().Id)
		newPlaybookMarkdown = fmt.Sprintf(" [Create a playbook.](%s)", url)
	}

	introText := fmt.Sprintf("**Commander:** %v\n\nPlaybooks are necessary to start an incident.%s", getUserDisplayName(user), newPlaybookMarkdown)

	var descriptionDefault string
	if postID != "" {
		postURL := fmt.Sprintf("%s/_redirect/pl/%s", siteURL, postID)

		descriptionDefault = fmt.Sprintf("[Original Post](%s)", postURL)
	}

	return &model.Dialog{
		Title:            "Incident Details",
		IntroductionText: introText,
		Elements: []model.DialogElement{
			{
				DisplayName: "Playbook",
				Name:        DialogFieldPlaybookIDKey,
				Type:        "select",
				Options:     options,
			},
			{
				DisplayName: "Incident Name",
				Name:        DialogFieldNameKey,
				Type:        "text",
				MinLength:   2,
				MaxLength:   64,
			},
			{
				DisplayName: "Incident Description",
				Name:        DialogFieldDescriptionKey,
				Type:        "textarea",
				Default:     descriptionDefault,
				MinLength:   0,
				MaxLength:   1024,
				Optional:    true,
			},
		},
		SubmitLabel:    "Start Incident",
		NotifyOnCancel: false,
		State:          string(state),
	}, nil
}

func (s *ServiceImpl) newUpdateIncidentDialog(message, broadcastChannelID string) (*model.Dialog, error) {
	introductionText := "Update your incident status."

	broadcastChannel, err := s.pluginAPI.Channel.Get(broadcastChannelID)
	if err == nil {
		team, err := s.pluginAPI.Team.Get(broadcastChannel.TeamId)
		if err != nil {
			return nil, err
		}

		introductionText += fmt.Sprintf(" This post will be broadcasted to [%s](/%s/channels/%s).", broadcastChannel.DisplayName, team.Name, broadcastChannel.Id)
	}

	return &model.Dialog{
		Title:            "Update Incident Status",
		IntroductionText: introductionText,
		Elements: []model.DialogElement{
			{
				DisplayName: "Message",
				Name:        DialogFieldMessageKey,
				Type:        "textarea",
				Default:     message,
			},
			{
				DisplayName: "Reminder for next update",
				Name:        DialogFieldReminderInMinutesKey,
				Type:        "select",
				Options: []*model.PostActionOptions{
					{
						Text:  "None",
						Value: "0",
					},
					{
						Text:  "15min",
						Value: "15",
					},
					{
						Text:  "30min",
						Value: "30",
					},
					{
						Text:  "60min",
						Value: "60",
					},
					{
						Text:  "4hr",
						Value: "240",
					},
					{
						Text:  "24hr",
						Value: "1440",
					},
				},
				Optional: true,
				Default:  "0",
			},
		},
		SubmitLabel:    "Update Status",
		NotifyOnCancel: false,
	}, nil
}

func getUserDisplayName(user *model.User) string {
	if user == nil {
		return ""
	}

	if user.FirstName != "" && user.LastName != "" {
		return fmt.Sprintf("%s %s", user.FirstName, user.LastName)
	}

	return fmt.Sprintf("@%s", user.Username)
}

func cleanChannelName(channelName string) string {
	// Lower case only
	channelName = strings.ToLower(channelName)
	// Trim spaces
	channelName = strings.TrimSpace(channelName)
	// Change all dashes to whitespace, remove everything that's not a word or whitespace, all space becomes dashes
	channelName = strings.ReplaceAll(channelName, "-", " ")
	channelName = allNonSpaceNonWordRegex.ReplaceAllString(channelName, "")
	channelName = strings.ReplaceAll(channelName, " ", "-")
	// Remove all leading and trailing dashes
	channelName = strings.Trim(channelName, "-")

	return channelName
}

func addRandomBits(name string) string {
	// Fix too long names (we're adding 5 chars):
	if len(name) > 59 {
		name = name[:59]
	}
	randBits := model.NewId()
	return fmt.Sprintf("%s-%s", name, randBits[:4])
}

func findNewestNonDeletedPostID(posts []StatusPost) string {
	var newest *StatusPost
	for i, p := range posts {
		if newest == nil || p.DeleteAt == 0 && p.CreateAt > newest.CreateAt {
			newest = &posts[i]
		}
	}
	if newest == nil {
		return ""
	}
	return newest.ID
}
