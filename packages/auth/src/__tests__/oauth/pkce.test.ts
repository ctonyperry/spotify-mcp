import { describe, it, expect } from 'vitest';
import { generatePkceChallenge, verifyPkceChallenge } from '../../oauth/pkce.js';

describe('PKCE Helpers', () => {
  describe('generatePkceChallenge', () => {
    it('should generate valid PKCE challenge', () => {
      const challenge = generatePkceChallenge();
      
      expect(challenge.codeVerifier).toMatch(/^[A-Za-z0-9_-]+$/);
      expect(challenge.codeChallenge).toMatch(/^[A-Za-z0-9_-]+$/);
      expect(challenge.codeChallengeMethod).toBe('S256');
      
      // Code verifier should be 43-128 characters (RFC 7636)
      expect(challenge.codeVerifier.length).toBeGreaterThanOrEqual(43);
      expect(challenge.codeVerifier.length).toBeLessThanOrEqual(128);
      
      // Code challenge should be 43 characters (base64url of SHA256)
      expect(challenge.codeChallenge).toHaveLength(43);
    });

    it('should generate unique challenges', () => {
      const challenges = Array.from({ length: 100 }, () => generatePkceChallenge());
      
      const verifiers = challenges.map(c => c.codeVerifier);
      const uniqueVerifiers = new Set(verifiers);
      expect(uniqueVerifiers.size).toBe(100);
      
      const challengeCodes = challenges.map(c => c.codeChallenge);
      const uniqueChallenges = new Set(challengeCodes);
      expect(uniqueChallenges.size).toBe(100);
    });
  });

  describe('verifyPkceChallenge', () => {
    it('should verify valid challenge pairs', () => {
      const challenge = generatePkceChallenge();
      
      const isValid = verifyPkceChallenge(challenge.codeVerifier, challenge.codeChallenge);
      expect(isValid).toBe(true);
    });

    it('should reject invalid challenge pairs', () => {
      const challenge1 = generatePkceChallenge();
      const challenge2 = generatePkceChallenge();
      
      const isValid = verifyPkceChallenge(challenge1.codeVerifier, challenge2.codeChallenge);
      expect(isValid).toBe(false);
    });

    it('should work with known test vectors', () => {
      // Known PKCE test vector
      const codeVerifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
      const expectedChallenge = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';
      
      const isValid = verifyPkceChallenge(codeVerifier, expectedChallenge);
      expect(isValid).toBe(true);
    });
  });
});