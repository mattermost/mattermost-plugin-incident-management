// Code generated by MockGen. DO NOT EDIT.
// Source: github.com/mattermost/mattermost-plugin-incident-collaboration/server/app (interfaces: KeywordsThreadIgnorer)

// Package mock_app is a generated GoMock package.
package mock_app

import (
	gomock "github.com/golang/mock/gomock"
	reflect "reflect"
)

// MockKeywordsThreadIgnorer is a mock of KeywordsThreadIgnorer interface
type MockKeywordsThreadIgnorer struct {
	ctrl     *gomock.Controller
	recorder *MockKeywordsThreadIgnorerMockRecorder
}

// MockKeywordsThreadIgnorerMockRecorder is the mock recorder for MockKeywordsThreadIgnorer
type MockKeywordsThreadIgnorerMockRecorder struct {
	mock *MockKeywordsThreadIgnorer
}

// NewMockKeywordsThreadIgnorer creates a new mock instance
func NewMockKeywordsThreadIgnorer(ctrl *gomock.Controller) *MockKeywordsThreadIgnorer {
	mock := &MockKeywordsThreadIgnorer{ctrl: ctrl}
	mock.recorder = &MockKeywordsThreadIgnorerMockRecorder{mock}
	return mock
}

// EXPECT returns an object that allows the caller to indicate expected use
func (m *MockKeywordsThreadIgnorer) EXPECT() *MockKeywordsThreadIgnorerMockRecorder {
	return m.recorder
}

// Ignore mocks base method
func (m *MockKeywordsThreadIgnorer) Ignore(arg0, arg1 string) {
	m.ctrl.T.Helper()
	m.ctrl.Call(m, "Ignore", arg0, arg1)
}

// Ignore indicates an expected call of Ignore
func (mr *MockKeywordsThreadIgnorerMockRecorder) Ignore(arg0, arg1 interface{}) *gomock.Call {
	mr.mock.ctrl.T.Helper()
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "Ignore", reflect.TypeOf((*MockKeywordsThreadIgnorer)(nil).Ignore), arg0, arg1)
}

// IsIgnored mocks base method
func (m *MockKeywordsThreadIgnorer) IsIgnored(arg0, arg1 string) bool {
	m.ctrl.T.Helper()
	ret := m.ctrl.Call(m, "IsIgnored", arg0, arg1)
	ret0, _ := ret[0].(bool)
	return ret0
}

// IsIgnored indicates an expected call of IsIgnored
func (mr *MockKeywordsThreadIgnorerMockRecorder) IsIgnored(arg0, arg1 interface{}) *gomock.Call {
	mr.mock.ctrl.T.Helper()
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "IsIgnored", reflect.TypeOf((*MockKeywordsThreadIgnorer)(nil).IsIgnored), arg0, arg1)
}
