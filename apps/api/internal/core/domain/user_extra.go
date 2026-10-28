package domain

import (
	"encoding/json"
	"strings"
	"time"

	"cash-flow/internal/enums"
	"cash-flow/internal/utils"
)

// UserExtra is an entity that represents extra information for a user
type UserExtra struct {
	ID                  int64
	UserID              string
	Name                string
	LastName            string
	Email               string
	ReadEmail           bool
	UTCOffset           string
	Whatsapp            string
	WhatsappState       string
	OnboardingCompleted bool
	OnboardingCreatedAt time.Time
	CreatedAt           time.Time
	UpdatedAt           time.Time
	Config              json.RawMessage
	// BaseCurrency is the currency reports and amount_base are expressed in (default COP)
	BaseCurrency string
}

func (u *UserExtra) IsSame(actual *UserExtra) bool {
	if u == nil || actual == nil {
		return false
	}

	return u.UTCOffset == actual.UTCOffset &&
		u.Whatsapp == actual.Whatsapp &&
		u.OnboardingCompleted == actual.OnboardingCompleted &&
		u.Name == actual.Name &&
		u.LastName == actual.LastName &&
		u.Email == actual.Email &&
		string(u.Config) == string(actual.Config)
}

func (u *UserExtra) IsEmpty() bool {
	return u == nil || (u.UTCOffset == "" && u.Whatsapp == "" && u.Email == "" && u.Name == "" && u.LastName == "")
}

func (u *UserExtra) UpdateWhatsappState(actual *UserExtra) {
	if u == nil || actual == nil {
		return
	}

	if u.Whatsapp != actual.Whatsapp && actual.WhatsappState != enums.PendingWhatsapp {
		u.WhatsappState = enums.PendingWhatsapp
	}
}

func (u *UserExtra) ExistsBasicUserInfo() bool {
	return u != nil && u.Name != "" && u.LastName != "" && u.Email != ""
}

func (u *UserExtra) UpdateBasicInfo(user User) {
	u.Email = strings.ToLower(user.Email)
	u.Name = utils.CapitalizeEachWord(user.Name)
	u.LastName = utils.CapitalizeEachWord(user.LastName)
}
