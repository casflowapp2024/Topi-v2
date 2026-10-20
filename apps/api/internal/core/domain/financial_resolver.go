package domain

import (
	"sync"
	"time"
)

// FinancialResolver carries shared state and synchronization primitives for
// concurrent financial analysis aggregation.
// Fields are exported to allow usage across service and repository packages.
type FinancialResolver struct {
	UserID     string
	Start      time.Time
	End        time.Time
	Rsp        *FinancialAnalysis
	Mu         *sync.Mutex
	Wg         *sync.WaitGroup
	DailyErr   error
	MonthlyErr error
}

func NewFinancialResolver(
	userID string,
	start, end time.Time,
	rsp *FinancialAnalysis,
	mu *sync.Mutex,
	wg *sync.WaitGroup,
) *FinancialResolver {
	return &FinancialResolver{
		UserID: userID,
		Start:  start,
		End:    end,
		Rsp:    rsp,
		Mu:     mu,
		Wg:     wg,
	}
}
