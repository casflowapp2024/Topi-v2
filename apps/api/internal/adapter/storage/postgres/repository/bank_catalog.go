package repository

import (
	"cash-flow/internal/adapter/storage/postgres"
	"cash-flow/internal/core/domain"
	"cash-flow/internal/mappers"
	"cash-flow/internal/utils"
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
)

// BankCatalogRepository implements port.BankCatalogRepository (plan/33)
type BankCatalogRepository struct {
	db *postgres.DB
}

func NewBankCatalogRepository(db *postgres.DB) *BankCatalogRepository {
	return &BankCatalogRepository{db: db}
}

// senderAddress: the address of processed_emails.sender ('Banco <a@b.co>' in Gmail, 'a@b.co' in Outlook)
const senderAddress = `lower(btrim(coalesce(substring(p.sender from '<([^>]+)>'), p.sender)))`

func (r *BankCatalogRepository) List(ctx context.Context) ([]domain.CatalogBank, error) {
	rows, err := r.db.Query(ctx, `SELECT c.id, c.slug, c.name, c.country, c.color, c.active, l.etag, c.created_at, c.updated_at
FROM bank_catalog c LEFT JOIN bank_logos l ON l.bank_id = c.id ORDER BY c.name`)
	if err != nil {
		return nil, mappers.MapPostgresErrorCode(err)
	}
	banks := []domain.CatalogBank{}
	index := map[uint64]int{}
	for rows.Next() {
		var b domain.CatalogBank
		if err = rows.Scan(&b.ID, &b.Slug, &b.Name, &b.Country, &b.Color, &b.Active, &b.LogoETag, &b.CreatedAt, &b.UpdatedAt); err != nil {
			rows.Close()
			return nil, err
		}
		b.Senders = []domain.CatalogSender{}
		index[b.ID] = len(banks)
		banks = append(banks, b)
	}
	rows.Close()
	if err = rows.Err(); err != nil {
		return nil, err
	}

	senders, err := r.db.Query(ctx, `SELECT id, bank_id, email, active, note, created_at FROM bank_catalog_senders ORDER BY bank_id, id`)
	if err != nil {
		return nil, mappers.MapPostgresErrorCode(err)
	}
	defer senders.Close()
	for senders.Next() {
		var s domain.CatalogSender
		if err = senders.Scan(&s.ID, &s.BankID, &s.Email, &s.Active, &s.Note, &s.CreatedAt); err != nil {
			return nil, err
		}
		if i, ok := index[s.BankID]; ok {
			banks[i].Senders = append(banks[i].Senders, s)
		}
	}
	return banks, senders.Err()
}

func (r *BankCatalogRepository) Create(ctx context.Context, in domain.CatalogBankInput) (*domain.CatalogBank, error) {
	b := domain.CatalogBank{Senders: []domain.CatalogSender{}}
	err := r.db.QueryRow(ctx, `INSERT INTO bank_catalog (slug, name, country, color) VALUES ($1, $2, $3, $4)
RETURNING id, slug, name, country, color, active, created_at, updated_at`, in.Slug, in.Name, in.Country, in.Color).
		Scan(&b.ID, &b.Slug, &b.Name, &b.Country, &b.Color, &b.Active, &b.CreatedAt, &b.UpdatedAt)
	if err != nil {
		return nil, mappers.MapPostgresErrorCode(err)
	}
	return &b, nil
}

func (r *BankCatalogRepository) Update(ctx context.Context, id uint64, in domain.CatalogBankInput) error {
	tag, err := r.db.Exec(ctx, `UPDATE bank_catalog SET slug = $2, name = $3, country = $4, color = $5, updated_at = now()
WHERE id = $1`, id, in.Slug, in.Name, in.Country, in.Color)
	if err != nil {
		return mappers.MapPostgresErrorCode(err)
	}
	if tag.RowsAffected() == 0 {
		return domain.ErrDataNotFound
	}
	return nil
}

func (r *BankCatalogRepository) SetActive(ctx context.Context, id uint64, active bool) error {
	tag, err := r.db.Exec(ctx, `UPDATE bank_catalog SET active = $2, updated_at = now() WHERE id = $1`, id, active)
	if err != nil {
		return mappers.MapPostgresErrorCode(err)
	}
	if tag.RowsAffected() == 0 {
		return domain.ErrDataNotFound
	}
	return nil
}

func (r *BankCatalogRepository) AddSender(ctx context.Context, bankID uint64, email string, note *string) (*domain.CatalogSender, error) {
	var s domain.CatalogSender
	err := r.db.QueryRow(ctx, `INSERT INTO bank_catalog_senders (bank_id, email, note) VALUES ($1, $2, $3)
ON CONFLICT (bank_id, email) DO UPDATE SET active = true, note = coalesce(EXCLUDED.note, bank_catalog_senders.note), updated_at = now()
RETURNING id, bank_id, email, active, note, created_at`, bankID, email, note).
		Scan(&s.ID, &s.BankID, &s.Email, &s.Active, &s.Note, &s.CreatedAt)
	if err != nil {
		return nil, mapCatalogError(err)
	}
	return &s, nil
}

