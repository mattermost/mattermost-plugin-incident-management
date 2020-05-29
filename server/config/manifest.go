// This file is automatically generated. Do not modify it manually.

package config

import (
	"strings"

	"github.com/mattermost/mattermost-server/v5/model"
)

// Manifest of the plugin
var Manifest *model.Manifest

const manifestStr = `
{
  "id": "com.mattermost.plugin-incident-response",
  "name": "Incident Response",
  "description": "This plugin allows users to coordinate and manage incidents within Mattermost.",
  "version": "0.4.0-alpha.5",
  "min_server_version": "5.12.0",
  "server": {
    "executables": {
      "linux-amd64": "server/dist/plugin-linux-amd64",
      "darwin-amd64": "server/dist/plugin-darwin-amd64",
      "windows-amd64": "server/dist/plugin-windows-amd64.exe"
    },
    "executable": ""
  },
  "webapp": {
    "bundle_path": "webapp/dist/main.js"
  },
  "settings_schema": {
    "header": "",
    "footer": "",
    "settings": []
  }
}
`

func init() {
	Manifest = model.ManifestFromJson(strings.NewReader(manifestStr))
}
