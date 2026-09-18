package notification

import (
	"bytes"
	"encoding/base64"
	"strings"
	"testing"
	"time"
)

func TestFactoryEncryptsLocalizedVerificationPayload(t *testing.T) {
	key := base64.StdEncoding.EncodeToString(bytes.Repeat([]byte{7}, 32))
	factory, err := NewFactory("https://creator.example", key)
	if err != nil {
		t.Fatalf("create factory: %v", err)
	}
	message, err := factory.Verification("creator@example.test", "en", "secret-one-time-token", time.Now().Add(time.Hour))
	if err != nil {
		t.Fatalf("create message: %v", err)
	}
	if bytes.Contains(message.Ciphertext, []byte("secret-one-time-token")) {
		t.Fatal("outbox ciphertext contains the raw token")
	}
	payload, err := factory.Decrypt(message.Ciphertext, message.Nonce)
	if err != nil {
		t.Fatalf("decrypt message: %v", err)
	}
	if !strings.Contains(payload.Body, "https://creator.example/en/auth/verify-email?token=secret-one-time-token") {
		t.Fatalf("unexpected verification body: %q", payload.Body)
	}
}

func TestFactoryRejectsInvalidEncryptionKey(t *testing.T) {
	if _, err := NewFactory("https://creator.example", "not-a-key"); err == nil {
		t.Fatal("expected invalid key error")
	}
}
