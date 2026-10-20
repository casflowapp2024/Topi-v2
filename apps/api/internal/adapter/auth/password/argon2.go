// Package password implements port.PasswordHasher with argon2id.
package password

import (
	"crypto/rand"
	"crypto/subtle"
	"encoding/base64"
	"errors"
	"fmt"
	"strings"

	"golang.org/x/crypto/argon2"
)

// Params are the argon2id parameters (OWASP minimum: 19 MiB, 2 iterations, 1 thread)
type Params struct {
	Memory      uint32 // KiB
	Iterations  uint32
	Parallelism uint8
	SaltLength  uint32
	KeyLength   uint32
}

// DefaultParams are used in production
var DefaultParams = Params{Memory: 19 * 1024, Iterations: 2, Parallelism: 1, SaltLength: 16, KeyLength: 32}

var errInvalidHash = errors.New("invalid argon2id hash")

// b64 is standard base64 without padding, as used by the PHC string format
var b64 = base64.StdEncoding.WithPadding(base64.NoPadding)

// Argon2 hashes passwords in PHC format: $argon2id$v=19$m=...,t=...,p=...$salt$hash
type Argon2 struct {
	params Params
}

// New creates an argon2id hasher
func New(params Params) *Argon2 {
	return &Argon2{params: params}
}

// Hash returns the encoded argon2id hash of the password
func (a *Argon2) Hash(password string) (string, error) {
	salt := make([]byte, a.params.SaltLength)
	if _, err := rand.Read(salt); err != nil {
		return "", err
	}

	key := argon2.IDKey([]byte(password), salt, a.params.Iterations, a.params.Memory, a.params.Parallelism, a.params.KeyLength)

	return fmt.Sprintf("$argon2id$v=%d$m=%d,t=%d,p=%d$%s$%s",
		argon2.Version, a.params.Memory, a.params.Iterations, a.params.Parallelism,
		b64.EncodeToString(salt),
		b64.EncodeToString(key),
	), nil
}

// Compare reports whether the password matches the encoded hash (constant time)
func (a *Argon2) Compare(encoded, password string) (bool, error) {
	parts := strings.Split(encoded, "$")
	if len(parts) != 6 || parts[1] != "argon2id" {
		return false, errInvalidHash
	}

	var version int
	if _, err := fmt.Sscanf(parts[2], "v=%d", &version); err != nil || version != argon2.Version {
		return false, errInvalidHash
	}

	var p Params
	if _, err := fmt.Sscanf(parts[3], "m=%d,t=%d,p=%d", &p.Memory, &p.Iterations, &p.Parallelism); err != nil {
		return false, errInvalidHash
	}

	salt, err := b64.DecodeString(parts[4])
	if err != nil {
		return false, errInvalidHash
	}

	key, err := b64.DecodeString(parts[5])
	if err != nil {
		return false, errInvalidHash
	}

	other := argon2.IDKey([]byte(password), salt, p.Iterations, p.Memory, p.Parallelism, uint32(len(key)))

	return subtle.ConstantTimeCompare(key, other) == 1, nil
}
