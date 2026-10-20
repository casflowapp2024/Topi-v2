package http

import (
	"cash-flow/internal/adapter/config"
	"cash-flow/internal/core/domain"
	"cash-flow/internal/enums"
	"fmt"
	"log/slog"
	"strings"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/gin-gonic/gin/binding"
	"github.com/go-playground/validator/v10"
)

// Router is a wrapper for HTTP Router
type Router struct {
	Router *gin.Engine
}

// NewRouter creates a new HTTP Router
func NewRouter(config *config.HTTP) (*Router, string) {
	if config == nil || config.URL == "" || config.Port == "" {
		slog.Error(domain.ErrInvalidConfig.Error())
		panic(domain.ErrInvalidConfig)
	}

	listenAddr := fmt.Sprintf("%s:%s", config.URL, config.Port)

	// Disable debug mode in production or dev
	if config.Env != enums.Local {
		gin.SetMode(gin.ReleaseMode)
	}

	// CORS
	ginConfig := cors.DefaultConfig()
	allowedOrigins := config.AllowedOrigins
	originsList := strings.Split(allowedOrigins, ",")
	ginConfig.AllowOrigins = originsList
	ginConfig.AllowHeaders = config.AllowedHeaders

	router := gin.New()

	router.Use(
		RequestIDMiddleware(), // Add request ID generation
		gin.Recovery(),
		cors.New(ginConfig),
	)

	registerValidators()

	return &Router{router}, listenAddr
}

// Serve starts the HTTP server
func (r *Router) Serve(listenAddr string) {
	slog.Info("Starting the HTTP server", "listen_address", listenAddr)

	err := r.Router.Run(listenAddr)
	if err != nil {
		slog.Error(domain.ErrRunningServer.Error(), "error", err)
		panic(domain.ErrRunningServer)
	}
}

// registerValidators registers custom validators
func registerValidators() {
	v, ok := binding.Validator.Engine().(*validator.Validate)
	if ok {
		if err := v.RegisterValidation(enums.LowercaseValidatorTag, lowercaseValidator); err != nil {
			slog.Error(domain.ErrRegisteringValidator.Error(), "error", err)
			panic(domain.ErrRegisteringValidator)
		}

		if err := v.RegisterValidation(enums.LastFourDigitsValidatorTag, lastFourDigitsValidator); err != nil {
			slog.Error(domain.ErrRegisteringValidator.Error(), "error", err)
			panic(domain.ErrRegisteringValidator)
		}

		if err := v.RegisterValidation(enums.AutomationTimeValidatorTag, validateTimeFormat); err != nil {
			slog.Error(domain.ErrRegisteringValidator.Error(), "error", err)
			panic(domain.ErrRegisteringValidator)
		}

		if err := v.RegisterValidation(enums.SortOrderValidatorTag, validateSortBy); err != nil {
			slog.Error(domain.ErrRegisteringValidator.Error(), "error", err)
			panic(domain.ErrRegisteringValidator)
		}

		if err := v.RegisterValidation(enums.SortByValidatorTag, validateTransactionColumns); err != nil {
			slog.Error(domain.ErrRegisteringValidator.Error(), "error", err)
			panic(domain.ErrRegisteringValidator)
		}

		if err := v.RegisterValidation(enums.UtcOffsetValidationTag, validateUtcOffset); err != nil {
			slog.Error(domain.ErrRegisteringValidator.Error(), "error", err)
			panic(domain.ErrRegisteringValidator)
		}

		if err := v.RegisterValidation(enums.AccountTypeValidatorTag, validateAccountType); err != nil {
			slog.Error(domain.ErrRegisteringValidator.Error(), "error", err)
			panic(domain.ErrRegisteringValidator)
		}

		v.RegisterStructValidation(validateLoginStruct, loginRequest{})

		v.RegisterStructValidation(validateFinancialAnalysisRequest, FinancialAnalysisRequest{})

		if err := v.RegisterValidation(enums.EmailsTag, validateEmails); err != nil {
			slog.Error(domain.ErrRegisteringValidator.Error(), "error", err)
			panic(domain.ErrRegisteringValidator)
		}
	}
}

func lowercaseValidator(fl validator.FieldLevel) bool {
	return fl.Field().Interface().(string) == strings.ToLower(fl.Field().String())
}

func lastFourDigitsValidator(fl validator.FieldLevel) bool {
	number := fl.Field().String()
	length := len(number)
	return length == 4
}

func validateTimeFormat(fl validator.FieldLevel) bool {
	timeField := fl.Field().String()
	if timeField == "" {
		return true
	}
	parsedTime, err := time.Parse("15:04", timeField)
	if err != nil {
		return false
	}
	return parsedTime.Minute() == 0
}

func validateSortBy(fl validator.FieldLevel) bool {
	sortBy := fl.Field().String()
	return sortBy == "asc" || sortBy == "desc" || sortBy == ""
}

func validateTransactionColumns(fl validator.FieldLevel) bool {
	column := fl.Field().String()
	tColumn, ok := enums.TransactionColumnsMap[column]
	if !ok {
		return false
	}

	fl.Field().SetString(tColumn)
	return true
}

func validateUtcOffset(fl validator.FieldLevel) bool {
	offset := fl.Field().Int()
	if offset < -12 || offset > 14 {
		return false
	}

	return true
}

func validateAccountType(fl validator.FieldLevel) bool {
	accountType := fl.Field().Uint()
	for _, t := range enums.AllTypes {
		if t == accountType {
			return true
		}
	}

	return false
}

func validateLoginStruct(sl validator.StructLevel) {
	req := sl.Current().Interface().(loginRequest)

	if req.Code == "" && req.Password == "" {
		sl.ReportError(
			req.Password,
			"password",
			"password",
			enums.RequiredWith,
			"password can't be empty",
		)
	}

	if req.Code == "" && req.Email == "" {
		sl.ReportError(
			req.Password,
			"email",
			"password",
			enums.RequiredWith,
			"email can't be empty",
		)
	}

	if req.Code != "" && (req.Password != "" || req.Email != "") {
		sl.ReportError(
			req.Code,
			"code",
			"code",
			enums.CantUseCodeForLogin,
			"can't use code, email and password at the same time",
		)
	}
}

func validateFinancialAnalysisRequest(sl validator.StructLevel) {
	req := sl.Current().Interface().(FinancialAnalysisRequest)

	_, err := time.Parse(enums.YearMonthLayout, req.Date)
	if err != nil {
		sl.ReportError(
			req.Date,
			"date",
			"date",
			enums.YearMonthFormat,
			"the date must be in YYYY-MM format",
		)
		return
	}
}

func validateEmails(fl validator.FieldLevel) bool {
	emailsStr, ok := fl.Field().Interface().(string)
	if !ok {
		return false
	}

	emails := strings.Split(emailsStr, ",")

	for _, email := range emails {
		if err := validator.New().Var(email, "email"); err != nil {
			return false
		}
	}

	return true
}
