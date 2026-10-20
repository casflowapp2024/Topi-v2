package password

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// small parameters keep the tests fast
var testParams = Params{Memory: 1024, Iterations: 1, Parallelism: 1, SaltLength: 16, KeyLength: 32}

func TestArgon2_HashAndCompare(t *testing.T) {
	hasher := New(testParams)

	hash, err := hasher.Hash("Password123!")
	require.NoError(t, err)
	assert.True(t, strings.HasPrefix(hash, "$argon2id$v=19$m=1024,t=1,p=1$"))
	assert.NotContains(t, hash, "Password123!")

	ok, err := hasher.Compare(hash, "Password123!")
	require.NoError(t, err)
	assert.True(t, ok)

	ok, err = hasher.Compare(hash, "password123!")
	require.NoError(t, err)
	assert.False(t, ok)

	other, err := hasher.Hash("Password123!")
	require.NoError(t, err)
	assert.NotEqual(t, hash, other, "salt must be random")
}

func TestArgon2_CompareUsesStoredParams(t *testing.T) {
	hash, err := New(testParams).Hash("Password123!")
	require.NoError(t, err)

	ok, err := New(DefaultParams).Compare(hash, "Password123!")
	require.NoError(t, err)
	assert.True(t, ok)
}

func TestArgon2_CompareInvalidHash(t *testing.T) {
	hasher := New(testParams)

	for _, invalid := range []string{"", "plain", "$bcrypt$x$y$z$w", "$argon2id$v=19$m=1,t=1,p=1$!!$!!"} {
		ok, err := hasher.Compare(invalid, "x")
		assert.Error(t, err, invalid)
		assert.False(t, ok)
	}
}
