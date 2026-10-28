package service

import (
	"cash-flow/internal/core/domain"
	"cash-flow/internal/core/port/mock"
	"context"
	"testing"
	"time"

	"github.com/golang/mock/gomock"
	"github.com/shopspring/decimal"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestAccountService_Currency(t *testing.T) {
	ctx := context.Background()
	stored := func(currency string, hasTransactions bool) *domain.Account {
		return &domain.Account{ID: 7, UserID: "u1", Name: "Ahorros", LastFourDigits: "1234",
			Currency: currency, HasTransactions: hasTransactions,
			Bank: domain.Bank{ID: 1}, Type: domain.AccountType{ID: 1}}
	}
	update := func(currency string) *domain.Account {
		a := stored(currency, false)
		a.HasTransactions = false
		return a
	}

	tests := []struct {
		name      string
		current   *domain.Account
		request   *domain.Account
		repoCalls int
		wantErr   error
	}{
		{"cambia la moneda sin movimientos", stored("COP", false), update("USD"), 1, nil},
		{"no cambia la moneda con movimientos", stored("COP", true), update("USD"), 0, domain.ErrAccountCurrencyLocked},
		{"misma moneda con movimientos y otro nombre", stored("USD", true),
			func() *domain.Account { a := update("USD"); a.Name = "Otro"; return a }(), 1, nil},
		{"sin moneda en la petición no la toca", stored("USD", true),
			func() *domain.Account { a := update(""); a.Name = "Otro"; return a }(), 1, nil},
		{"código inválido", stored("COP", false), update("usd"), 0, domain.ErrInvalidCurrency},
		{"solo la moneda igual: nada que actualizar", stored("COP", true), update("COP"), 0, domain.ErrNoUpdatedData},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			ctrl := gomock.NewController(t)
			repo := mock.NewMockAccountRepository(ctrl)
			svc := NewAccountService(repo, mock.NewMockTransactionRepository(ctrl))
			repo.EXPECT().GetAccount(ctx, "u1", uint64(7)).Return(tc.current, nil).AnyTimes()
			repo.EXPECT().UpdateAccount(ctx, gomock.Any()).Return(nil).Times(tc.repoCalls)

			assert.ErrorIs(t, svc.UpdateAccount(ctx, tc.request), tc.wantErr)
		})
	}

	t.Run("crear con código inválido no llega al repositorio", func(t *testing.T) {
		ctrl := gomock.NewController(t)
		repo := mock.NewMockAccountRepository(ctrl)
		svc := NewAccountService(repo, mock.NewMockTransactionRepository(ctrl))
		a := update("DOLAR")
		a.ID = 0
		assert.ErrorIs(t, svc.CreateAccount(ctx, a), domain.ErrInvalidCurrency)
	})
}

func TestTransactionService_CreateTransfer(t *testing.T) {
	ctx := context.Background()
	d := decimal.RequireFromString
	valid := func() *domain.Transfer {
		return &domain.Transfer{UserID: "u1", FromAccountID: 1, ToAccountID: 2,
			AmountSent: d("100"), AmountReceived: d("387041"), Date: time.Now(), CategoryID: 10}
	}

	t.Run("válida: descripción por defecto y al repositorio", func(t *testing.T) {
		ctrl := gomock.NewController(t)
		repo := mock.NewMockTransactionRepository(ctrl)
		svc := NewTransactionService(repo, mock.NewMockUserService(ctrl), mock.NewMockCategoryService(ctrl))
		transfer := valid()
		repo.EXPECT().CreateTransfer(ctx, transfer).Return(nil)

		require.NoError(t, svc.CreateTransfer(ctx, transfer))
		assert.Equal(t, "Transferencia", transfer.Description)
		assert.Equal(t, "3870.41", transfer.EffectiveRate().String())
	})

	for name, mutate := range map[string]func(*domain.Transfer){
		"misma cuenta":       func(tr *domain.Transfer) { tr.ToAccountID = tr.FromAccountID },
		"sin cuenta destino": func(tr *domain.Transfer) { tr.ToAccountID = 0 },
		"monto enviado cero": func(tr *domain.Transfer) { tr.AmountSent = decimal.Zero },
		"monto recibido negativo": func(tr *domain.Transfer) {
			tr.AmountReceived = d("-1")
		},
	} {
		t.Run(name, func(t *testing.T) {
			ctrl := gomock.NewController(t)
			repo := mock.NewMockTransactionRepository(ctrl)
			svc := NewTransactionService(repo, mock.NewMockUserService(ctrl), mock.NewMockCategoryService(ctrl))
			transfer := valid()
			mutate(transfer)
			assert.ErrorIs(t, svc.CreateTransfer(ctx, transfer), domain.ErrInvalidTransfer)
		})
	}
}

