package service

import "testing"

func TestPasswordHashRoundTrip(t *testing.T) {
	encoded, err := hashPassword("correct horse battery staple")
	if err != nil {
		t.Fatalf("hash password: %v", err)
	}
	if !verifyPassword("correct horse battery staple", encoded) {
		t.Fatal("expected password to verify")
	}
	if verifyPassword("incorrect password", encoded) {
		t.Fatal("expected incorrect password to fail")
	}
}

func TestVerifyPasswordRejectsMalformedHash(t *testing.T) {
	for _, value := range []string{"", "$argon2id$broken", "$argon2id$v=19$m=9999999,t=3,p=2$bad$bad"} {
		if verifyPassword("password", value) {
			t.Fatalf("expected malformed hash %q to fail", value)
		}
	}
}
