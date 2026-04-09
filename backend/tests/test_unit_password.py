"""
Unit tests for password policy (app/auth/password.py).

These tests are pure — no database, no HTTP layer, no fixtures.
They verify the security contract that every password-accepting endpoint relies on.
"""
import pytest
from app.auth.password import hash_password, verify_password, validate_password_strength


class TestValidatePasswordStrength:
    """validate_password_strength: min 12 chars, upper, lower, digit, special."""

    # ── passing cases ──────────────────────────────────────────────────────

    def test_valid_password_returns_true(self):
        assert validate_password_strength("Test1234!Pass") is True

    def test_minimum_length_12_accepted(self):
        assert validate_password_strength("Aa1!aaaaaaaa") is True  # exactly 12

    def test_long_password_accepted(self):
        assert validate_password_strength("Sup3r$ecureP@ssword2025") is True

    def test_all_special_chars_accepted(self):
        for char in "!@#$%^&*()_+-=[]{}|;':\",./<>?":
            pw = f"Abcdef1234{char}x"  # 12+ chars
            assert validate_password_strength(pw) is True, f"Special char {char!r} should be accepted"

    # ── failing cases ──────────────────────────────────────────────────────

    def test_too_short_returns_false(self):
        assert validate_password_strength("Ab1!short") is False  # 9 chars

    def test_exactly_11_chars_rejected(self):
        assert validate_password_strength("Aa1!aaaaaaa") is False  # 11 chars

    def test_missing_uppercase_returns_false(self):
        assert validate_password_strength("test1234!pass") is False

    def test_missing_lowercase_returns_false(self):
        assert validate_password_strength("TEST1234!PASS") is False

    def test_missing_digit_returns_false(self):
        assert validate_password_strength("TestPass!word") is False

    def test_missing_special_char_returns_false(self):
        assert validate_password_strength("TestPass1234A") is False

    def test_empty_string_returns_false(self):
        assert validate_password_strength("") is False

    def test_whitespace_only_returns_false(self):
        assert validate_password_strength("            ") is False

    def test_all_same_char_returns_false(self):
        assert validate_password_strength("aaaaaaaaaaaa") is False

    def test_no_special_only_alphanumeric_returns_false(self):
        assert validate_password_strength("TestPass1234") is False


class TestHashPassword:
    """hash_password: bcrypt rounds=12, result is verifiable, never plaintext."""

    def test_returns_string(self):
        result = hash_password("Test1234!Pass")
        assert isinstance(result, str)

    def test_result_is_not_plaintext(self):
        plain = "Test1234!Pass"
        result = hash_password(plain)
        assert result != plain

    def test_bcrypt_prefix_in_hash(self):
        result = hash_password("Test1234!Pass")
        assert result.startswith("$2b$") or result.startswith("$2a$")

    def test_same_password_produces_different_hashes(self):
        """bcrypt uses per-call random salt — two hashes of the same password differ."""
        plain = "Test1234!Pass"
        h1 = hash_password(plain)
        h2 = hash_password(plain)
        assert h1 != h2

    def test_empty_string_can_be_hashed(self):
        """No crash; empty password enforcement is upstream policy, not hashing."""
        result = hash_password("")
        assert isinstance(result, str)


class TestVerifyPassword:
    """verify_password: correct password returns True, wrong returns False, never raises."""

    def test_correct_password_returns_true(self):
        plain = "Test1234!Pass"
        hashed = hash_password(plain)
        assert verify_password(plain, hashed) is True

    def test_wrong_password_returns_false(self):
        hashed = hash_password("Test1234!Pass")
        assert verify_password("WrongPass1234!", hashed) is False

    def test_empty_vs_correct_returns_false(self):
        hashed = hash_password("Test1234!Pass")
        assert verify_password("", hashed) is False

    def test_correct_vs_different_hash_returns_false(self):
        h1 = hash_password("Test1234!Pass")
        assert verify_password("Other5678@Pass", h1) is False

    def test_invalid_hash_does_not_raise(self):
        """verify_password must return False (not crash) on garbage hash values."""
        assert verify_password("Test1234!Pass", "not-a-valid-hash") is False

    def test_empty_hash_does_not_raise(self):
        assert verify_password("Test1234!Pass", "") is False

    def test_hash_and_verify_roundtrip(self):
        for plain in ["Test1234!Pass", "Sup3r$ecureP@ss", "C0mpl3x!P@ssw0rd"]:
            assert verify_password(plain, hash_password(plain)) is True