func (r *BankCatalogRepository) UpdateSender(ctx context.Context, bankID, senderID uint64, active bool, note *string) error {
	tag, err := r.db.Exec(ctx, `UPDATE bank_catalog_senders SET active = $3, note = $4, updated_at = now()
WHERE id = $2 AND bank_id = $1`, bankID, senderID, active, note)
	if err != nil {
		return mappers.MapPostgresErrorCode(err)
	}
	if tag.RowsAffected() == 0 {
		return domain.ErrDataNotFound
	}
	return nil
}

func (r *BankCatalogRepository) LinkUserBanks(ctx context.Context, bankID uint64) (int64, error) {
	tag, err := r.db.Exec(ctx, `UPDATE banks b SET catalog_id = c.id, updated_at = now()
FROM bank_catalog c
WHERE c.id = $1 AND b.catalog_id IS NULL AND normalize_bank_name(b.name) = normalize_bank_name(c.name)`, bankID)
	if err != nil {
		return 0, mappers.MapPostgresErrorCode(err)
	}
	return tag.RowsAffected(), nil
}

func (r *BankCatalogRepository) PutLogo(ctx context.Context, logo domain.BankLogo) error {
	_, err := r.db.Exec(ctx, `INSERT INTO bank_logos (bank_id, content_type, bytes, etag) VALUES ($1, $2, $3, $4)
ON CONFLICT (bank_id) DO UPDATE SET content_type = EXCLUDED.content_type, bytes = EXCLUDED.bytes, etag = EXCLUDED.etag,
  updated_at = now()`, logo.BankID, logo.ContentType, logo.Bytes, logo.ETag)
	return mapCatalogError(err)
}

func (r *BankCatalogRepository) GetLogo(ctx context.Context, bankID uint64) (*domain.BankLogo, error) {
	logo := domain.BankLogo{BankID: bankID}
	err := r.db.QueryRow(ctx, `SELECT content_type, bytes, etag, updated_at FROM bank_logos WHERE bank_id = $1`, bankID).
		Scan(&logo.ContentType, &logo.Bytes, &logo.ETag, &logo.UpdatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, domain.ErrDataNotFound
	}
	if err != nil {
		return nil, mappers.MapPostgresErrorCode(err)
	}
	return &logo, nil
}

func (r *BankCatalogRepository) DeleteLogo(ctx context.Context, bankID uint64) error {
	_, err := r.db.Exec(ctx, `DELETE FROM bank_logos WHERE bank_id = $1`, bankID)
	return mappers.MapPostgresErrorCode(err)
}

// healthCTE: per sender address, what the worker read in the last 30 days
const healthCTE = `health AS (
  SELECT ` + senderAddress + ` AS email,
         count(*) AS read,
         count(*) FILTER (WHERE p.status = 'transaction') AS tx,
         count(*) FILTER (WHERE p.status = 'no_transaction') AS no_tx,
         count(*) FILTER (WHERE p.status = 'error') AS errors,
         max(coalesce(p.received_at, p.created_at)) AS last_at
  FROM processed_emails p
  WHERE p.created_at >= now() - interval '30 days'
  GROUP BY 1
)`

func (r *BankCatalogRepository) AdminBanks(ctx context.Context) ([]domain.AdminCatalogBank, error) {
	catalog, err := r.List(ctx)
	if err != nil {
		return nil, err
	}

	usage := map[uint64][2]int64{}
	rows, err := r.db.Query(ctx, `SELECT b.catalog_id, count(DISTINCT b.user_id),
  count(DISTINCT b.user_id) FILTER (WHERE EXISTS (
    SELECT 1 FROM accounts a JOIN emails e ON e.id = a.email_id AND e.user_id = a.user_id
    WHERE a.bank_id = b.id AND a.user_id = b.user_id AND e.active))
FROM banks b WHERE b.catalog_id IS NOT NULL GROUP BY b.catalog_id`)
	if err != nil {
		return nil, mappers.MapPostgresErrorCode(err)
	}
	for rows.Next() {
		var id uint64
		var users, connected int64
		if err = rows.Scan(&id, &users, &connected); err != nil {
			rows.Close()
			return nil, err
		}
		usage[id] = [2]int64{users, connected}
	}
	rows.Close()
	if err = rows.Err(); err != nil {
		return nil, err
	}

	health, err := r.health(ctx)
	if err != nil {
		return nil, err
	}

	out := make([]domain.AdminCatalogBank, 0, len(catalog))
	for _, b := range catalog {
		ab := domain.AdminCatalogBank{ID: b.ID, Slug: b.Slug, Name: b.Name, Country: b.Country, Color: b.Color,
			Active: b.Active, LogoURL: b.LogoPath(), Users: usage[b.ID][0], ConnectedUsers: usage[b.ID][1],
			Senders: make([]domain.AdminCatalogSender, 0, len(b.Senders)), UpdatedAt: b.UpdatedAt}
		for _, s := range b.Senders {
			ab.Senders = append(ab.Senders, domain.AdminCatalogSender{CatalogSender: s, Health: health[s.Email]})
		}
		out = append(out, ab)
	}
	return out, nil
}

