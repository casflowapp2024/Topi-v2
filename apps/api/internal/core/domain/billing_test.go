package domain

import (
	"testing"

	"github.com/shopspring/decimal"
	"github.com/stretchr/testify/assert"
)

func TestParseSupportAmount(t *testing.T) {
	for _, tc := range []struct {
		in   string
		want string
		err  bool
	}{
		{in: "10000", want: "10000"},
		{in: " 20000 ", want: "20000"},
		{in: "5000", want: "5000"},
		{in: "2000000", want: "2000000"},
		{in: "50000.00", want: "50000"},
		{in: "4999", err: true},
		{in: "2000001", err: true},
		{in: "10000.5", err: true},
		{in: "-10000", err: true},
		{in: "10.000", err: true}, // 10 pesos: below the minimum
		{in: "abc", err: true},
		{in: "", err: true},
	} {
		got, err := ParseSupportAmount(tc.in)
		if tc.err {
			assert.ErrorIs(t, err, ErrInvalidSupportAmount, tc.in)
			continue
		}
		assert.NoError(t, err, tc.in)
		assert.True(t, got.Equal(decimal.RequireFromString(tc.want)), tc.in)
	}
}

func ref(s string) *string { return &s }

func TestDecidePayment(t *testing.T) {
	base := Payment{ID: "p1", Amount: decimal.NewFromInt(20000), Currency: "COP"}
	with := func(status string, providerRef, raw *string) Payment {
		p := base
		p.Status, p.ProviderRef, p.RawStatus = status, providerRef, raw
		return p
	}
	pp := func(r, status, raw string) ProviderPayment {
		return ProviderPayment{Ref: r, ExternalReference: "p1", Status: status, RawStatus: raw,
			Amount: decimal.NewFromInt(20000), Currency: "COP"}
	}

	for _, tc := range []struct {
		name    string
		current Payment
		in      ProviderPayment
		want    PaymentAction
	}{
		{"first notice approves", with(PaymentCreated, nil, nil), pp("9", PaymentApproved, "approved/accredited"), PaymentUpdate},
		{"first notice pending", with(PaymentCreated, nil, nil), pp("9", PaymentPending, "in_process/pending"), PaymentUpdate},
		{"repeated notice", with(PaymentApproved, ref("9"), ref("approved/accredited")), pp("9", PaymentApproved, "approved/accredited"), PaymentIgnore},
		{"pending to approved", with(PaymentPending, ref("9"), ref("in_process/x")), pp("9", PaymentApproved, "approved/accredited"), PaymentUpdate},
		{"late pending never moves back", with(PaymentApproved, ref("9"), ref("approved/accredited")), pp("9", PaymentPending, "in_process/x"), PaymentIgnore},
		{"late rejected never moves back", with(PaymentApproved, ref("9"), ref("approved/accredited")), pp("9", PaymentRejected, "rejected/x"), PaymentIgnore},
		{"refund", with(PaymentApproved, ref("9"), ref("approved/accredited")), pp("9", PaymentRefunded, "refunded/x"), PaymentUpdate},
		{"retry after rejection", with(PaymentRejected, ref("8"), ref("rejected/x")), pp("9", PaymentApproved, "approved/accredited"), PaymentUpdate},
		{"paid twice", with(PaymentApproved, ref("8"), ref("approved/accredited")), pp("9", PaymentApproved, "approved/accredited"), PaymentInsert},
		{"rejected attempt after approval", with(PaymentApproved, ref("8"), ref("approved/accredited")), pp("9", PaymentRejected, "rejected/x"), PaymentIgnore},
		{"same status, new detail", with(PaymentPending, ref("9"), ref("in_process/a")), pp("9", PaymentPending, "in_process/b"), PaymentUpdate},
		{"someone else's payment", with(PaymentCreated, nil, nil), ProviderPayment{Ref: "9", ExternalReference: "p2", Status: PaymentApproved}, PaymentIgnore},
		{"no provider reference", with(PaymentCreated, nil, nil), ProviderPayment{ExternalReference: "p1", Status: PaymentApproved}, PaymentIgnore},
	} {
		assert.Equal(t, tc.want, DecidePayment(tc.current, tc.in), tc.name)
	}
}

func TestPaymentAmountMatchesAndView(t *testing.T) {
	p := Payment{ID: "p1", Kind: PaymentKindSupport, Amount: decimal.RequireFromString("20000.00"), Currency: "COP",
		Status: PaymentApproved}
	assert.True(t, p.AmountMatches(ProviderPayment{Amount: decimal.NewFromInt(20000), Currency: "cop"}))
	assert.False(t, p.AmountMatches(ProviderPayment{Amount: decimal.NewFromInt(2000), Currency: "COP"}))
	assert.False(t, p.AmountMatches(ProviderPayment{Amount: decimal.NewFromInt(20000), Currency: "USD"}))
	assert.Equal(t, "20000", p.View().Amount)
	assert.True(t, IsFinalPaymentStatus(PaymentApproved))
	assert.False(t, IsFinalPaymentStatus(PaymentPending))
	assert.NoError(t, ProductEvent{UserID: "u", Name: ProductEventSupportApproved}.Validate())
	assert.Error(t, ProductEvent{UserID: "u", Name: ProductEventSupportApproved, Props: map[string]any{"amount": 1}}.Validate())
}
