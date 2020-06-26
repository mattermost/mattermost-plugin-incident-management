package permissions

import (
	"github.com/pkg/errors"

	"github.com/mattermost/mattermost-server/v5/model"

	"github.com/mattermost/mattermost-plugin-incident-response/server/incident"

	pluginapi "github.com/mattermost/mattermost-plugin-api"
)

// ErrNoPermissions if the error is caused by the user not having permissions
var ErrNoPermissions = errors.New("does not have permissions")

// CheckHasPermissionsToIncidentChannel returns an error if the user does not have permissions to the incident channel.
func CheckHasPermissionsToIncidentChannel(userID, incidentID string, pluginAPI *pluginapi.Client, incidentService incident.Service) error {
	incidentToCheck, err := incidentService.GetIncident(incidentID)
	if err != nil {
		return errors.Wrapf(err, "could not get incident id `%s`", incidentID)
	}

	isChannelMember := pluginAPI.User.HasPermissionToChannel(userID, incidentToCheck.PrimaryChannelID, model.PERMISSION_READ_CHANNEL)
	if !isChannelMember {
		return errors.Wrapf(ErrNoPermissions, "userID `%s`", userID)
	}

	return nil
}

// CheckHasPermissionsToIncidentTeam returns an error if the user does not have permissions to
// the team that the incident belongs to.
func CheckHasPermissionsToIncidentTeam(userID, incidentID string, pluginAPI *pluginapi.Client, incidentService incident.Service) error {
	incidentToCheck, err := incidentService.GetIncident(incidentID)
	if err != nil {
		return errors.Wrapf(err, "could not get incident id `%s`", incidentID)
	}

	channel, err := pluginAPI.Channel.Get(incidentToCheck.PrimaryChannelID)
	if err != nil {
		return err
	}

	isTeamMember := pluginAPI.User.HasPermissionToTeam(userID, channel.TeamId, model.PERMISSION_VIEW_TEAM)
	if !isTeamMember {
		return errors.Wrapf(ErrNoPermissions, "userID `%s`", userID)
	}

	return nil
}
