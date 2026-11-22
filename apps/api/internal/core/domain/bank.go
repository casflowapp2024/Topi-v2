package domain

import (
	"sort"
	"strings"
	"time"
)

type Bank struct {
	ID     uint64  `json:"id"`
	UserID string  `json:"user_id"`
	Name   string  `json:"name"`
	Email  *string `json:"email"`
	// CatalogID links the bank to the catalog (plan/33): it reads with the catalog senders plus Email
	CatalogID *uint64   `json:"catalog_id"`
	Color     *string   `json:"color"`
	LogoURL   *string   `json:"logo_url"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type OfficialBanks struct {
	Banks   []string            `json:"banks"`
	Catalog []PublicCatalogBank `json:"catalog"`
}

func IsSameBank(actual, expected *Bank) bool {
	sameName := actual.Name == expected.Name
	sameEmail := actual.Email == expected.Email
	sameUserID := actual.UserID == expected.UserID
	return sameName && sameEmail && sameUserID
}

func (b *Bank) ValidBankEmail() bool {
	return b.Email != nil && *b.Email != ""
}

// SetOfficialBank links the bank to the catalog bank with its name. On create (copySenders) the senders of the
// catalog are copied to Email as before, so a front that shows them keeps working; the reading uses the catalog.
func (b *Bank) SetOfficialBank(copySenders bool) {
	cb, ok := FindCatalogBank(b.Name)
	if !ok {
		b.CatalogID = nil
		return
	}
	id := cb.ID
	b.CatalogID = &id
	if copySenders {
		senders := strings.Join(cb.ActiveSenders(), ",")
		b.Email = &senders
	}
}

// NewOfficialBanks lists the active catalog banks (names for the old front, banks with logo for the new one)
func NewOfficialBanks(catalog []CatalogBank) OfficialBanks {
	out := OfficialBanks{Banks: []string{}, Catalog: []PublicCatalogBank{}}
	for _, b := range catalog {
		if !b.Active {
			continue
		}
		out.Catalog = append(out.Catalog, PublicCatalogBank{ID: b.ID, Slug: b.Slug, Name: b.Name, Color: b.Color, LogoURL: b.LogoPath()})
	}
	// stable order: the front preselects the first one
	sort.Slice(out.Catalog, func(i, j int) bool { return out.Catalog[i].Name < out.Catalog[j].Name })
	for _, b := range out.Catalog {
		out.Banks = append(out.Banks, b.Name)
	}
	return out
}
