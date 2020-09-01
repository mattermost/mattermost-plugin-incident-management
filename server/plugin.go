package main

import (
	"net/http"

	"github.com/mattermost/mattermost-plugin-incident-response/server/api"
	"github.com/mattermost/mattermost-plugin-incident-response/server/bot"
	"github.com/mattermost/mattermost-plugin-incident-response/server/command"
	"github.com/mattermost/mattermost-plugin-incident-response/server/config"
	"github.com/mattermost/mattermost-plugin-incident-response/server/incident"
	"github.com/mattermost/mattermost-plugin-incident-response/server/playbook"
	"github.com/mattermost/mattermost-plugin-incident-response/server/pluginkvstore"
	"github.com/mattermost/mattermost-plugin-incident-response/server/sqlstore"
	"github.com/mattermost/mattermost-plugin-incident-response/server/subscription"
	"github.com/mattermost/mattermost-plugin-incident-response/server/telemetry"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/plugin"
	"github.com/pkg/errors"
	"github.com/sirupsen/logrus"

	pluginapi "github.com/mattermost/mattermost-plugin-api"
	"github.com/mattermost/mattermost-plugin-api/cluster"
)

// These credentials for Rudder need to be populated at build-time,
// passing the following flags to the go build command:
// -ldflags "-X main.rudderDataplaneURL=<url> -X main.rudderWriteKey=<write_key>"
var (
	rudderDataplaneURL string
	rudderWriteKey     string
)

// Plugin implements the interface expected by the Mattermost server to communicate between the
// server and plugin processes.
type Plugin struct {
	plugin.MattermostPlugin

	handler             *api.Handler
	config              *config.ServiceImpl
	incidentService     incident.Service
	playbookService     playbook.Service
	subscriptionService subscription.Service
	bot                 *bot.Bot
}

// ServeHTTP demonstrates a plugin that handles HTTP requests by greeting the world.
func (p *Plugin) ServeHTTP(c *plugin.Context, w http.ResponseWriter, r *http.Request) {
	p.handler.ServeHTTP(w, r, c.SourcePluginId)
}

