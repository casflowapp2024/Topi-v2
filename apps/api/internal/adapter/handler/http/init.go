package http

import (
	"cash-flow/internal/adapter/logger"
	"cash-flow/internal/core/domain"
	"cash-flow/internal/core/port"
	"cash-flow/internal/enums"
	"fmt"
	"time"

	"github.com/gin-gonic/gin"
)

type InitDevHandler struct {
	category    port.CategoryService
	bank        port.BankService
	accountType port.AccountTypeService
	account     port.AccountService
	transaction port.TransactionService
}

func NewDevHandler(
	category port.CategoryService,
	bank port.BankService,
	accountType port.AccountTypeService,
	account port.AccountService,
	transaction port.TransactionService,
) *InitDevHandler {
	return &InitDevHandler{
		category:    category,
		bank:        bank,
		accountType: accountType,
		account:     account,
		transaction: transaction,
	}
}

type InitData struct {
	Categories   bool `json:"categories"`
	Banks        bool `json:"banks"`
	AccountTypes bool `json:"account_types"`
	Accounts     bool `json:"accounts"`
	Transactions bool `json:"transactions"`
}

func (i *InitDevHandler) Init(ctx *gin.Context) {
	var req InitData

	userID, err := domain.GetAuthUserID(ctx, enums.AuthorizationPayloadKey)
	if err != nil {
		logger.Logger.Error("failed to get user id from context", "error", err)
		handleError(ctx, err)
		return
	}

	if err = ctx.ShouldBindJSON(&req); err != nil {
		logger.Logger.Error("failed to bind request", "error", err)
		validationError(ctx, err)
		return
	}

	if req.Banks {
		for _, bank := range defaultBanks(*userID) {
			err = i.bank.CreateBank(ctx, &bank)
			if err != nil {
				logger.Logger.Error("failed to create default banks", "error", err)
				handleError(ctx, err)
				return
			}
		}
	}

	if req.AccountTypes {
		for _, accountType := range defaultAccountTypes() {
			err = i.accountType.CreateAccountType(ctx, &accountType)
			if err != nil {
				logger.Logger.Error("failed to create default account types", "error", err)
				handleError(ctx, err)
				return
			}
		}
	}

	var categories = make([]uint64, 10)

	if req.Categories {
		for idx, category := range defaultCategories(*userID) {
			err = i.category.CreateCategory(ctx, &category)
			if err != nil {
				logger.Logger.Error("failed to create default categories", "error", err)
				handleError(ctx, err)
				return
			}
			categories[idx] = category.ID
		}
	}

	var accounts = make([]uint64, 4)

	if req.Accounts {
		for idx, account := range defaultAccounts(*userID) {
			err = i.account.CreateAccount(ctx, &account)
			if err != nil {
				logger.Logger.Error("failed to create default accounts", "error", err)
				handleError(ctx, err)
				return
			}
			accounts[idx] = account.ID
		}
	}

	if req.Transactions {
		transactions, err := defaultTransactions(*userID, categories, accounts)
		if err != nil {
			logger.Logger.Error("failed to create default transactions", "error", err)
			handleError(ctx, err)
			return
		}

		for _, transaction := range transactions {
			err = i.transaction.CreateTransaction(ctx, &transaction)
			if err != nil {
				logger.Logger.With("transaction", transaction).
					Error("failed to create default transactions", "error", err)
				handleError(ctx, err)
				return
			}
		}
	}

}

