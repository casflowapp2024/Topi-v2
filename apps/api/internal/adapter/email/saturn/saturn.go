package saturn

import (
	"cash-flow/internal/adapter/config"
	"cash-flow/internal/adapter/logger"
	"cash-flow/internal/adapter/sqs"
	"cash-flow/internal/core/domain"
)

type API struct {
	sqsClient *sqs.Client
	config    *config.Saturn
}

func NewSaturnAPI(sqsClient *sqs.Client, config *config.Saturn) *API {
	return &API{
		sqsClient: sqsClient,
		config:    config,
	}
}

func (s *API) ShouldReadEmail(request domain.ReadEmailBodyRequest) bool {
	should := request.Email != "" &&
		request.EmailID != 0 &&
		request.Provider != "" &&
		request.SenderEmail != "" &&
		len(request.Accounts) > 0

	if !should {
		logger.Logger.WithField("sender_email", request.SenderEmail).Debug("skipping email reading request")
	}

	return should
}
func (s *API) ReadEmail(request domain.ReadEmailBodyRequest, resolver *domain.ReadEmailResolver) {
	defer resolver.WG.Done()

	logFields := logger.Logger.
		WithField("account_ids", request.Accounts).
		WithField("user_id", request.UserID).
		WithField("sender_email", request.SenderEmail)

	logFields.Info("starting background email reading for grouped accounts")

	messageID, err := s.sqsClient.SendMessage(request, true)
	if err != nil {
		logFields.
			WithField("error", err).
			Error("failed to send email reading request to SQS")

		resolver.AddRead(domain.Read{
			Accounts:    request.GetAccounts(),
			SenderEmail: request.SenderEmail,
			MessageID:   messageID,
			Error:       err.Error(),
		})

		return
	}

	logFields.
		WithField("message_id", *messageID).
		Info("successfully sent email reading request to SQS")

	resolver.AddRead(domain.Read{
		Accounts:    request.GetAccounts(),
		SenderEmail: request.SenderEmail,
		MessageID:   messageID,
	})
}
