package domain

import "github.com/aws/aws-sdk-go/service/cognitoidentityprovider"

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

func CreateUsersFromCognito(response *cognitoidentityprovider.ListUsersOutput) []User {
	users := make([]User, 0, len(response.Users))
	for _, cognitoUser := range response.Users {
		user := User{}

		user.MapUserAttributes(cognitoUser)
		users = append(users, user)
	}

	return users
}

func (u *User) MapUserAttributes(cognitoUser *cognitoidentityprovider.UserType) {
	for _, attribute := range cognitoUser.Attributes {
		switch *attribute.Name {
		case "sub":
			u.ID = *attribute.Value
		case "name":
			u.Name = *attribute.Value
		case "family_name":
			u.LastName = *attribute.Value
		case "email":
			u.Email = *attribute.Value
		case "email_verified":
			if *attribute.Value == "true" {
				u.Verified = true
			}
		}
	}
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
