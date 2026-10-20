package repository

import (
	"cash-flow/internal/adapter/storage/postgres"
	"cash-flow/internal/core/domain"
	"cash-flow/internal/enums"
	"cash-flow/internal/mappers"
	"cash-flow/internal/utils"
	"context"
	"encoding/json"
	"time"

	sq "github.com/Masterminds/squirrel"
	"github.com/jackc/pgx/v5"
)

type AccountRepository struct {
	db *postgres.DB
}

func NewAccountRepository(db *postgres.DB) *AccountRepository {
	return &AccountRepository{
		db,
	}
}

func (ar *AccountRepository) CreateAccount(ctx context.Context, account *domain.Account) error {
	query := ar.db.QueryBuilder.Insert(enums.AccountTableName).
		Columns(
			"user_id",
			"bank_id",
			"type_id",
			"name",
			"last_four_digits",
			"initial_balance",
			"email_id",
		).
		Values(
			account.UserID,
			account.Bank.ID,
			account.Type.ID,
			account.Name,
			account.LastFourDigits,
			account.InitialBalance,
			account.Email.ID,
		).
		Suffix("RETURNING *")

	sql, args, err := query.ToSql()
	if err != nil {
		return err
	}

	err = ar.db.QueryRow(ctx, sql, args...).Scan(
		&account.ID,
		&account.UserID,
		&account.Bank.ID,
		&account.Type.ID,
		&account.Name,
		&account.LastFourDigits,
		&account.InitialBalance,
		&account.CreatedAt,
		&account.UpdatedAt,
		&account.Email.ID,
	)

	if err != nil {
		return mappers.MapPostgresErrorCode(err)
	}

	return nil
}

func (ar *AccountRepository) GetAccount(ctx context.Context, userID string, id uint64) (*domain.Account, error) {
	var account domain.Account

	query := ar.db.QueryBuilder.Select(
		"a.*",
		"b.name",
		"b.email",
		"at.name",
		"e.email",
		"e.access_token",
		"e.refresh_token",
		"e.active",
		"e.provider",
	).
		From(enums.AccountTableName + " a").
		LeftJoin(enums.BankTableName + " b ON a.bank_id = b.id AND a.user_id = b.user_id").
		LeftJoin(enums.AccountTypeTableName + " at ON a.type_id = at.id").
		LeftJoin(enums.EmailTableName + " e ON a.email_id = e.id and a.user_id = e.user_id").
		Where(sq.Eq{"a.id": id}).
		Where(sq.Eq{"a.user_id": userID}).
		Limit(1)

	sql, args, err := query.ToSql()
	if err != nil {
		return nil, err
	}

	var (
		email        *string
		accessToken  *string
		refreshToken *string
		active       *bool
		provider     *string
	)

	err = ar.db.QueryRow(ctx, sql, args...).Scan(
		&account.ID,
		&account.UserID,
		&account.Bank.ID,
		&account.Type.ID,
		&account.Name,
		&account.LastFourDigits,
		&account.InitialBalance,
		&account.CreatedAt,
		&account.UpdatedAt,
		&account.Email.ID,
		&account.Bank.Name,
		&account.Bank.Email,
		&account.Type.Name,
		&email,
		&accessToken,
		&refreshToken,
		&active,
		&provider,
	)

	updateEmail(&account, email, accessToken, refreshToken, active, provider)

	if err != nil {
		return nil, mappers.MapPostgresErrorCode(err)
	}

	return &account, nil
}

func (ar *AccountRepository) GetAccountsList(
	ctx context.Context,
	userID string,
	skip uint64,
	limit uint64,
	accountTypes []uint64,
) ([]domain.Account, error) {
	var accounts []domain.Account

	query := ar.db.QueryBuilder.Select(
		"a.*",
		"b.name",
		"b.email",
		"at.name",
		"e.email",
		"e.access_token",
		"e.refresh_token",
		"e.active",
		"e.provider",
	).
		From(enums.AccountTableName + " a").
		LeftJoin(enums.BankTableName + " b ON a.bank_id = b.id AND a.user_id = b.user_id").
		LeftJoin(enums.AccountTypeTableName + " at ON a.type_id = at.id").
		LeftJoin(enums.EmailTableName + " e ON a.email_id = e.id and a.user_id = e.user_id").
		Where(sq.Eq{"a.user_id": userID}).
		OrderBy("a.type_id, a.id").
		Limit(limit).
		Offset(skip)

	if accountTypes != nil {
		query = query.Where(sq.Eq{"type_id": accountTypes})
	}

	sql, args, err := query.ToSql()
	if err != nil {
		return nil, err
	}

	rows, err := ar.db.Query(ctx, sql, args...)
	if err != nil {
		return nil, mappers.MapPostgresErrorCode(err)
	}

	for rows.Next() {
		var (
			account      domain.Account
			email        *string
			accessToken  *string
			refreshToken *string
			active       *bool
			provider     *string
		)

		err = rows.Scan(
			&account.ID,
			&account.UserID,
			&account.Bank.ID,
			&account.Type.ID,
			&account.Name,
			&account.LastFourDigits,
			&account.InitialBalance,
			&account.CreatedAt,
			&account.UpdatedAt,
			&account.Email.ID,
			&account.Bank.Name,
			&account.Bank.Email,
			&account.Type.Name,
			&email,
			&accessToken,
			&refreshToken,
			&active,
			&provider,
		)

		if err != nil {
			return nil, mappers.MapPostgresErrorCode(err)
		}

		updateEmail(&account, email, accessToken, refreshToken, active, provider)

		accounts = append(accounts, account)
	}

	return accounts, nil
}