// OnActivate Called when this plugin is activated.
func (p *Plugin) OnActivate() error {
	pluginAPIClient := pluginapi.NewClient(p.API)
	p.config = config.NewConfigService(pluginAPIClient, manifest)
	pluginapi.ConfigureLogrus(logrus.New(), pluginAPIClient)

	botID, err := pluginAPIClient.Bot.EnsureBot(&model.Bot{
		Username:    "incident",
		DisplayName: "Incident Bot",
		Description: "A prototype demonstrating incident response management in Mattermost.",
	},
		pluginapi.ProfileImagePath("assets/incident_plugin_icon.png"),
	)

	if err != nil {
		return errors.Wrapf(err, "failed to ensure incident bot")
	}
	err = p.config.UpdateConfiguration(func(c *config.Configuration) {
		c.BotUserID = botID
		c.AdminLogLevel = "debug"
	})
	if err != nil {
		return errors.Wrapf(err, "failed save bot to config")
	}

	var telemetryClient interface {
		incident.Telemetry
		playbook.Telemetry
		Enable() error
		Disable() error
	}

	if rudderDataplaneURL == "" || rudderWriteKey == "" {
		pluginAPIClient.Log.Warn("Rudder credentials are not set. Disabling analytics.")
		telemetryClient = &telemetry.NoopTelemetry{}
	} else {
		diagnosticID := pluginAPIClient.System.GetDiagnosticID()
		serverVersion := pluginAPIClient.System.GetServerVersion()
		telemetryClient, err = telemetry.NewRudder(rudderDataplaneURL, rudderWriteKey, diagnosticID, manifest.Version, serverVersion)
		if err != nil {
			return errors.Wrapf(err, "failed init telemetry client")
		}
	}

	toggleTelemetry := func() {
		diagnosticsFlag := pluginAPIClient.Configuration.GetConfig().LogSettings.EnableDiagnostics
		telemetryEnabled := diagnosticsFlag != nil && *diagnosticsFlag

		if telemetryEnabled {
			if err = telemetryClient.Enable(); err != nil {
				pluginAPIClient.Log.Warn("Telemetry could not be enabled", "Error", err)
			}
			return
		}

		if err = telemetryClient.Disable(); err != nil {
			pluginAPIClient.Log.Error("Telemetry could not be disabled", "Error", err)
		}
	}

	toggleTelemetry()
	p.config.RegisterConfigChangeListener(toggleTelemetry)

	p.handler = api.NewHandler()
	p.bot = bot.New(pluginAPIClient, p.config.GetConfiguration().BotUserID, p.config)
	p.incidentService = incident.NewService(
		pluginAPIClient,
		pluginkvstore.NewIncidentStore(pluginkvstore.NewClient(pluginAPIClient), p.bot),
		p.bot,
		p.config,
		telemetryClient,
	)

	p.playbookService = playbook.NewService(pluginkvstore.NewPlaybookStore(&pluginAPIClient.KV), p.bot, telemetryClient)
	p.subscriptionService = subscription.NewService(pluginkvstore.NewSubscriptionStore(&pluginAPIClient.KV))

	api.NewPlaybookHandler(p.handler.APIRouter, p.playbookService, pluginAPIClient, p.bot)
	api.NewIncidentHandler(p.handler.APIRouter, p.incidentService, p.playbookService, pluginAPIClient, p.bot, p.bot)
	api.NewSubscriptionHandler(p.handler.APIRouter, p.subscriptionService, p.playbookService, pluginAPIClient)

	if err = command.RegisterCommands(p.API.RegisterCommand); err != nil {
		return errors.Wrapf(err, "failed register commands")
	}

	sqlStore, err := sqlstore.New(sqlstore.NewClient(pluginAPIClient), p.bot)
	if err != nil {
		return errors.Wrapf(err, "failed creating the SQL store")
	}

	mutex, err := cluster.NewMutex(p.API, "IR_dbMutex")
	if err != nil {
		return errors.Wrapf(err, "failed creating cluster mutex")
	}

	// Cluster lock: only one plugin will perform the migration when needed
	if err := p.UpgradeDatabase(sqlStore, sqlstore.NewClient(pluginAPIClient), mutex); err != nil {
		return errors.Wrapf(err, "failed to run migrations")
	}

	p.API.LogDebug("Incident response plugin Activated")
	return nil
}

func (p *Plugin) UpgradeDatabase(sqlStore *sqlstore.SQLStore, pluginAPI sqlstore.PluginAPIClient, mutex *cluster.Mutex) error {
	mutex.Lock()
	defer mutex.Unlock()

	currentSchemaVersion, err := sqlStore.GetCurrentVersion()
	if err != nil {
		return errors.Wrapf(err, "failed to get the current schema version")
	}

	if currentSchemaVersion.LT(sqlstore.LatestVersion()) {
		if err := sqlStore.Migrate(pluginAPI, currentSchemaVersion); err != nil {
			return errors.Wrapf(err, "failed to complete migrations")
		}
	}

	return nil
}

// OnConfigurationChange handles any change in the configuration.
func (p *Plugin) OnConfigurationChange() error {
	if p.config == nil {
		return nil
	}

	return p.config.OnConfigurationChange()
}

// ExecuteCommand executes a command that has been previously registered via the RegisterCommand.
func (p *Plugin) ExecuteCommand(c *plugin.Context, args *model.CommandArgs) (*model.CommandResponse, *model.AppError) {
	runner := command.NewCommandRunner(c, args, pluginapi.NewClient(p.API), p.bot, p.bot, p.incidentService, p.playbookService)

	if err := runner.Execute(); err != nil {
		return nil, model.NewAppError("IncidentResponsePlugin.ExecuteCommand", "Unable to execute command.", nil, err.Error(), http.StatusInternalServerError)
	}

	return &model.CommandResponse{}, nil
}
