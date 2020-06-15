// Code generated by MockGen. DO NOT EDIT.
// Source: github.com/mattermost/mattermost-plugin-incident-response/server/pluginkvstore (interfaces: KVAPI)

// Package mock_pluginkvstore is a generated GoMock package.
package mock_pluginkvstore

import (
	gomock "github.com/golang/mock/gomock"
	pluginapi "github.com/mattermost/mattermost-plugin-api"
	reflect "reflect"
)

// MockKVAPI is a mock of KVAPI interface
type MockKVAPI struct {
	ctrl     *gomock.Controller
	recorder *MockKVAPIMockRecorder
}

// MockKVAPIMockRecorder is the mock recorder for MockKVAPI
type MockKVAPIMockRecorder struct {
	mock *MockKVAPI
}

// NewMockKVAPI creates a new mock instance
func NewMockKVAPI(ctrl *gomock.Controller) *MockKVAPI {
	mock := &MockKVAPI{ctrl: ctrl}
	mock.recorder = &MockKVAPIMockRecorder{mock}
	return mock
}

// EXPECT returns an object that allows the caller to indicate expected use
func (m *MockKVAPI) EXPECT() *MockKVAPIMockRecorder {
	return m.recorder
}

// DeleteAll mocks base method
func (m *MockKVAPI) DeleteAll() error {
	m.ctrl.T.Helper()
	ret := m.ctrl.Call(m, "DeleteAll")
	ret0, _ := ret[0].(error)
	return ret0
}

// DeleteAll indicates an expected call of DeleteAll
func (mr *MockKVAPIMockRecorder) DeleteAll() *gomock.Call {
	mr.mock.ctrl.T.Helper()
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "DeleteAll", reflect.TypeOf((*MockKVAPI)(nil).DeleteAll))
}

// Get mocks base method
func (m *MockKVAPI) Get(arg0 string, arg1 interface{}) error {
	m.ctrl.T.Helper()
	ret := m.ctrl.Call(m, "Get", arg0, arg1)
	ret0, _ := ret[0].(error)
	return ret0
}

// Get indicates an expected call of Get
func (mr *MockKVAPIMockRecorder) Get(arg0, arg1 interface{}) *gomock.Call {
	mr.mock.ctrl.T.Helper()
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "Get", reflect.TypeOf((*MockKVAPI)(nil).Get), arg0, arg1)
}

// Set mocks base method
func (m *MockKVAPI) Set(arg0 string, arg1 interface{}, arg2 ...pluginapi.KVSetOption) (bool, error) {
	m.ctrl.T.Helper()
	varargs := []interface{}{arg0, arg1}
	for _, a := range arg2 {
		varargs = append(varargs, a)
	}
	ret := m.ctrl.Call(m, "Set", varargs...)
	ret0, _ := ret[0].(bool)
	ret1, _ := ret[1].(error)
	return ret0, ret1
}

// Set indicates an expected call of Set
func (mr *MockKVAPIMockRecorder) Set(arg0, arg1 interface{}, arg2 ...interface{}) *gomock.Call {
	mr.mock.ctrl.T.Helper()
	varargs := append([]interface{}{arg0, arg1}, arg2...)
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "Set", reflect.TypeOf((*MockKVAPI)(nil).Set), varargs...)
}
