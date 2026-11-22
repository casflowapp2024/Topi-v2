package service

import (
	"cash-flow/internal/core/domain"
	"cash-flow/internal/core/port/mock"
	"context"
	"testing"

	"github.com/golang/mock/gomock"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestBankCatalogService_AddSenderNormalizesLinksAndReloads(t *testing.T) {
	ctrl := gomock.NewController(t)
	repo := mock.NewMockBankCatalogRepository(ctrl)
	svc := NewBankCatalogService(repo)
	t.Cleanup(func() { domain.SetBankCatalog(nil) })

	note := "  Bre-B  "
	repo.EXPECT().AddSender(gomock.Any(), uint64(2), "notificacionesbreb@bbva.com", gomock.Any()).
		DoAndReturn(func(_ context.Context, _ uint64, _ string, n *string) (*domain.CatalogSender, error) {
			require.NotNil(t, n)
			assert.Equal(t, "Bre-B", *n)
			return &domain.CatalogSender{ID: 1, BankID: 2, Email: "notificacionesbreb@bbva.com", Active: true}, nil
		})
	repo.EXPECT().LinkUserBanks(gomock.Any(), uint64(2)).Return(int64(3), nil)
	repo.EXPECT().List(gomock.Any()).Return([]domain.CatalogBank{{ID: 2, Name: "BBVA", Active: true,
		Senders: []domain.CatalogSender{{Email: "notificacionesbreb@bbva.com", Active: true}}}}, nil)

	_, err := svc.AddSender(context.Background(), 2, " NotificacionesBreB@bbva.com ", &note)
	require.NoError(t, err)
	assert.True(t, domain.IsOfficialSender("BBVA", "notificacionesbreb@bbva.com"), "the snapshot is fresh after the write")
	assert.False(t, domain.IsOfficialSender("BBVA", "bbva@bbvanet.com.co"), "the loaded catalog replaced the seed")
}

func TestBankCatalogService_RejectsBadInputWithoutWriting(t *testing.T) {
	ctrl := gomock.NewController(t)
	repo := mock.NewMockBankCatalogRepository(ctrl)
	svc := NewBankCatalogService(repo)

	_, err := svc.AddSender(context.Background(), 2, "a@b.co,c@d.co", nil)
	assert.ErrorIs(t, err, domain.ErrInvalidSenderEmail)
	_, err = svc.Create(context.Background(), domain.CatalogBankInput{Name: " "})
	assert.ErrorIs(t, err, domain.ErrInvalidCatalogBank)
	assert.ErrorIs(t, svc.PutLogo(context.Background(), 2, []byte("GIF89a")), domain.ErrInvalidBankLogo)
}

func TestBankCatalogService_PutLogoStoresTypeAndEtag(t *testing.T) {
	ctrl := gomock.NewController(t)
	repo := mock.NewMockBankCatalogRepository(ctrl)
	svc := NewBankCatalogService(repo)
	t.Cleanup(func() { domain.SetBankCatalog(nil) })

	repo.EXPECT().PutLogo(gomock.Any(), gomock.Any()).DoAndReturn(func(_ context.Context, logo domain.BankLogo) error {
		assert.Equal(t, "image/png", logo.ContentType)
		assert.Len(t, logo.ETag, 64)
		return nil
	})
	repo.EXPECT().List(gomock.Any()).Return([]domain.CatalogBank{}, nil)
	require.NoError(t, svc.PutLogo(context.Background(), 2, []byte("\x89PNG\r\n\x1a\nDATA")))
}