func TestTransactionService_UpdateFxRate(t *testing.T) {
	ctx := context.Background()
	current := &domain.Transaction{ID: 5, UserID: "u1", Amount: 10, Description: "x",
		FxRate: ptrDec(decimal.RequireFromString("4000"))}

	tests := []struct {
		name      string
		rate      string
		repoCalls int
		wantErr   error
	}{
		{"tasa manual nueva", "3900.5", 1, nil},
		{"misma tasa: nada que actualizar", "4000", 0, domain.ErrNoUpdatedData},
		{"tasa cero", "0", 0, domain.ErrInvalidFxRate},
		{"tasa negativa", "-1", 0, domain.ErrInvalidFxRate},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			ctrl := gomock.NewController(t)
			repo := mock.NewMockTransactionRepository(ctrl)
			svc := NewTransactionService(repo, mock.NewMockUserService(ctrl), mock.NewMockCategoryService(ctrl))
			repo.EXPECT().GetTransactionByID(ctx, "u1", uint64(5)).Return(current, nil)
			repo.EXPECT().UpdateTransaction(ctx, gomock.Any()).Return(nil).Times(tc.repoCalls)

			request := *current
			request.FxRate = ptrDec(decimal.RequireFromString(tc.rate))
			assert.ErrorIs(t, svc.UpdateTransaction(ctx, &request), tc.wantErr)
		})
	}
}

func TestFxService_GetQuote(t *testing.T) {
	ctx := context.Background()
	ctrl := gomock.NewController(t)
	repo := mock.NewMockFxRepository(ctrl)
	svc := NewFxService(repo)
	today := time.Date(2026, 10, 28, 9, 0, 0, 0, time.UTC)
	svc.now = func() time.Time { return today }

	repo.EXPECT().GetQuote(ctx, "USD", "COP", today).Return(domain.FxQuote{From: "USD", To: "COP"}, nil)
	_, err := svc.GetQuote(ctx, "usd", "cop", time.Time{})
	require.NoError(t, err, "códigos en minúscula y fecha vacía = hoy")

	_, err = svc.GetQuote(ctx, "US", "COP", today)
	assert.ErrorIs(t, err, domain.ErrInvalidCurrency)
}

func TestNetWorth_Summarize(t *testing.T) {
	d := func(s string) *decimal.Decimal { v := decimal.RequireFromString(s); return &v }
	n := domain.NetWorth{Accounts: []domain.NetWorthAccount{
		{Currency: "COP", BaseValue: d("1000000"), UnrealizedGain: d("0")},
		{Currency: "USD", BaseValue: d("410000"), UnrealizedGain: d("10000")},
		{Currency: "EUR", BaseValue: nil, UnrealizedGain: nil},
		{Currency: "USD", BaseValue: d("-41000"), UnrealizedGain: d("-1000")}, // tarjeta
		// fondo en USD: 2 US$ de ganancia de mercado a 4100 = 8200; el resto (1800) es cambiaria
		{Currency: "USD", BaseValue: d("410000"), UnrealizedGain: d("10000"), MarketGain: d("2"), Rate: d("4100")},
	}}
	n.Summarize()
	assert.Equal(t, "1779000", n.Total.String())
	assert.Equal(t, "19000", n.UnrealizedGain.String())
	assert.Equal(t, "8200", n.MarketGain.String())
	assert.Equal(t, "10800", n.FxGain.String())
	assert.True(t, n.MissingRates)
}

