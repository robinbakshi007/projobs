<?php

namespace App\Services;

use Illuminate\Support\Facades\Crypt;

/**
 * Wraps Laravel's symmetric encryption (AES-256-CBC via APP_KEY).
 *
 * Stored format:  Crypt::encryptString($plaintext)
 * The ciphertext is Laravel's serialised, MAC-signed payload — safe to store
 * in longText columns.
 */
class EncryptionService
{
    /**
     * Encrypt a plaintext string (e.g. a password or OAuth token).
     * Returns the opaque ciphertext that should be persisted.
     */
    public function encrypt(string $plaintext): string
    {
        return Crypt::encryptString($plaintext);
    }

    /**
     * Decrypt a previously encrypted ciphertext.
     * Throws \Illuminate\Contracts\Encryption\DecryptException on tamper / bad key.
     */
    public function decrypt(string $ciphertext): string
    {
        return Crypt::decryptString($ciphertext);
    }
}
