package domain

import "sync"

type CategoryPredictionResolver struct {
	UserID             string
	PredictionsMap     map[string]uint64
	DefaultCategoryID  uint64
	PredictionErr      error
	DefaultCategoryErr error
	Mu                 *sync.Mutex
	Wg                 *sync.WaitGroup
}

func NewCategoryPredictionResolver(userID string, mu *sync.Mutex, Wg *sync.WaitGroup) *CategoryPredictionResolver {
	return &CategoryPredictionResolver{
		UserID:         userID,
		PredictionsMap: make(map[string]uint64),
		Mu:             mu,
		Wg:             Wg,
	}
}
