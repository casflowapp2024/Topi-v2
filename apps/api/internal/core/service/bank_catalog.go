package service

import (
	"cash-flow/internal/core/domain"
	"cash-flow/internal/core/port"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"log/slog"
	"strings"
	"time"
)

// BankCatalogService (plan/33): the catalog of banks and senders. After every write and every ReloadEvery it
// refreshes the snapshot the reading rules use (domain.SetBankCatalog), so other replicas catch up too.
type BankCatalogService struct {
	repo port.BankCatalogRepository
}

// ReloadEvery: how often each replica re-reads the catalog
const ReloadEvery = 5 * time.Minute

func NewBankCatalogService(repo port.BankCatalogRepository) *BankCatalogService {
	return &BankCatalogService{repo: repo}
}

func (s *BankCatalogService) Reload(ctx context.Context) error {
	banks, err := s.repo.List(ctx)
	if err != nil {
		return err
	}
	domain.SetBankCatalog(banks)
	return nil
}

// Start loads the catalog and keeps it fresh until ctx ends. A failed load keeps the previous snapshot.
func (s *BankCatalogService) Start(ctx context.Context) {
	if err := s.Reload(ctx); err != nil {
		slog.Error("bank catalog: first load failed, using the seed", "error", err)
	}
	go func() {
		ticker := time.NewTicker(ReloadEvery)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				if err := s.Reload(ctx); err != nil {
					slog.Warn("bank catalog: reload failed", "error", err)
				}
			}
		}
	}()
}

func (s *BankCatalogService) reloadAfterWrite(ctx context.Context) {
	if err := s.Reload(ctx); err != nil {
		slog.Warn("bank catalog: reload after write failed", "error", err)
	}
}

func (s *BankCatalogService) AdminList(ctx context.Context) ([]domain.AdminCatalogBank, error) {
	return s.repo.AdminBanks(ctx)
}

func (s *BankCatalogService) Create(ctx context.Context, in domain.CatalogBankInput) (*domain.CatalogBank, error) {
	if err := in.Normalize(); err != nil {
		return nil, err
	}
	bank, err := s.repo.Create(ctx, in)
	if err != nil {
		return nil, err
	}
	s.link(ctx, bank.ID)
	s.reloadAfterWrite(ctx)
	return bank, nil
}

func (s *BankCatalogService) Update(ctx context.Context, id uint64, in domain.CatalogBankInput) error {
	if err := in.Normalize(); err != nil {
		return err
	}
	if err := s.repo.Update(ctx, id, in); err != nil {
		return err
	}
	s.link(ctx, id)
	s.reloadAfterWrite(ctx)
	return nil
}

func (s *BankCatalogService) SetActive(ctx context.Context, id uint64, active bool) error {
	if err := s.repo.SetActive(ctx, id, active); err != nil {
		return err
	}
	s.reloadAfterWrite(ctx)
	return nil
}

// AddSender adds an address to the bank (also the "Agregar al catálogo" of a user sender). The user banks with
// the name of the catalog bank get linked, so they read with it from the next job.
func (s *BankCatalogService) AddSender(ctx context.Context, bankID uint64, email string, note *string) (*domain.CatalogSender, error) {
	normalized, err := domain.NormalizeSenderEmail(email)
	if err != nil {
		return nil, err
	}
	sender, err := s.repo.AddSender(ctx, bankID, normalized, cleanNote(note))
	if err != nil {
		return nil, err
	}
	s.link(ctx, bankID)
	s.reloadAfterWrite(ctx)
	return sender, nil
}

func (s *BankCatalogService) UpdateSender(ctx context.Context, bankID, senderID uint64, active bool, note *string) error {
	if err := s.repo.UpdateSender(ctx, bankID, senderID, active, cleanNote(note)); err != nil {
		return err
	}
	s.reloadAfterWrite(ctx)
	return nil
}

func (s *BankCatalogService) PutLogo(ctx context.Context, bankID uint64, data []byte) error {
	contentType, err := domain.DetectLogoType(data)
	if err != nil {
		return err
	}
	sum := sha256.Sum256(data)
	logo := domain.BankLogo{BankID: bankID, ContentType: contentType, Bytes: data, ETag: hex.EncodeToString(sum[:])}
	if err = s.repo.PutLogo(ctx, logo); err != nil {
		return err
	}
	s.reloadAfterWrite(ctx)
	return nil
}

func (s *BankCatalogService) GetLogo(ctx context.Context, bankID uint64) (*domain.BankLogo, error) {
	return s.repo.GetLogo(ctx, bankID)
}

func (s *BankCatalogService) DeleteLogo(ctx context.Context, bankID uint64) error {
	if err := s.repo.DeleteLogo(ctx, bankID); err != nil {
		return err
	}
	s.reloadAfterWrite(ctx)
	return nil
}

func (s *BankCatalogService) UserSenders(ctx context.Context) ([]domain.UserSender, error) {
	return s.repo.UserSenders(ctx)
}

func (s *BankCatalogService) link(ctx context.Context, bankID uint64) {
	n, err := s.repo.LinkUserBanks(ctx, bankID)
	if err != nil {
		slog.Warn("bank catalog: linking user banks failed", "bank_id", bankID, "error", err)
		return
	}
	if n > 0 {
		slog.Info("bank catalog: user banks linked", "bank_id", bankID, "banks", n)
	}
}

func cleanNote(note *string) *string {
	if note == nil {
		return nil
	}
	n := strings.TrimSpace(*note)
	if n == "" {
		return nil
	}
	if len([]rune(n)) > 200 {
		n = string([]rune(n)[:200])
	}
	return &n
}
