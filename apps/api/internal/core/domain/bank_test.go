package domain

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestNewOfficialBanks_SortedByName(t *testing.T) {
	banks := map[string]string{"Nubank": "a", "BBVA": "b", "Lulo Bank": "c", "Bancolombia": "d", "AirTm": "e"}
	want := []string{"AirTm", "BBVA", "Bancolombia", "Lulo Bank", "Nubank"}

	// el orden de un map de Go cambia entre iteraciones: repetir para no pasar por suerte
	for i := 0; i < 20; i++ {
		assert.Equal(t, want, NewOfficialBanks(banks).Banks)
	}
}
