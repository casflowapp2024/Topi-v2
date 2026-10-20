package domain

// UserGroup is an enum for user's role
type UserGroup string

// User is an entity that represents a user
type User struct {
	ID       string
	Name     string
	LastName string
	Email    string
	Password string
	Group    UserGroup
	Verified bool
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
