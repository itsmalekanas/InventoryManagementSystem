package main

import (
	"encoding/json"
	"net"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"
)

func TestInstanceDetectionMatchesBuildAndDataDirectory(t *testing.T) {
	for _, scenario := range []string{"same copy", "different folder", "different build", "older app", "unrelated server"} {
		t.Run(scenario, func(t *testing.T) {
			dir := t.TempDir()
			identity := instanceIdentity{App: appID, DataDir: dir, BuildID: "build-a"}
			switch scenario {
			case "different folder":
				identity.DataDir = t.TempDir()
			case "different build":
				identity.BuildID = "build-b"
			case "older app":
				identity.DataDir = ""
				identity.BuildID = ""
			case "unrelated server":
				identity.App = "unrelated"
			}
			srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { json.NewEncoder(w).Encode(identity) }))
			defer srv.Close()
			_, portText, _ := net.SplitHostPort(strings.TrimPrefix(srv.URL, "http://"))
			port, _ := strconv.Atoi(portText)
			url, err := runningURL(port, dir, "build-a")
			switch scenario {
			case "same copy":
				if err != nil || url != srv.URL+"/" {
					t.Fatal("did not reopen same copy", url, err)
				}
			case "different folder", "unrelated server":
				if err != nil || url != "" {
					t.Fatal("opened wrong app/folder", url, err)
				}
			default:
				if err == nil || url != "" {
					t.Fatal("silently reused incompatible app")
				}
			}
		})
	}
}
