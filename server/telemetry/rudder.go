package telemetry

import (
	"sync"

	"github.com/mattermost/mattermost-plugin-incident-response/server/incident"
	"github.com/mattermost/mattermost-plugin-incident-response/server/playbook"
	"github.com/pkg/errors"
	rudder "github.com/rudderlabs/analytics-go"
)

// RudderTelemetry implements Telemetry using a Rudder backend.
type RudderTelemetry struct {
	client        rudder.Client
	diagnosticID  string
	pluginVersion string
	serverVersion string
	writeKey      string
	dataPlaneURL  string
	enabled       bool
	mutex         sync.RWMutex
}

// Unique strings that identify each of the tracked events
const (
	eventCreateIncident       = "CreateIncident"
	eventEndIncident          = "EndIncident"
	eventAddChecklistItem     = "AddChecklistItem"
	eventRemoveChecklistItem  = "RemoveChecklistItem"
	eventRenameChecklistItem  = "RenameChecklistItem"
	eventCheckChecklistItem   = "CheckChecklistItem"
	eventUncheckChecklistItem = "UncheckChecklistItem"
	eventMoveChecklistItem    = "MoveChecklistItem"
	eventCreatePlaybook       = "CreatePlaybook"
	eventUpdatePlaybook       = "UpdatePlaybook"
	eventDeletePlaybook       = "DeletePlaybook"
)

// NewRudder builds a new RudderTelemetry client that will send the events to
// dataPlaneURL with the writeKey, identified with the diagnosticID. The
// version of the server is also sent with every event tracked.
// If either diagnosticID or serverVersion are empty, an error is returned.
func NewRudder(dataPlaneURL, writeKey, diagnosticID string, pluginVersion, serverVersion string) (*RudderTelemetry, error) {
	if diagnosticID == "" {
		return nil, errors.New("diagnosticID should not be empty")
	}

	if pluginVersion == "" {
		return nil, errors.New("pluginVersion should not be empty")
	}

	if serverVersion == "" {
		return nil, errors.New("serverVersion should not be empty")
	}

	client, err := rudder.NewWithConfig(writeKey, dataPlaneURL, rudder.Config{})
	if err != nil {
		return nil, err
	}

	return &RudderTelemetry{
		client:        client,
		diagnosticID:  diagnosticID,
		pluginVersion: pluginVersion,
		serverVersion: serverVersion,
		writeKey:      writeKey,
		dataPlaneURL:  dataPlaneURL,
		enabled:       true,
	}, nil
}

func (t *RudderTelemetry) track(event string, properties map[string]interface{}) {
	t.mutex.RLock()
	defer t.mutex.RUnlock()

	if !t.enabled {
		return
	}

	properties["PluginVersion"] = t.pluginVersion
	properties["ServerVersion"] = t.serverVersion

	t.client.Enqueue(rudder.Track{
		UserId:     t.diagnosticID,
		Event:      event,
		Properties: properties,
	})
}

func incidentProperties(incident *incident.Incident) map[string]interface{} {
	totalChecklistItems := 0
	for _, checklist := range incident.Playbook.Checklists {
		totalChecklistItems += len(checklist.Items)
	}

	return map[string]interface{}{
		"IncidentID":          incident.ID,
		"IsActive":            incident.IsActive,
		"CommanderUserID":     incident.CommanderUserID,
		"TeamID":              incident.TeamID,
		"CreatedAt":           incident.CreatedAt,
		"PostID":              incident.PostID,
		"NumChecklists":       len(incident.Playbook.Checklists),
		"TotalChecklistItems": totalChecklistItems,
	}
}

// CreateIncident tracks the creation of the incident passed.
func (t *RudderTelemetry) CreateIncident(incident *incident.Incident, public bool) {
	properties := incidentProperties(incident)
	properties["Public"] = public
	t.track(eventCreateIncident, properties)
}

