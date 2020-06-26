package pluginkvstore

import (
	"github.com/pkg/errors"

	"github.com/mattermost/mattermost-plugin-incident-response/server/playbook"
	"github.com/mattermost/mattermost-server/v5/model"
)

const (
	// PlaybookKey is the key for individual playbooks. Only exported for testing.
	PlaybookKey = keyVersionPrefix + "playbook_"
	// IndexKey is the key for the playbook index. Only exported for testing.
	IndexKey = keyVersionPrefix + "playbookindex"
)

// PlaybookStore is a kvs store for playbooks. DO NO USE DIRECTLY Use NewPlaybookStore
type PlaybookStore struct {
	kvAPI KVAPI
}

// NewPlaybookStore returns a new playbook store.
func NewPlaybookStore(kvAPI KVAPI) *PlaybookStore {
	return &PlaybookStore{
		kvAPI: kvAPI,
	}
}

// Ensure playbookStore implments the playbook.Store interface.
var _ playbook.Store = (*PlaybookStore)(nil)

type playbookIndex struct {
	PlaybookIDs []string `json:"playbook_ids"`
}

func (i *playbookIndex) clone() playbookIndex {
	newIndex := *i
	newIndex.PlaybookIDs = append([]string(nil), i.PlaybookIDs...)
	return newIndex
}

func (p *PlaybookStore) getIndex() (playbookIndex, error) {
	var index playbookIndex
	if err := p.kvAPI.Get(IndexKey, &index); err != nil {
		return index, errors.Wrap(err, "unable to get playbook index")
	}

	return index, nil
}

func (p *PlaybookStore) addToIndex(playbookID string) error {
	index, err := p.getIndex()
	if err != nil {
		return err
	}

	newIndex := index.clone()
	newIndex.PlaybookIDs = append(newIndex.PlaybookIDs, playbookID)

	// Set atomic doesn't seeem to work properly.
	saved, err := p.kvAPI.Set(IndexKey, &newIndex)
	if err != nil {
		return errors.Wrapf(err, "unable to add playbook to index")
	} else if !saved {
		return errors.New("unable add playbook to index KV Set didn't save")
	}

	return nil
}

func (p *PlaybookStore) removeFromIndex(playbookid string) error {
	index, err := p.getIndex()
	if err != nil {
		return err
	}

	newIndex := index.clone()
	for i := range newIndex.PlaybookIDs {
		if newIndex.PlaybookIDs[i] == playbookid {
			newIndex.PlaybookIDs = append(newIndex.PlaybookIDs[:i], newIndex.PlaybookIDs[i+1:]...)
			break
		}
	}

	// Set atomic doesn't seeem to work properly.
	saved, err := p.kvAPI.Set(IndexKey, &newIndex)
	if err != nil {
		return errors.Wrapf(err, "unable to add playbook to index")
	} else if !saved {
		return errors.New("unable add playbook to index KV Set didn't save")
	}

	return nil
}

// Create creates a new playbook
func (p *PlaybookStore) Create(pbook playbook.Playbook) (string, error) {
	pbook.ID = model.NewId()

	saved, err := p.kvAPI.Set(PlaybookKey+pbook.ID, &pbook)
	if err != nil {
		return "", errors.Wrapf(err, "unable to save playbook to KV store")
	} else if !saved {
		return "", errors.New("unable to save playbook to KV store, KV Set didn't save")
	}

	err = p.addToIndex(pbook.ID)
	if err != nil {
		return "", err
	}

	return pbook.ID, nil
}

// Get retrieves a playbook
func (p *PlaybookStore) Get(id string) (playbook.Playbook, error) {
	var out playbook.Playbook

	if id == "" {
		return out, errors.New("ID cannot be empty")
	}

	err := p.kvAPI.Get(PlaybookKey+id, &out)
	if err != nil {
		return out, err
	}

	if out.ID != id {
		return out, playbook.ErrNotFound
	}

	return out, nil
}

// GetPlaybooks retrieves all playbooks.
//
// All playbooks are indexed in a dedicated key value and used to enumerate the existing playbooks.
func (p *PlaybookStore) GetPlaybooks() ([]playbook.Playbook, error) {
	index, err := p.getIndex()
	if err != nil {
		return nil, err
	}

	playbooks := make([]playbook.Playbook, 0, len(index.PlaybookIDs))
	for _, playbookID := range index.PlaybookIDs {
		// Ignoring error here for now. If a playbook is deleted after this function retrieves the index,
		// and error could be generated here that can be ignored. Other errors are unhelpful to the user.
		gotPlaybook, _ := p.Get(playbookID)
		playbooks = append(playbooks, gotPlaybook)
	}

	return playbooks, nil
}

// Update updates a playbook
func (p *PlaybookStore) Update(updated playbook.Playbook) error {
	if updated.ID == "" {
		return errors.New("updating playbook without ID")
	}

	saved, err := p.kvAPI.Set(PlaybookKey+updated.ID, &updated)
	if err != nil {
		return errors.Wrapf(err, "unable to update playbook in KV store")
	} else if !saved {
		return errors.New("unable to update playbook in KV store, KV Set didn't save")
	}

	return nil
}

// Delete deletes a playbook
func (p *PlaybookStore) Delete(id string) error {
	if err := p.removeFromIndex(id); err != nil {
		return err
	}

	if _, err := p.kvAPI.Set(PlaybookKey+id, nil); err != nil {
		return err
	}

	return nil
}
