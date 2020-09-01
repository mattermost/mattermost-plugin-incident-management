package pluginkvstore

import (
	"database/sql"

	pluginapi "github.com/mattermost/mattermost-plugin-api"

	"github.com/mattermost/mattermost-server/v5/model"
)

const keyVersionPrefix = "v2_"

// KVAPI is the key value store interface for the pluginkv stores.
// It is implemented by mattermost-plugin-api/Client.KV, or by the mock KVAPI.
type KVAPI interface {
	Set(key string, value interface{}, options ...pluginapi.KVSetOption) (bool, error)
	Get(key string, out interface{}) error
	SetAtomicWithRetries(key string, valueFunc func(oldValue []byte) (newValue interface{}, err error)) error
	DeleteAll() error
}

// StoreAPI is the interface exposing the underlying database, provided by pluginapi
// It is implemented by mattermost-plugin-api/Client.Store, or by the mock StoreAPI.
type StoreAPI interface {
	GetMasterDB() (*sql.DB, error)
	DriverName() string
}

// UserAPI is the interface exposing the user methods, provided by pluginapi
// It is implemented by mattermost-plugin-api/Client.User, or by the mock UserAPI.
type UserAPI interface {
	Get(userID string) (*model.User, error)
}

// PluginAPIClient is the struct combining the interfaces defined above, which is everything
// from pluginapi that the store currently uses.
type PluginAPIClient struct {
	KV    KVAPI
	Store StoreAPI
	User  UserAPI
}

// NewClient receives a pluginapi.Client and returns the PluginAPIClient, which is what the
// store will use to access pluginapi.Client.
func NewClient(api *pluginapi.Client) PluginAPIClient {
	return PluginAPIClient{
		KV:    &api.KV,
		Store: api.Store,
		User:  &api.User,
	}
}
