import type { User } from '@supabase/supabase-js';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';

import { getAppleCredentialSubject } from './appleCredentialLifecycle';

const REQUEST_SECRET_BYTES = 32;
const REQUEST_SECRET_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const SHA256_HEX_PATTERN = /^[0-9a-f]{64}$/i;
const MAX_APPLE_ID_TOKEN_CHARS = 16_384;
const MAX_APPLE_AUTHORIZATION_CODE_CHARS = 4_096;
const MAX_APPLE_USER_CHARS = 512;
const MAX_APPLE_EMAIL_CHARS = 320;
const BASE64URL_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

const INVALID_APPLE_CREDENTIAL_MESSAGE = 'Sign in with Apple returned an invalid credential.';
const INVALID_APPLE_RANDOMNESS_MESSAGE = 'Sign in with Apple could not create a secure request.';

export type AppleSignInCredential = {
  appleUser: string;
  authorizationCode: string;
  email: string | null;
  idToken: string;
  nonce: string;
};

function optionalString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function boundedRequiredString(value: unknown, maxChars: number): string {
  const normalized = optionalString(value);
  if (!normalized || normalized.length > maxChars) {
    throw new Error(INVALID_APPLE_CREDENTIAL_MESSAGE);
  }
  return normalized;
}

function boundedOptionalEmail(value: unknown): string | null {
  const normalized = optionalString(value);
  if (!normalized) return null;
  if (normalized.length > MAX_APPLE_EMAIL_CHARS) {
    throw new Error(INVALID_APPLE_CREDENTIAL_MESSAGE);
  }
  return normalized;
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let encoded = '';
  for (let offset = 0; offset < bytes.length; offset += 3) {
    const first = bytes[offset]!;
    const second = bytes[offset + 1];
    const third = bytes[offset + 2];
    encoded += BASE64URL_ALPHABET.charAt(first >>> 2);
    encoded += BASE64URL_ALPHABET.charAt(((first & 0x03) << 4) | ((second ?? 0) >>> 4));
    if (second !== undefined) {
      encoded += BASE64URL_ALPHABET.charAt(((second & 0x0f) << 2) | ((third ?? 0) >>> 6));
    }
    if (third !== undefined) encoded += BASE64URL_ALPHABET.charAt(third & 0x3f);
  }
  return encoded;
}

async function createRequestSecret(): Promise<string> {
  const bytes = await Crypto.getRandomBytesAsync(REQUEST_SECRET_BYTES);
  if (!(bytes instanceof Uint8Array) || bytes.length !== REQUEST_SECRET_BYTES) {
    throw new Error(INVALID_APPLE_RANDOMNESS_MESSAGE);
  }
  const secret = bytesToBase64Url(bytes);
  if (!REQUEST_SECRET_PATTERN.test(secret)) {
    throw new Error(INVALID_APPLE_RANDOMNESS_MESSAGE);
  }
  return secret;
}

function isAppleRequestCancellation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'ERR_REQUEST_CANCELED'
  );
}

// Sign in with Apple. Mandatory on iOS once Google is offered (docs/01 §1,
// Apple Guideline 4.8). Apple receives the SHA-256 nonce while Supabase gets
// the raw nonce; state and the short-lived server authorization proof remain
// bound to this exact request.
// BLOCKED: B-APPLE. Needs the registered Service ID / capability to actually run.
export async function getAppleIdToken(): Promise<AppleSignInCredential | null> {
  const [nonce, state] = await Promise.all([createRequestSecret(), createRequestSecret()]);
  if (nonce === state) throw new Error(INVALID_APPLE_RANDOMNESS_MESSAGE);

  const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, nonce);
  if (!SHA256_HEX_PATTERN.test(hashedNonce)) {
    throw new Error(INVALID_APPLE_RANDOMNESS_MESSAGE);
  }

  let credential: AppleAuthentication.AppleAuthenticationCredential;
  try {
    credential = await AppleAuthentication.signInAsync({
      nonce: hashedNonce,
      requestedScopes: [AppleAuthentication.AppleAuthenticationScope.EMAIL],
      state,
    });
  } catch (error: unknown) {
    // Closing Apple's sheet is a neutral user choice, not an authentication
    // failure to render on the account screen.
    if (isAppleRequestCancellation(error)) return null;
    throw error;
  }

  if (credential.state !== state) throw new Error(INVALID_APPLE_CREDENTIAL_MESSAGE);

  const idToken = boundedRequiredString(credential.identityToken, MAX_APPLE_ID_TOKEN_CHARS);
  const authorizationCode = boundedRequiredString(
    credential.authorizationCode,
    MAX_APPLE_AUTHORIZATION_CODE_CHARS,
  );
  const appleUser = boundedRequiredString(credential.user, MAX_APPLE_USER_CHARS);

  // NOTE: email is only returned on the FIRST authorization for a given Apple ID.
  return {
    appleUser,
    authorizationCode,
    email: boundedOptionalEmail(credential.email),
    idToken,
    nonce,
  };
}

export async function getAppleAuthorizationCodeForRevocation(user: User): Promise<string | null> {
  const appleUser = getAppleCredentialSubject(user);
  if (!appleUser) return null;
  if (!(await AppleAuthentication.isAvailableAsync())) return null;

  const credential = await AppleAuthentication.refreshAsync({ user: appleUser });
  return optionalString(credential.authorizationCode);
}

export const isAppleAuthAvailable = AppleAuthentication.isAvailableAsync;