func defaultCategories(userID string) []domain.Category {
	return []domain.Category{
		{
			UserID: userID,
			Name:   "Servicios",
			Budget: 0,
			Emoji:  "1F4A1", // 💡
			Income: false,
		},
		{
			UserID: userID,
			Name:   "Alimentación",
			Budget: 0,
			Emoji:  "1F354", // 🍔
			Income: false,
		},
		{
			UserID: userID,
			Name:   "Transporte",
			Budget: 0,
			Emoji:  "1F697", // 🚗
			Income: false,
		},
		{
			UserID: userID,
			Name:   "Salud",
			Budget: 0,
			Emoji:  "1F3E5", // 🏥
			Income: false,
		},
		{
			UserID: userID,
			Name:   "Educación",
			Budget: 0,
			Emoji:  "1F4DA", // 📚
			Income: false,
		},
		{
			UserID: userID,
			Name:   "Entretenimiento",
			Budget: 0,
			Emoji:  "1F3AE", // 🎮
			Income: false,
		},
		{
			UserID: userID,
			Name:   "Salario",
			Budget: 0,
			Emoji:  "1F4B0", // 💰
			Income: true,    // This is an income category
		},
		{
			UserID: userID,
			Name:   "Renta",
			Budget: 0,
			Emoji:  "1F3E0", // 🏠
			Income: false,
		},
		{
			UserID: userID,
			Name:   "Subscripciones",
			Budget: 0,
			Emoji:  "1F4FA", // 📺
			Income: false,
		},
		{
			UserID: userID,
			Name:   "Otros",
			Budget: 0,
			Emoji:  "1F4E6", // 📦
			Income: false,
		},
	}
}

func defaultBanks(userID string) []domain.Bank {
	var banks = make([]domain.Bank, 4)

	banks[0] = domain.Bank{
		UserID: userID,
		Name:   "Bancolombia",
		Email:  func(s string) *string { return &s }("alertasynotificaciones@notificacionesbancolombia.com"),
	}

	banks[1] = domain.Bank{
		UserID: userID,
		Name:   "RappiPay",
		Email:  func(s string) *string { return &s }("rappi.nreply@rappi.com"),
	}

	banks[2] = domain.Bank{
		UserID: userID,
		Name:   "BBVA",
	}

	banks[3] = domain.Bank{
		UserID: userID,
		Name:   "Davivienda",
	}

	return banks
}

func defaultAccountTypes() []domain.AccountType {
	var accountTypes = make([]domain.AccountType, 4)

	accountTypes[0] = domain.AccountType{
		Name: "Cuenta Ahorros",
	}

	accountTypes[1] = domain.AccountType{
		Name: "Cuenta Corriente",
	}

	accountTypes[2] = domain.AccountType{
		Name: "Inversión",
	}

	accountTypes[3] = domain.AccountType{
		Name: "Tarjeta de Crédito",
	}

	return accountTypes
}

func defaultAccounts(userID string) []domain.Account {
	var accounts = make([]domain.Account, 4)

	accounts[0] = domain.Account{
		UserID:         userID,
		Name:           "Ahorros Bancolombia",
		LastFourDigits: "1111",
		Bank:           domain.Bank{ID: 1},
		Type:           domain.AccountType{ID: 1},
		InitialBalance: 20000,
	}

	accounts[1] = domain.Account{
		UserID:         userID,
		Name:           "Ahorros RappiPay",
		LastFourDigits: "3333",
		Bank:           domain.Bank{ID: 2},
		Type:           domain.AccountType{ID: 1},
		InitialBalance: 28000000,
	}

	accounts[2] = domain.Account{
		UserID:         userID,
		Name:           "Credito Bancolombia",
		LastFourDigits: "2222",
		Bank:           domain.Bank{ID: 1},
		Type:           domain.AccountType{ID: 4},
		InitialBalance: 0,
	}

	accounts[3] = domain.Account{
		UserID:         userID,
		Name:           "Credito RappiPay",
		LastFourDigits: "4444",
		Bank:           domain.Bank{ID: 2},
		Type:           domain.AccountType{ID: 4},
		InitialBalance: -1000000,
	}

	return accounts
}