func (ar *AccountRepository) UpdateAccount(ctx context.Context, account *domain.Account) error {
	bankID := utils.NullUint64(account.Bank.ID)
	typeID := utils.NullUint64(account.Type.ID)
	emailID := utils.NullPointerUint64(account.Email.ID)
	name := utils.NullString(account.Name)
	lastFourDigits := utils.NullString(account.LastFourDigits)

	query := ar.db.QueryBuilder.Update(enums.AccountTableName).
		Set("bank_id", sq.Expr("COALESCE(?, bank_id)", bankID)).
		Set("type_id", sq.Expr("COALESCE(?, type_id)", typeID)).
		Set("email_id", emailID).
		Set("name", sq.Expr("COALESCE(?, name)", name)).
		Set("last_four_digits", sq.Expr("COALESCE(?, last_four_digits)", lastFourDigits)).
		Set("initial_balance", account.InitialBalance).
		Set("updated_at", time.Now()).
		Where(sq.Eq{"id": account.ID}).
		Where(sq.Eq{"user_id": account.UserID}).
		Suffix("RETURNING *")

	sql, args, err := query.ToSql()
	if err != nil {
		return err
	}

	err = ar.db.QueryRow(ctx, sql, args...).Scan(
		&account.ID,
		&account.UserID,
		&account.Bank.ID,
		&account.Type.ID,
		&account.Name,
		&account.LastFourDigits,
		&account.InitialBalance,
		&account.CreatedAt,
		&account.UpdatedAt,
		&account.Email.ID,
	)

	if err != nil {
		return mappers.MapPostgresErrorCode(err)
	}

	return nil
}

func (ar *AccountRepository) DeleteAccount(ctx context.Context, userID string, id uint64) error {
	query := ar.db.QueryBuilder.Delete(enums.AccountTableName).
		Where(sq.Eq{"id": id}).
		Where(sq.Eq{"user_id": userID})

	sql, args, err := query.ToSql()
	if err != nil {
		return err
	}

	_, err = ar.db.Exec(ctx, sql, args...)
	if err != nil {
		return mappers.MapPostgresErrorCode(err)
	}

	return nil
}

func (ar *AccountRepository) AdminGetAccountsList(
	ctx context.Context,
	filters domain.AccountFilters,
) ([]domain.Account, error) {
	var accounts []domain.Account

	total := ar.db.QueryBuilder.Select(
		"count(sa.id)",
	).From(enums.AccountTableName + " sa").
		LeftJoin(enums.BankTableName + " bs ON sa.bank_id = bs.id AND sa.user_id = bs.user_id").
		LeftJoin(enums.EmailTableName + " se ON sa.email_id = se.id and sa.user_id = se.user_id").
		Where(sq.NotEq{"bs.email": ""}).
		Where(sq.Expr("bs.email is not null")).
		Where(sq.Expr("sa.email_id is not null")).
		Where(sq.Expr("se.access_token is not null")).
		Where(sq.Expr("se.refresh_token is not null")).
		Where(sq.NotEq{"se.active": false}).
		Where(sq.Eq{"se.error": nil})

	totalSQL, _, err := total.ToSql()
	if err != nil {
		return accounts, err
	}

	query := ar.db.QueryBuilder.Select(
		"a.*",
		"b.name",
		"b.email",
		"t.name",
		"e.email",
		"e.access_token",
		"e.refresh_token",
		"e.active",
		"e.provider",
		"("+totalSQL+") as total",
	).
		From(enums.AccountTableName + " a").
		LeftJoin(enums.BankTableName + " b ON a.bank_id = b.id AND a.user_id = b.user_id").
		LeftJoin(enums.AccountTypeTableName + " t ON a.type_id = t.id").
		LeftJoin(enums.EmailTableName + " e ON a.email_id = e.id and a.user_id = e.user_id").
		Where(sq.NotEq{"b.email": ""}).
		Where(sq.Expr("b.email is not null")).
		Where(sq.Expr("a.email_id is not null")).
		Where(sq.Expr("e.access_token is not null")).
		Where(sq.Expr("e.refresh_token is not null")).
		Where(sq.NotEq{"e.active": false}).
		Where(sq.Eq{"e.error": nil}).
		OrderBy("user_id, id").
		Limit(filters.Limit).
		Offset(filters.Skip)

	if len(filters.IDs) > 0 {
		query = query.Where(sq.Eq{"a.id": filters.IDs})
	}

	sql, args, err := query.ToSql()
	if err != nil {
		return nil, err
	}

	rows, err := ar.db.Query(ctx, sql, args...)
	if err != nil {
		return nil, mappers.MapPostgresErrorCode(err)
	}

	for rows.Next() {
		var (
			account      domain.Account
			email        *string
			accessToken  *string
			refreshToken *string
			active       *bool
			provider     *string
		)

		err = rows.Scan(
			&account.ID,
			&account.UserID,
			&account.Bank.ID,
			&account.Type.ID,
			&account.Name,
			&account.LastFourDigits,
			&account.InitialBalance,
			&account.CreatedAt,
			&account.UpdatedAt,
			&account.Email.ID,
			&account.Bank.Name,
			&account.Bank.Email,
			&account.Type.Name,
			&email,
			&accessToken,
			&refreshToken,
			&active,
			&provider,
			&account.Total,
		)

		if err != nil {
			return nil, err
		}

		updateEmail(&account, email, accessToken, refreshToken, active, provider)

		splitAccounts := account.SplitByBankEmails()

		accounts = append(accounts, splitAccounts...)
	}

	if len(accounts) == 0 {
		return accounts, domain.ErrDataNotFound
	}

	return accounts, nil
}

