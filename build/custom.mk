# Include custom targets and environment variables here
GO_BUILD_FLAGS += -ldflags "-X main.rudderDataplaneURL=$(MM_RUDDER_DATAPLANE_URL) -X main.rudderWriteKey=$(MM_RUDDER_WRITE_KEY)"

## Generate mocks.
mocks:
ifneq ($(HAS_SERVER),)
	go install github.com/golang/mock/mockgen
	mockgen -destination server/config/mocks/mock_service.go github.com/mattermost/mattermost-plugin-incident-collaboration/server/config Service
	mockgen -destination server/bot/mocks/mock_logger.go github.com/mattermost/mattermost-plugin-incident-collaboration/server/bot Logger
	mockgen -destination server/bot/mocks/mock_poster.go github.com/mattermost/mattermost-plugin-incident-collaboration/server/bot Poster
	mockgen -destination server/app/mocks/mock_playbook_run_service.go github.com/mattermost/mattermost-plugin-incident-collaboration/server/app PlaybookRunService
	mockgen -destination server/app/mocks/mock_playbook_run_store.go github.com/mattermost/mattermost-plugin-incident-collaboration/server/app PlaybookRunStore
	mockgen -destination server/app/mocks/mock_job_once_scheduler.go github.com/mattermost/mattermost-plugin-incident-collaboration/server/app JobOnceScheduler
	mockgen -destination server/app/mocks/mock_playbook_service.go github.com/mattermost/mattermost-plugin-incident-collaboration/server/app PlaybookService
	mockgen -destination server/app/mocks/mock_playbook_store.go github.com/mattermost/mattermost-plugin-incident-collaboration/server/app PlaybookStore
	mockgen -destination server/sqlstore/mocks/mock_kvapi.go github.com/mattermost/mattermost-plugin-incident-collaboration/server/sqlstore KVAPI
	mockgen -destination server/sqlstore/mocks/mock_storeapi.go github.com/mattermost/mattermost-plugin-incident-collaboration/server/sqlstore StoreAPI
	mockgen -destination server/sqlstore/mocks/mock_configurationapi.go github.com/mattermost/mattermost-plugin-incident-collaboration/server/sqlstore ConfigurationAPI
endif

## Runs the redocly server.
.PHONY: docs-server
docs-server:
	npx @redocly/openapi-cli@1.0.0-beta.3 preview-docs server/api/api.yaml