func ptrDec(d decimal.Decimal) *decimal.Decimal { return &d }

func TestTransactionService_LinkTransfer(t *testing.T) {
	ctx := context.Background()
	amount := decimal.RequireFromString("120.5")

	t.Run("con una transacción existente las liga", func(t *testing.T) {
		ctrl := gomock.NewController(t)
		repo := mock.NewMockTransactionRepository(ctrl)
		svc := NewTransactionService(repo, mock.NewMockUserService(ctrl), mock.NewMockCategoryService(ctrl))
		link := &domain.TransferLink{UserID: "u1", TransactionID: 1, CounterpartTransactionID: 2}
		repo.EXPECT().LinkTransactions(ctx, link).Return(nil)
		require.NoError(t, svc.LinkTransfer(ctx, link))
	})

	t.Run("con una cuenta crea la otra pata", func(t *testing.T) {
		ctrl := gomock.NewController(t)
		repo := mock.NewMockTransactionRepository(ctrl)
		svc := NewTransactionService(repo, mock.NewMockUserService(ctrl), mock.NewMockCategoryService(ctrl))
		link := &domain.TransferLink{UserID: "u1", TransactionID: 1, CounterpartAccountID: 3, CounterpartAmount: &amount}
		repo.EXPECT().CreateTransferCounterpart(ctx, link).Return(nil)
		require.NoError(t, svc.LinkTransfer(ctx, link))
	})

	negative := decimal.RequireFromString("-1")
	invalid := map[string]*domain.TransferLink{
		"sin transacción":           {UserID: "u1", CounterpartAccountID: 3},
		"sin contraparte":           {UserID: "u1", TransactionID: 1},
		"las dos contrapartes":      {UserID: "u1", TransactionID: 1, CounterpartAccountID: 3, CounterpartTransactionID: 2},
		"consigo misma":             {UserID: "u1", TransactionID: 1, CounterpartTransactionID: 1},
		"monto negativo":            {UserID: "u1", TransactionID: 1, CounterpartAccountID: 3, CounterpartAmount: &negative},
		"monto al ligar existentes": {UserID: "u1", TransactionID: 1, CounterpartTransactionID: 2, CounterpartAmount: &amount},
	}
	for name, link := range invalid {
		t.Run(name, func(t *testing.T) {
			ctrl := gomock.NewController(t)
			svc := NewTransactionService(mock.NewMockTransactionRepository(ctrl), mock.NewMockUserService(ctrl), mock.NewMockCategoryService(ctrl))
			assert.ErrorIs(t, svc.LinkTransfer(ctx, link), domain.ErrInvalidTransfer)
		})
	}

	t.Run("candidatas: el límite se acota", func(t *testing.T) {
		ctrl := gomock.NewController(t)
		repo := mock.NewMockTransactionRepository(ctrl)
		svc := NewTransactionService(repo, mock.NewMockUserService(ctrl), mock.NewMockCategoryService(ctrl))
		repo.EXPECT().ListTransferCandidates(ctx, "u1", uint64(MaxTransferCandidates)).Return(nil, nil).Times(2)
		repo.EXPECT().ListTransferCandidates(ctx, "u1", uint64(20)).Return(nil, nil)
		_, _ = svc.ListTransferCandidates(ctx, "u1", 0)
		_, _ = svc.ListTransferCandidates(ctx, "u1", 5000)
		_, _ = svc.ListTransferCandidates(ctx, "u1", 20)
	})

	t.Run("descartar la misma transacción dos veces es inválido", func(t *testing.T) {
		ctrl := gomock.NewController(t)
		svc := NewTransactionService(mock.NewMockTransactionRepository(ctrl), mock.NewMockUserService(ctrl), mock.NewMockCategoryService(ctrl))
		assert.ErrorIs(t, svc.DismissTransferCandidate(ctx, "u1", 4, 4), domain.ErrInvalidTransfer)
	})
}
