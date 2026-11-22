package domain

import (
	"bytes"
	"net/mail"
	"regexp"
	"sort"
	"strings"
	"sync/atomic"
	"time"
)

// Bank catalog (plan/33): the official banks and their senders, editable from the admin panel. It lives in
// bank_catalog / bank_catalog_senders; the service keeps a snapshot here so the reading rules (IsSupportedBank,
// IsOfficialSender, SupportedBanks) do not need the database.

// MaxBankLogoBytes is the largest logo the admin can upload
const MaxBankLogoBytes = 100 * 1024

type CatalogSender struct {
	ID        uint64    `json:"id"`
	BankID    uint64    `json:"bank_id"`
	Email     string    `json:"email"`
	Active    bool      `json:"active"`
	Note      *string   `json:"note"`
	CreatedAt time.Time `json:"created_at"`
}

type CatalogBank struct {
	ID        uint64          `json:"id"`
	Slug      string          `json:"slug"`
	Name      string          `json:"name"`
	Country   string          `json:"country"`
	Color     *string         `json:"color"`
	Active    bool            `json:"active"`
	LogoETag  *string         `json:"-"`
	Senders   []CatalogSender `json:"senders"`
	CreatedAt time.Time       `json:"created_at"`
	UpdatedAt time.Time       `json:"updated_at"`
}

// HasLogo: the bank has an uploaded logo
func (b CatalogBank) HasLogo() bool { return b.LogoETag != nil && *b.LogoETag != "" }

// LogoPath is the public path of the logo (relative to the API), versioned so caches refresh on a new upload
func (b CatalogBank) LogoPath() *string {
	if !b.HasLogo() {
		return nil
	}
	etag := *b.LogoETag
	if len(etag) > 12 {
		etag = etag[:12]
	}
	path := "/banks/catalog/" + uintToString(b.ID) + "/logo?v=" + etag
	return &path
}

// ActiveSenders: the addresses Topi reads for the bank
func (b CatalogBank) ActiveSenders() []string {
	out := make([]string, 0, len(b.Senders))
	for _, s := range b.Senders {
		if s.Active {
			out = append(out, s.Email)
		}
	}
	return out
}

// CatalogBankInput is what the admin sends to create or edit a bank
type CatalogBankInput struct {
	Name    string  `json:"name"`
	Slug    string  `json:"slug"`
	Country string  `json:"country"`
	Color   *string `json:"color"`
}

var (
	slugRe  = regexp.MustCompile(`^[a-z0-9]+(-[a-z0-9]+)*$`)
	colorRe = regexp.MustCompile(`^#[0-9a-fA-F]{6}$`)
	slugBad = regexp.MustCompile(`[^a-z0-9]+`)
)

// Normalize trims the input, derives the slug from the name when empty and validates it
func (in *CatalogBankInput) Normalize() error {
	in.Name = strings.Join(strings.Fields(in.Name), " ")
	if in.Name == "" || len(in.Name) > 80 {
		return ErrInvalidCatalogBank
	}
	in.Slug = strings.TrimSpace(strings.ToLower(in.Slug))
	if in.Slug == "" {
		in.Slug = Slugify(in.Name)
	}
	if !slugRe.MatchString(in.Slug) || len(in.Slug) > 60 {
		return ErrInvalidCatalogBank
	}
	in.Country = strings.ToUpper(strings.TrimSpace(in.Country))
	if in.Country == "" {
		in.Country = "CO"
	}
	if len(in.Country) != 2 {
		return ErrInvalidCatalogBank
	}
	if in.Color != nil {
		c := strings.TrimSpace(*in.Color)
		if c == "" {
			in.Color = nil
		} else if !colorRe.MatchString(c) {
			return ErrInvalidCatalogBank
		} else {
			in.Color = &c
		}
	}
	return nil
}

var accents = strings.NewReplacer("á", "a", "é", "e", "í", "i", "ó", "o", "ú", "u", "ü", "u", "ñ", "n")

// Slugify: 'Itaú Colombia' -> 'itau-colombia'
func Slugify(name string) string {
	s := accents.Replace(strings.ToLower(name))
	return strings.Trim(slugBad.ReplaceAllString(s, "-"), "-")
}

// NormalizeSenderEmail: one address, lower case, without spaces nor commas (banks.email splits by comma)
func NormalizeSenderEmail(raw string) (string, error) {
	email := strings.ToLower(strings.TrimSpace(raw))
	if email == "" || strings.ContainsAny(email, ",; \t<>\"") || len(email) > 254 {
		return "", ErrInvalidSenderEmail
	}
	addr, err := mail.ParseAddress(email)
	if err != nil || addr.Address != email || !strings.Contains(email[strings.LastIndex(email, "@"):], ".") {
		return "", ErrInvalidSenderEmail
	}
	return email, nil
}

