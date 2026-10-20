package social

import (
	"cash-flow/internal/adapter/config"
	"cash-flow/internal/core/domain"
	"testing"
)

func TestGetAuthURL_Web(t *testing.T) {
	cfg := &config.Social{
		Auth: config.Auth{
			ClientID: "test-client-id",
		},
		Http: config.HTTPClient{
			URL: "https://auth.example.com",
		},
		CallBackURL:       "https://web.example.com/callback",
		CallBackMobileURL: "https://mobile.example.com/callback",
	}

	repo := NewSocialAuthRepository(nil, cfg)

	url, err := repo.GetAuthURL("") // Empty string for web
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if url == nil {
		t.Fatal("Expected URL, got nil")
	}

	// Verify it contains the web callback URL
	if !contains(*url, "https%3A%2F%2Fweb.example.com%2Fcallback") {
		t.Errorf("Expected URL to contain web callback, got: %s", *url)
	}
}

func TestGetAuthURL_Mobile(t *testing.T) {
	cfg := &config.Social{
		Auth: config.Auth{
			ClientID: "test-client-id",
		},
		Http: config.HTTPClient{
			URL: "https://auth.example.com",
		},
		CallBackURL:       "https://web.example.com/callback",
		CallBackMobileURL: "https://mobile.example.com/callback",
	}

	repo := NewSocialAuthRepository(nil, cfg)

	url, err := repo.GetAuthURL("mobile")
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if url == nil {
		t.Fatal("Expected URL, got nil")
	}

	// Verify it contains the mobile callback URL
	if !contains(*url, "https%3A%2F%2Fmobile.example.com%2Fcallback") {
		t.Errorf("Expected URL to contain mobile callback, got: %s", *url)
	}
}

func TestGetAuthURL_MobileNotConfigured(t *testing.T) {
	cfg := &config.Social{
		Auth: config.Auth{
			ClientID: "test-client-id",
		},
		Http: config.HTTPClient{
			URL: "https://auth.example.com",
		},
		CallBackURL:       "https://web.example.com/callback",
		CallBackMobileURL: "", // Not configured
	}

	repo := NewSocialAuthRepository(nil, cfg)

	_, err := repo.GetAuthURL("mobile")
	if err != domain.ErrMobileCallbackNotConfigured {
		t.Fatalf("Expected ErrMobileCallbackNotConfigured, got %v", err)
	}
}

func TestGetAuthURL_MobileSameAsWeb(t *testing.T) {
	cfg := &config.Social{
		Auth: config.Auth{
			ClientID: "test-client-id",
		},
		Http: config.HTTPClient{
			URL: "https://auth.example.com",
		},
		CallBackURL:       "https://web.example.com/callback",
		CallBackMobileURL: "https://web.example.com/callback", // Same as web - this is now allowed
	}

	repo := NewSocialAuthRepository(nil, cfg)

	url, err := repo.GetAuthURL("mobile")
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if url == nil {
		t.Fatal("Expected URL, got nil")
	}

	// Should work fine even if both URLs are the same
	if !contains(*url, "https%3A%2F%2Fweb.example.com%2Fcallback") {
		t.Errorf("Expected URL to contain callback, got: %s", *url)
	}
}

func TestGetAuthURL_UnknownPlatform(t *testing.T) {
	cfg := &config.Social{
		Auth: config.Auth{
			ClientID: "test-client-id",
		},
		Http: config.HTTPClient{
			URL: "https://auth.example.com",
		},
		CallBackURL:       "https://web.example.com/callback",
		CallBackMobileURL: "https://mobile.example.com/callback",
	}

	repo := NewSocialAuthRepository(nil, cfg)

	// Unknown platforms should default to web callback
	url, err := repo.GetAuthURL("desktop")
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if url == nil {
		t.Fatal("Expected URL, got nil")
	}

	// Verify it contains the web callback URL (default)
	if !contains(*url, "https%3A%2F%2Fweb.example.com%2Fcallback") {
		t.Errorf("Expected URL to contain web callback (default), got: %s", *url)
	}
}

func contains(s, substr string) bool {
	return len(s) >= len(substr) && (s == substr || len(s) > len(substr) && containsHelper(s, substr))
}

func containsHelper(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}