func (r *BankCatalogRepository) health(ctx context.Context) (map[string]domain.SenderHealth, error) {
	rows, err := r.db.Query(ctx, `WITH `+healthCTE+` SELECT email, read, tx, no_tx, errors, last_at FROM health`)
	if err != nil {
		return nil, mappers.MapPostgresErrorCode(err)
	}
	defer rows.Close()
	out := map[string]domain.SenderHealth{}
	for rows.Next() {
		var email string
		var h domain.SenderHealth
		if err = rows.Scan(&email, &h.Read, &h.Transactions, &h.NoTransaction, &h.Errors, &h.LastEmailAt); err != nil {
			return nil, err
		}
		out[email] = h
	}
	return out, rows.Err()
}

// UserSenders: the addresses of banks.email that are not a sender of the catalog bank of that row (every
// address of a bank without catalog). Grouped by address; never says which user typed it.
func (r *BankCatalogRepository) UserSenders(ctx context.Context) ([]domain.UserSender, error) {
	rows, err := r.db.Query(ctx, `WITH typed AS (
  SELECT DISTINCT b.user_id, b.id AS bank_id, b.name, b.catalog_id, lower(btrim(x)) AS email
  FROM banks b CROSS JOIN LATERAL unnest(string_to_array(coalesce(b.email, ''), ',')) AS x
  WHERE btrim(x) LIKE '%@%'
), extra AS (
  SELECT t.* FROM typed t
  WHERE t.catalog_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM bank_catalog_senders s WHERE s.bank_id = t.catalog_id AND s.email = t.email)
), names AS (
  SELECT email, normalize_bank_name(name) AS name, count(DISTINCT user_id) AS users,
         row_number() OVER (PARTITION BY email ORDER BY count(DISTINCT user_id) DESC, normalize_bank_name(name)) AS rn
  FROM extra GROUP BY email, normalize_bank_name(name)
), catalogs AS (
  SELECT e.email, c.name, row_number() OVER (PARTITION BY e.email ORDER BY count(*) DESC, c.name) AS rn
  FROM extra e JOIN bank_catalog c ON c.id = e.catalog_id GROUP BY e.email, c.name
), `+healthCTE+`
SELECT e.email, count(DISTINCT e.user_id),
  (SELECT count(*) FROM accounts a JOIN extra x ON x.bank_id = a.bank_id AND x.user_id = a.user_id WHERE x.email = e.email),
  coalesce(n.name, ''), coalesce(n.users, 0), cat.name,
  (SELECT string_agg(DISTINCT c.name, ', ') FROM bank_catalog_senders s JOIN bank_catalog c ON c.id = s.bank_id
     WHERE s.email = e.email),
  coalesce(h.read, 0), coalesce(h.tx, 0), coalesce(h.no_tx, 0), coalesce(h.errors, 0), h.last_at
FROM extra e
LEFT JOIN names n ON n.email = e.email AND n.rn = 1
LEFT JOIN catalogs cat ON cat.email = e.email AND cat.rn = 1
LEFT JOIN health h ON h.email = e.email
GROUP BY e.email, n.name, n.users, cat.name, h.read, h.tx, h.no_tx, h.errors, h.last_at
ORDER BY count(DISTINCT e.user_id) DESC, e.email
LIMIT 500`)
	if err != nil {
		return nil, mappers.MapPostgresErrorCode(err)
	}
	defer rows.Close()
	out := []domain.UserSender{}
	for rows.Next() {
		var u domain.UserSender
		var topName string
		var topUsers int64
		if err = rows.Scan(&u.Email, &u.Users, &u.Accounts, &topName, &topUsers, &u.CatalogBank, &u.InCatalogAs,
			&u.Read, &u.Transactions, &u.NoTransaction, &u.Errors, &u.LastEmailAt); err != nil {
			return nil, err
		}
		u.ApplyPrivacy(topName, topUsers)
		out = append(out, u)
	}
	return out, rows.Err()
}

// mapCatalogError: a missing bank (foreign key) is not found; the rest as usual
func mapCatalogError(err error) error {
	if err == nil {
		return nil
	}
	if utils.ParsePgError(err) == "23503" {
		return domain.ErrDataNotFound
	}
	return mappers.MapPostgresErrorCode(err)
}
