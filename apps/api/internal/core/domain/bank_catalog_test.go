package domain

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// withCatalog swaps the snapshot for one test
func withCatalog(t *testing.T, banks []CatalogBank) {
	t.Helper()
	previous := catalogSnapshot.Load()
	SetBankCatalog(banks)
	t.Cleanup(func() { catalogSnapshot.Store(previous) })
}

func TestCatalogSnapshot_DrivesReadingRules(t *testing.T) {
	withCatalog(t, []CatalogBank{
		{ID: 1, Name: "Nequi", Active: true, Senders: []CatalogSender{
			{Email: "nequi@nequi.com.co", Active: true}, {Email: "viejo@nequi.com.co", Active: false}}},
		{ID: 2, Name: "Banco Viejo", Active: false, Senders: []CatalogSender{{Email: "a@viejo.co", Active: true}}},
	})

	assert.True(t, IsSupportedBank(" nequi "))
	assert.True(t, IsSupportedBank("Banco Viejo"), "an inactive bank still reads")
	assert.False(t, IsSupportedBank("Bancolombia"), "the seed is replaced by the loaded catalog")
	assert.Equal(t, []string{"Nequi"}, SupportedBanks(), "only active banks can be picked")

	assert.True(t, IsOfficialSender("Nequi", "NEQUI@nequi.com.co"))
	assert.False(t, IsOfficialSender("Nequi", "viejo@nequi.com.co"), "an inactive sender is not official")
	assert.False(t, IsOfficialSender("Nequi", "nequi@nequi.com.co,otro@x.co"))
	assert.False(t, IsOfficialSender("Otro", "nequi@nequi.com.co"))
}

func TestCatalogBankInput_Normalize(t *testing.T) {
	in := CatalogBankInput{Name: "  Banco   de Bogotá ", Country: "co"}
	require.NoError(t, in.Normalize())
	assert.Equal(t, "Banco de Bogotá", in.Name)
	assert.Equal(t, "banco-de-bogota", in.Slug)
	assert.Equal(t, "CO", in.Country)

	blank := " "
	withBlankColor := CatalogBankInput{Name: "X", Color: &blank}
	require.NoError(t, withBlankColor.Normalize())
	assert.Nil(t, withBlankColor.Color)

	bad := "red"
	for _, in := range []CatalogBankInput{{Name: ""}, {Name: "X", Slug: "Con Espacio"}, {Name: "X", Country: "COL"}, {Name: "X", Color: &bad}} {
		assert.ErrorIs(t, in.Normalize(), ErrInvalidCatalogBank, in)
	}
}

func TestNormalizeSenderEmail(t *testing.T) {
	got, err := NormalizeSenderEmail("  BBVA@bbvanet.com.co ")
	require.NoError(t, err)
	assert.Equal(t, "bbva@bbvanet.com.co", got)
	for _, raw := range []string{"", "a@b", "a@b.co,c@d.co", "Banco <a@b.co>", "a b@c.co", "sin-arroba.co"} {
		_, err := NormalizeSenderEmail(raw)
		assert.ErrorIs(t, err, ErrInvalidSenderEmail, raw)
	}
}

func TestDetectLogoType(t *testing.T) {
	png := []byte("\x89PNG\r\n\x1a\n0000")
	webp := []byte("RIFF0000WEBPVP8 ")
	svg := []byte("\xef\xbb\xbf<?xml version=\"1.0\"?><svg xmlns=\"http://www.w3.org/2000/svg\"></svg>")
	for data, want := range map[string]string{string(png): "image/png", string(webp): "image/webp", string(svg): "image/svg+xml"} {
		got, err := DetectLogoType([]byte(data))
		require.NoError(t, err)
		assert.Equal(t, want, got)
	}
	for _, data := range [][]byte{nil, []byte("GIF89a"), []byte("<html><svg></svg></html>"), make([]byte, MaxBankLogoBytes+1)} {
		_, err := DetectLogoType(data)
		assert.ErrorIs(t, err, ErrInvalidBankLogo)
	}
}

func TestUserSender_ApplyPrivacy(t *testing.T) {
	few := UserSender{Email: "juan.perez@gmail.com", Users: 2}
	few.ApplyPrivacy("mi banco", 2)
	assert.Equal(t, "j***@gmail.com", few.Email)
	assert.True(t, few.Masked)
	assert.Nil(t, few.BankName, "a name with few users may be personal")

	many := UserSender{Email: "alertas@gmail.com", Users: MinGroupUsers}
	many.ApplyPrivacy("nequi", MinGroupUsers)
	assert.Equal(t, "alertas@gmail.com", many.Email)
	require.NotNil(t, many.BankName)
	assert.Equal(t, "nequi", *many.BankName)

	bank := UserSender{Email: "notificaciones@nequi.com.co", Users: 1}
	bank.ApplyPrivacy("", 0)
	assert.Equal(t, "notificaciones@nequi.com.co", bank.Email, "an institutional domain is shown with one user")
	assert.False(t, bank.Masked)
}

func TestSlugify(t *testing.T) {
	assert.Equal(t, "itau", Slugify("Itaú"))
	assert.Equal(t, "lulo-bank", Slugify(" Lulo  Bank! "))
}