// DetectLogoType reads the bytes (not the file name) and returns the content type of an allowed logo
func DetectLogoType(data []byte) (string, error) {
	if len(data) == 0 || len(data) > MaxBankLogoBytes {
		return "", ErrInvalidBankLogo
	}
	switch {
	case bytes.HasPrefix(data, []byte("\x89PNG\r\n\x1a\n")):
		return "image/png", nil
	case len(data) > 12 && string(data[0:4]) == "RIFF" && string(data[8:12]) == "WEBP":
		return "image/webp", nil
	}
	head := strings.ToLower(string(data[:min(len(data), 1024)]))
	head = strings.TrimSpace(strings.TrimPrefix(head, "\xef\xbb\xbf"))
	if (strings.HasPrefix(head, "<svg") || strings.HasPrefix(head, "<?xml")) && strings.Contains(head, "<svg") {
		return "image/svg+xml", nil
	}
	return "", ErrInvalidBankLogo
}

// ---------------------------------------------------------------- snapshot used by the reading rules

var catalogSnapshot atomic.Pointer[[]CatalogBank]

// SetBankCatalog replaces the snapshot (the service calls it after loading the database)
// (nil goes back to the seed; an empty list is an empty catalog).
func SetBankCatalog(banks []CatalogBank) {
	if banks == nil {
		catalogSnapshot.Store(nil)
		return
	}
	copied := append([]CatalogBank(nil), banks...)
	catalogSnapshot.Store(&copied)
}

// BankCatalog returns the current snapshot; before the first load it is the seed of the migration
func BankCatalog() []CatalogBank {
	if p := catalogSnapshot.Load(); p != nil {
		return *p
	}
	return seedCatalog
}

// FindCatalogBank: the catalog bank with that name (case and spaces ignored)
func FindCatalogBank(name string) (CatalogBank, bool) {
	key := normalizeBankName(name)
	if key == "" {
		return CatalogBank{}, false
	}
	for _, b := range BankCatalog() {
		if normalizeBankName(b.Name) == key {
			return b, true
		}
	}
	return CatalogBank{}, false
}

// SupportedBanks are the banks a user can pick today (active ones, names only, sorted)
func SupportedBanks() []string {
	names := make([]string, 0)
	for _, b := range BankCatalog() {
		if b.Active {
			names = append(names, b.Name)
		}
	}
	// stable order: the front preselects the first one
	sort.Strings(names)
	return names
}

// IsSupportedBank: the bank is in the catalog (case and spaces ignored). An inactive bank still reads
func IsSupportedBank(name string) bool {
	_, ok := FindCatalogBank(name)
	return ok
}

// IsOfficialSender: the bank is in the catalog and the sender is one of its active addresses. A sender the user
// typed (custom bank, or a catalog bank with another sender) is not: its transactions go to Por revisar.
func IsOfficialSender(bankName, sender string) bool {
	bank, ok := FindCatalogBank(bankName)
	if !ok {
		return false
	}
	allowed := map[string]bool{}
	for _, s := range bank.ActiveSenders() {
		allowed[s] = true
	}
	// sender may be one address or the comma separated list of the bank: all of them must be official
	found := false
	for _, s := range strings.Split(sender, ",") {
		s = strings.ToLower(strings.TrimSpace(s))
		if s == "" {
			continue
		}
		if !allowed[s] {
			return false
		}
		found = true
	}
	return found
}

// ---------------------------------------------------------------- senders the users typed (admin, plan/33 §E)

// personalDomains: an address here may be a person, not a bank; it is masked below MinGroupUsers users
var personalDomains = map[string]bool{
	"gmail.com": true, "googlemail.com": true, "hotmail.com": true, "hotmail.es": true, "outlook.com": true,
	"outlook.es": true, "live.com": true, "msn.com": true, "yahoo.com": true, "yahoo.es": true, "icloud.com": true,
	"me.com": true, "proton.me": true, "protonmail.com": true, "aol.com": true,
}

// IsPersonalEmailDomain: the address is from a free mailbox provider
func IsPersonalEmailDomain(email string) bool {
	at := strings.LastIndex(email, "@")
	if at < 0 {
		return false
	}
	return personalDomains[strings.ToLower(email[at+1:])]
}

// MaskEmail: 'juan@gmail.com' -> 'j***@gmail.com'
func MaskEmail(email string) string {
	at := strings.LastIndex(email, "@")
	if at <= 0 {
		return "***"
	}
	r := []rune(email[:at])
	return string(r[0]) + "***" + email[at:]
}

