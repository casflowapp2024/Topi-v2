package domain

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNewOfficialBanks_SortedByNameAndOnlyActive(t *testing.T) {
	etag := "0123456789abcdef"
	catalog := []CatalogBank{
		{ID: 1, Name: "Nubank", Active: true}, {ID: 2, Name: "BBVA", Active: true}, {ID: 3, Name: "Lulo Bank", Active: true},
		{ID: 4, Name: "Bancolombia", Active: true, LogoETag: &etag}, {ID: 5, Name: "AirTm", Active: true},
		{ID: 6, Name: "Cerrado", Active: false},
	}
	got := NewOfficialBanks(catalog)
	assert.Equal(t, []string{"AirTm", "BBVA", "Bancolombia", "Lulo Bank", "Nubank"}, got.Banks)
	require.Len(t, got.Catalog, 5)
	assert.Equal(t, "Bancolombia", got.Catalog[2].Name)
	require.NotNil(t, got.Catalog[2].LogoURL)
	assert.Equal(t, "/banks/catalog/4/logo?v=0123456789ab", *got.Catalog[2].LogoURL)
	assert.Nil(t, got.Catalog[0].LogoURL)
}

func TestBank_SetOfficialBank(t *testing.T) {
	b := Bank{Name: "  bancolombia "}
	b.SetOfficialBank(true)
	require.NotNil(t, b.CatalogID)
	require.NotNil(t, b.Email)
	assert.Contains(t, *b.Email, "alertasynotificaciones@bancolombia.com.co")

	typed := "otro@banco.co"
	custom := Bank{Name: "Banco Propio", Email: &typed}
	custom.SetOfficialBank(true)
	assert.Nil(t, custom.CatalogID)
	assert.Equal(t, "otro@banco.co", *custom.Email, "a custom bank keeps what the user typed")

	// rename: links without touching the senders
	renamed := Bank{Name: "Nubank", Email: &typed}
	renamed.SetOfficialBank(false)
	require.NotNil(t, renamed.CatalogID)
	assert.Equal(t, "otro@banco.co", *renamed.Email)
}