func (ar *AccountRepository) AdminGetAccountsByBank(
	ctx context.Context,
	filters domain.AccountFilters,
) ([]domain.BankAccountGroup, error) {
	var groups []domain.BankAccountGroup

	// Main query with aggregation
	query := ar.db.QueryBuilder.Select(
		"a.user_id",
		"b.name AS bank_name",
		"e.id AS email_id",
		"e.email AS user_email",
		"e.provider AS user_provider",
		"b.email AS bank_email",
		"json_agg(json_build_object('id', a.id, 'name', a.name, 'last_four_digits', a.last_four_digits) ORDER BY a.id) AS accounts",
	).
		From(enums.AccountTableName+" a").
		LeftJoin(enums.BankTableName+" b ON a.bank_id = b.id AND a.user_id = b.user_id").
		LeftJoin(enums.EmailTableName+" e ON a.email_id = e.id AND a.user_id = e.user_id").
		Where(sq.NotEq{"b.email": ""}).
		Where(sq.Expr("b.email IS NOT NULL")).
		Where(sq.Expr("a.email_id IS NOT NULL")).
		Where(sq.Expr("e.access_token IS NOT NULL")).
		Where(sq.Expr("e.refresh_token IS NOT NULL")).
		Where(sq.NotEq{"e.active": false}).
		Where(sq.Eq{"e.error": nil}).
		GroupBy("a.user_id", "b.name", "e.id", "e.email", "e.provider", "e.active", "e.access_token", "e.refresh_token", "b.email").
		OrderBy("a.user_id", "b.name").
		Limit(filters.Limit).
		Offset(filters.Skip)

	if len(filters.IDs) > 0 {
		query = query.Where(sq.Eq{"a.id": filters.IDs})
	}

	sql, args, err := query.ToSql()
	if err != nil {
		return nil, err
	}

	rows, err := ar.db.Query(ctx, sql, args...)
	defer rows.Close()
	if err != nil {
		return nil, mappers.MapPostgresErrorCode(err)
	}

	for rows.Next() {
		var (
			group        domain.BankAccountGroup
			accountsJSON []byte
			bankEmail    *string
		)

		err = rows.Scan(
			&group.UserID,
			&group.BankName,
			&group.EmailID,
			&group.UserEmail,
			&group.UserProvider,
			&bankEmail,
			&accountsJSON,
		)
		if err != nil {
			return nil, err
		}

		// Split bank email by comma and trim whitespace
		group.SenderEmails = utils.SplitAndTrimEmails(bankEmail)

		// Parse accounts JSON
		var accounts []domain.AccountBasicInfo
		if err = json.Unmarshal(accountsJSON, &accounts); err != nil {
			return nil, err
		}
		group.Accounts = accounts

		groups = append(groups, group)
	}

	if len(groups) == 0 {
		return groups, domain.ErrDataNotFound
	}

	return groups, nil
}

// DisconnectEmail updates all accounts related to the specified email to set email_id to null
func (ar *AccountRepository) DisconnectEmail(ctx context.Context, tx pgx.Tx, userID string, emailID uint64) error {
	updateQuery := ar.db.QueryBuilder.Update(enums.AccountTableName).
		Set("email_id", nil).
		Where(sq.Eq{"user_id": userID}).
		Where(sq.Eq{"email_id": emailID})

	updateSQL, updateArgs, err := updateQuery.ToSql()
	if err != nil {
		return err
	}

	_, err = tx.Exec(ctx, updateSQL, updateArgs...)
	if err != nil {
		return mappers.MapPostgresErrorCode(err)
	}

	return nil
}

func updateEmail(account *domain.Account, email, access, refresh *string, active *bool, provider *string) {
	if email != nil {
		account.Email.Email = *email
	}

	// TODO: Delete token information
	if access != nil {
		account.Email.Token.Access = *access
	}

	if refresh != nil {
		account.Email.Token.Refresh = *refresh
	}

	if active != nil {
		account.Email.Active = *active
	}

	if provider != nil {
		account.Email.Provider = *provider
	}
}
