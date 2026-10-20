package domain

import (
	"strings"
	"time"
	"unicode"
)

// UserGroup is an enum for user's role
type UserGroup string

// User roles (users.role)
const (
	RoleUser  = "user"
	RoleAdmin = "admin"
)

// User is an entity that represents a user
type User struct {
	ID            string
	Name          string
	LastName      string
	Email         string
	Password      string
	PasswordHash  *string // nil = the user must create a password (migrated or reset by the admin)
	Role          string
	Migrated      bool
	PasswordSetAt *time.Time
	TokenVersion  int
	Group         UserGroup
	Verified      bool
	CreatedAt     time.Time
	UpdatedAt     time.Time
}

// HasPassword reports whether the user already created a password
func (u *User) HasPassword() bool {
	return u.PasswordHash != nil && *u.PasswordHash != ""
}

// IsAdmin reports whether the user has the admin role
func (u *User) IsAdmin() bool {
	return u.Role == RoleAdmin
}

// NormalizeEmail lowercases and trims an email (users.email is unique on lower(email))
func NormalizeEmail(email string) string {
	return strings.ToLower(strings.TrimSpace(email))
}

// ValidatePasswordPolicy applies the same policy as the previous provider: at least 8 characters,
// an uppercase letter, a lowercase letter, a number and a symbol.
func ValidatePasswordPolicy(password string) error {
	var hasUpper, hasLower, hasNumber, hasSymbol bool

	for _, r := range password {
		switch {
		case unicode.IsUpper(r):
			hasUpper = true
		case unicode.IsLower(r):
			hasLower = true
		case unicode.IsDigit(r):
			hasNumber = true
		case unicode.IsPunct(r) || unicode.IsSymbol(r) || r == ' ':
			hasSymbol = true
		}
	}

	if len([]rune(password)) < 8 || !hasUpper || !hasLower || !hasNumber || !hasSymbol {
		return ErrInvalidPasswordException
	}

	return nil
}

func IsSameUser(currentUser, newUser *User) bool {
	sameNames := currentUser.Name == newUser.Name
	isSameLastName := currentUser.LastName == newUser.LastName
	return isSameLastName && sameNames
}

func UserIsEmpty(user *User) bool {
	return user.Email == "" && user.Name == ""
}

func ConfirmPassword(password, confirmPassword string) error {
	if password != confirmPassword {
		return ErrDifferentConfirmPassword
	}
	return nil
}
