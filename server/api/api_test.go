package api

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestAPI(t *testing.T) {
	for name, tc := range map[string]struct {
		test     func(t *testing.T, handler *Handler, writer *httptest.ResponseRecorder)
		authFunc func(string) (bool, error)
	}{
		"404": {
			test: func(t *testing.T, handler *Handler, writer *httptest.ResponseRecorder) {
				req := httptest.NewRequest("POST", "/api/v0/nothing", nil)
				handler.ServeHTTP(writer, req)
				resp := writer.Result()
				defer resp.Body.Close()
				assert.Equal(t, http.StatusNotFound, resp.StatusCode)
			},
		},
	} {
		t.Run(name, func(t *testing.T) {
			handler := NewHandler()
			writer := httptest.NewRecorder()
			tc.test(t, handler, writer)
		})
	}
}