// EndIncident tracks the end of the incident passed.
func (t *RudderTelemetry) EndIncident(incident *incident.Incident) {
	t.track(eventEndIncident, incidentProperties(incident))
}

func checklistItemProperties(incidentID, userID string) map[string]interface{} {
	return map[string]interface{}{
		"IncidentID": incidentID,
		"UserID":     userID,
	}
}

// AddChecklistItem tracks the creation of a new checklist item by the user
// identified by userID in the incident identified by incidentID.
func (t *RudderTelemetry) AddChecklistItem(incidentID, userID string) {
	t.track(eventAddChecklistItem, checklistItemProperties(incidentID, userID))
}

// RemoveChecklistItem tracks the removal of a checklist item by the user
// identified by userID in the incident identified by incidentID.
func (t *RudderTelemetry) RemoveChecklistItem(incidentID, userID string) {
	t.track(eventRemoveChecklistItem, checklistItemProperties(incidentID, userID))
}

// RenameChecklistItem tracks the update of a checklist item by the user
// identified by userID in the incident identified by incidentID.
func (t *RudderTelemetry) RenameChecklistItem(incidentID, userID string) {
	t.track(eventRenameChecklistItem, checklistItemProperties(incidentID, userID))
}

// ModifyCheckedState tracks the checking and unchecking of items by the user
// identified by userID in the incident identified by incidentID.
func (t *RudderTelemetry) ModifyCheckedState(incidentID, userID string, newState bool) {
	if newState {
		t.track(eventCheckChecklistItem, checklistItemProperties(incidentID, userID))
	} else {
		t.track(eventUncheckChecklistItem, checklistItemProperties(incidentID, userID))
	}
}

// MoveChecklistItem tracks the movment of checklist items by the user
// identified by userID in the incident identified by incidentID.
func (t *RudderTelemetry) MoveChecklistItem(incidentID, userID string) {
	t.track(eventMoveChecklistItem, checklistItemProperties(incidentID, userID))
}

func playbookProperties(playbook playbook.Playbook) map[string]interface{} {
	totalChecklistItems := 0
	for _, checklist := range playbook.Checklists {
		totalChecklistItems += len(checklist.Items)
	}

	return map[string]interface{}{
		"PlaybookID":          playbook.ID,
		"TeamID":              playbook.TeamID,
		"NumChecklists":       len(playbook.Checklists),
		"TotalChecklistItems": totalChecklistItems,
	}
}

// CreatePlaybook tracks the creation of a playbook.
func (t *RudderTelemetry) CreatePlaybook(playbook playbook.Playbook) {
	t.track(eventCreatePlaybook, playbookProperties(playbook))
}

// UpdatePlaybook tracks the update of a playbook.
func (t *RudderTelemetry) UpdatePlaybook(playbook playbook.Playbook) {
	t.track(eventUpdatePlaybook, playbookProperties(playbook))
}

// DeletePlaybook tracks the deletion of a playbook.
func (t *RudderTelemetry) DeletePlaybook(playbook playbook.Playbook) {
	t.track(eventDeletePlaybook, playbookProperties(playbook))
}

// Enable creates a new client to track all future events. It does nothing if
// a client is already enabled.
func (t *RudderTelemetry) Enable() error {
	t.mutex.Lock()
	defer t.mutex.Unlock()

	if t.enabled {
		return nil
	}

	newClient, err := rudder.NewWithConfig(t.writeKey, t.dataPlaneURL, rudder.Config{})
	if err != nil {
		return err
	}

	t.client = newClient
	t.enabled = true
	return nil
}

// Disable disables telemetry for all future events. It does nothing if the
// client is already disabled.
func (t *RudderTelemetry) Disable() error {
	t.mutex.Lock()
	defer t.mutex.Unlock()

	if !t.enabled {
		return nil
	}

	if err := t.client.Close(); err != nil {
		return err
	}

	t.enabled = false
	return nil
}