// UserSender is one address that users typed and the catalog does not have for that bank
type UserSender struct {
	Email        string  `json:"email"`
	Masked       bool    `json:"masked"`
	Users        int64   `json:"users"`
	Accounts     int64   `json:"accounts"`
	BankName     *string `json:"bank_name"`     // most common name, only with >= MinGroupUsers users
	CatalogBank  *string `json:"catalog_bank"`  // the catalog bank of those users, when they picked one
	InCatalogAs  *string `json:"in_catalog_as"` // the address is already a sender of another catalog bank
	SenderHealth `json:"health"`
}

// ApplyPrivacy masks a personal address and hides a bank name with few users
func (u *UserSender) ApplyPrivacy(topName string, topNameUsers int64) {
	if IsPersonalEmailDomain(u.Email) && u.Users < MinGroupUsers {
		u.Email = MaskEmail(u.Email)
		u.Masked = true
	}
	if topName != "" && topNameUsers >= MinGroupUsers {
		u.BankName = &topName
	}
}

// SenderHealth: what the worker read from one sender in the last 30 days (processed_emails)
type SenderHealth struct {
	Read          int64      `json:"read"`
	Transactions  int64      `json:"transactions"`
	NoTransaction int64      `json:"no_transaction"`
	Errors        int64      `json:"errors"`
	LastEmailAt   *time.Time `json:"last_email_at"`
}

// AdminCatalogSender is a catalog sender with its health
type AdminCatalogSender struct {
	CatalogSender
	Health SenderHealth `json:"health"`
}

// AdminCatalogBank is what the admin panel shows of one catalog bank
type AdminCatalogBank struct {
	ID             uint64               `json:"id"`
	Slug           string               `json:"slug"`
	Name           string               `json:"name"`
	Country        string               `json:"country"`
	Color          *string              `json:"color"`
	Active         bool                 `json:"active"`
	LogoURL        *string              `json:"logo_url"`
	Users          int64                `json:"users"`           // users with a bank linked to this one
	ConnectedUsers int64                `json:"connected_users"` // of them, with an account on a connected email
	Senders        []AdminCatalogSender `json:"senders"`
	UpdatedAt      time.Time            `json:"updated_at"`
}

// PublicCatalogBank is what any user gets in GET /banks/official
type PublicCatalogBank struct {
	ID      uint64  `json:"id"`
	Slug    string  `json:"slug"`
	Name    string  `json:"name"`
	Color   *string `json:"color"`
	LogoURL *string `json:"logo_url"`
}

// BankLogo is an uploaded logo
type BankLogo struct {
	BankID      uint64
	ContentType string
	Bytes       []byte
	ETag        string
	UpdatedAt   time.Time
}

func uintToString(v uint64) string {
	if v == 0 {
		return "0"
	}
	var buf [20]byte
	i := len(buf)
	for v > 0 {
		i--
		buf[i] = byte('0' + v%10)
		v /= 10
	}
	return string(buf[i:])
}

// seedCatalog: the banks of migration 000055 (before the first load and in unit tests)
var seedCatalog = func() []CatalogBank {
	raw := []struct{ slug, name, senders string }{
		{"bancolombia", "Bancolombia", "alertasynotificaciones@notificacionesbancolombia.com,alertasynotificaciones@bancolombia.com.co,alertasynotificaciones@an.notificacionesbancolombia.com"},
		{"bbva", "BBVA", "bbva@bbvanet.com.co,notificacionesbreb@bbva.com"},
		{"davibank", "Davibank", "davibankinforma@davibank.com"},
		{"scotiabank", "ScotiaBank", "colpatriainforma@scotiabankcolpatria.com,davibankinforma@davibank.com"},
		{"airtm", "AirTm", "noreply@airtm.com"},
		{"hapi", "Hapi", "no-reply@hapi.trade"},
		{"itau", "Itaú", "notificaciones@clienteitau.co"},
		{"lulo-bank", "Lulo Bank", "notificaciones@lulobank.com"},
		{"nubank", "Nubank", "nu@nu.com.co"},
		{"rappipay", "RappiPay", "rappi.nreply@rappi.com,noreply@rappicard.co,noreply@rappipay.co"},
		{"trii", "Trii", "tri@trii.co"},
	}
	banks := make([]CatalogBank, 0, len(raw))
	for i, r := range raw {
		b := CatalogBank{ID: uint64(i + 1), Slug: r.slug, Name: r.name, Country: "CO", Active: true}
		for _, s := range strings.Split(r.senders, ",") {
			b.Senders = append(b.Senders, CatalogSender{BankID: b.ID, Email: s, Active: true})
		}
		banks = append(banks, b)
	}
	return banks
}()
