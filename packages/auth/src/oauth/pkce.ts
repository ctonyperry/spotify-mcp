import { randomBytes, createHash } from 'crypto';

export interface PkceChallenge {
  codeVerifier: string;
  codeChallenge: string;
  codeChallengeMethod: 'S256';
}

/**
 * Generate a cryptographically secure random code verifier for PKCE
 */
function generateCodeVerifier(): string {
  // RFC 7636 specifies 43-128 characters from [A-Z] / [a-z] / [0-9] / "-" / "." / "_" / "~"
  const buffer = randomBytes(32);
  return buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * Create a code challenge from a code verifier using SHA256
 */
function createCodeChallenge(codeVerifier: string): string {
  const hash = createHash('sha256').update(codeVerifier).digest();
  return hash
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * Generate a complete PKCE challenge with verifier and challenge
 */
export function generatePkceChallenge(): PkceChallenge {
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = createCodeChallenge(codeVerifier);
  
  return {
    codeVerifier,
    codeChallenge,
    codeChallengeMethod: 'S256',
  };
}

/**
 * Verify that a code verifier matches a code challenge
 */
export function verifyPkceChallenge(codeVerifier: string, codeChallenge: string): boolean {
  const computedChallenge = createCodeChallenge(codeVerifier);
  return computedChallenge === codeChallenge;
}