func defaultTransactions(
	userID string,
	categories []uint64,
	accounts []uint64,
) ([]domain.Transaction, error) {
	var transactions []domain.Transaction

	if len(accounts) != 4 {
		return nil, fmt.Errorf("accounts must have 4 elements")
	}

	for i := 0; i < 30; i++ {

		categoryIdx := uint64(i%10 + 1) // Categories from 1 to 10
		if categoryIdx == 7 {           // Avoid Salary
			categoryIdx = 1
		}

		categoryID := categories[categoryIdx-1]

		accountIdx := uint64(i%4 + 1) // Accounts from 1 to 4
		if accountIdx < 0 || accountIdx > 4 {
			accountIdx = 1
		}

		accountID := accounts[accountIdx-1]

		transaction := domain.Transaction{
			UserID:      userID,
			Amount:      float64(100000 + i*10), // Example amount
			Date:        dates[i],
			Category:    domain.Category{ID: categoryID},
			Account:     domain.Account{ID: accountID},
			Expense:     true,
			Description: fmt.Sprintf("Default testing transaction %d", i),
		}
		transactions = append(transactions, transaction)
	}

	// Salary Income
	transactions = append(transactions, domain.Transaction{
		UserID:      userID,
		Amount:      10000000,
		Date:        time.Date(2025, 01, 1, 0, 0, 0, 0, time.UTC),
		Category:    domain.Category{ID: categories[6]}, // Salary
		Account:     domain.Account{ID: accounts[0]},    // Ahorros Bancolombia
		Expense:     false,
		Description: "Salary Income",
	})

	transactions = append(transactions, domain.Transaction{
		UserID:      userID,
		Amount:      10000000,
		Date:        time.Date(2025, 02, 1, 0, 0, 0, 0, time.UTC),
		Category:    domain.Category{ID: categories[6]}, // Salary
		Account:     domain.Account{ID: accounts[0]},    // Ahorros Bancolombia
		Expense:     false,
		Description: "Salary Income",
	})

	transactions = append(transactions, domain.Transaction{
		UserID:      userID,
		Amount:      10000000,
		Date:        time.Date(2025, 03, 1, 0, 0, 0, 0, time.UTC),
		Category:    domain.Category{ID: categories[6]}, // Salary
		Account:     domain.Account{ID: accounts[0]},    // Ahorros Bancolombia
		Expense:     false,
		Description: "Salary Income",
	})

	return transactions, nil
}

var dates = []time.Time{
	time.Date(2025, 4, 1, 1, 0, 0, 0, time.UTC),
	time.Date(2025, 4, 2, 2, 0, 0, 0, time.UTC),
	time.Date(2025, 4, 3, 3, 0, 0, 0, time.UTC),
	time.Date(2025, 4, 4, 4, 0, 0, 0, time.UTC),
	time.Date(2025, 4, 5, 5, 0, 0, 0, time.UTC),
	time.Date(2025, 4, 6, 6, 0, 0, 0, time.UTC),
	time.Date(2025, 4, 7, 7, 0, 0, 0, time.UTC),
	time.Date(2025, 4, 8, 8, 0, 0, 0, time.UTC),
	time.Date(2025, 4, 9, 9, 0, 0, 0, time.UTC),
	time.Date(2025, 4, 10, 10, 0, 0, 0, time.UTC),

	time.Date(2025, 5, 1, 1, 0, 0, 0, time.UTC),
	time.Date(2025, 5, 2, 2, 0, 0, 0, time.UTC),
	time.Date(2025, 5, 3, 3, 0, 0, 0, time.UTC),
	time.Date(2025, 5, 4, 4, 0, 0, 0, time.UTC),
	time.Date(2025, 5, 5, 5, 0, 0, 0, time.UTC),
	time.Date(2025, 5, 6, 6, 0, 0, 0, time.UTC),
	time.Date(2025, 5, 7, 7, 0, 0, 0, time.UTC),
	time.Date(2025, 5, 8, 8, 0, 0, 0, time.UTC),
	time.Date(2025, 5, 9, 9, 0, 0, 0, time.UTC),
	time.Date(2025, 5, 10, 10, 0, 0, 0, time.UTC),

	time.Date(2025, 6, 1, 1, 0, 0, 0, time.UTC),
	time.Date(2025, 6, 2, 2, 0, 0, 0, time.UTC),
	time.Date(2025, 6, 3, 3, 0, 0, 0, time.UTC),
	time.Date(2025, 6, 4, 4, 0, 0, 0, time.UTC),
	time.Date(2025, 6, 5, 5, 0, 0, 0, time.UTC),
	time.Date(2025, 6, 6, 6, 0, 0, 0, time.UTC),
	time.Date(2025, 6, 7, 7, 0, 0, 0, time.UTC),
	time.Date(2025, 6, 8, 8, 0, 0, 0, time.UTC),
	time.Date(2025, 6, 9, 9, 0, 0, 0, time.UTC),
	time.Date(2025, 6, 10, 10, 0, 0, 0, time.UTC),
}
