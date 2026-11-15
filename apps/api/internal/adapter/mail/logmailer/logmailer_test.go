package logmailer

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestMaskAddress(t *testing.T) {
	assert.Equal(t, "a***@topi.test", MaskAddress("ana.prueba@topi.test"))
	assert.Equal(t, "***", MaskAddress("no-es-correo"))
	assert.Equal(t, "***", MaskAddress("@topi.test"))
}
