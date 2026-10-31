package http

import (
	"bytes"
	"cash-flow/internal/adapter/config"
	"cash-flow/internal/adapter/email"
	"cash-flow/internal/adapter/email/jobqueue"
	"cash-flow/internal/adapter/logger"
	"cash-flow/internal/core/domain"
	"cash-flow/internal/core/port/mock"
	"cash-flow/internal/core/service"
	"cash-flow/internal/enums"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/golang/mock/gomock"
	"github.com/stretchr/testify/assert"
)

// jobStore records the jobs that would be inserted in email_jobs
type jobStore struct {
	mu       sync.Mutex
	payloads []domain.ReadEmailBodyRequest
	priority []int16
}

func (s *jobStore) Enqueue(_ context.Context, payload []byte, priority int16, dedupeKey string) (int64, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	var request domain.ReadEmailBodyRequest
	if err := json.Unmarshal(payload, &request); err != nil {
		return 0, err
	}
	s.payloads = append(s.payloads, request)
	s.priority = append(s.priority, priority)
	return int64(len(s.payloads)), nil
}

// TestEmailHandler_ReadEmail_EnqueuesJob runs POST /email/read through the real
// EmailService and UserEmail adapter (auth payload simulated in the context) and
// checks that one job is enqueued in email_jobs with the SQS payload.
func TestEmailHandler_ReadEmail_EnqueuesJob(t *testing.T) {
	ctrl := gomock.NewController(t)
	defer ctrl.Finish()

	gin.SetMode(gin.TestMode)
	logger.Set(&config.App{Env: "test"})

	emailID := uint64(7)
	sender := "alertas@banco.com"
	userAccounts := []domain.Account{{ID: 10, UserID: "user-123"}}
	accountsDetails := []domain.Account{{
		ID:             10,
		UserID:         "user-123",
		LastFourDigits: "1234",
		Bank:           domain.Bank{Email: &sender},
		Email:          domain.Email{ID: &emailID, Email: "user@example.com", Provider: enums.Gmail},
	}}

	mockAccountService := mock.NewMockAccountService(ctrl)
	mockAccountRepo := mock.NewMockAccountRepository(ctrl)
	mockAccountService.EXPECT().GetAccounts(gomock.Any(), "user-123", uint64(0), uint64(100), enums.All).
		Return(userAccounts, nil)
	mockAccountRepo.EXPECT().AdminGetAccountsList(gomock.Any(), domain.AccountFilters{IDs: []uint64{10}, Skip: 0, Limit: 100}).
		Return(accountsDetails, nil)

	store := &jobStore{}
	userEmail := email.NewUserEmail(nil, nil, jobqueue.New(store))
	emailService := service.NewEmailService(
		mock.NewMockEmailRepository(ctrl),
		userEmail,
		mockAccountRepo,
		mockAccountService,
		mock.NewMockTransactionManager(ctrl),
	)
	handler := NewEmailHandler(emailService)

	router := gin.New()
	router.POST("/email/read", func(ctx *gin.Context) {
		setupAccountAuthContext(ctx, "user-123")
		handler.ReadEmail(ctx)
	})

	body, _ := json.Marshal(ReadEmailRequest{AccountIDs: []uint64{10}})
	req := httptest.NewRequest(http.MethodPost, "/email/read", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	assert.Len(t, store.payloads, 1)
	assert.Equal(t, enums.EmailJobPriorityHigh, store.priority[0])
	assert.Equal(t, domain.ReadEmailBodyRequest{
		UserID:      "user-123",
		Email:       "user@example.com",
		EmailID:     emailID,
		Provider:    enums.Gmail,
		SenderEmail: sender,
		Accounts:    map[string]string{"1234": "10"},
		Currencies:  map[string]string{"10": "COP"},
		Classes:     map[string]string{"10": "deposit"},
		Onboarding:  true,
	}, store.payloads[0])

	var rsp struct {
		Data domain.ReadEmailResponse `json:"data"`
	}
	assert.NoError(t, json.Unmarshal(w.Body.Bytes(), &rsp))
	assert.Len(t, rsp.Data.Reads, 1)
	assert.Equal(t, "1", *rsp.Data.Reads[0].MessageID)
}
