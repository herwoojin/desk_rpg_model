// src/lib/firebase-admin-verify.ts — Server-side Firebase ID token verification
// Uses the public Google certificates to verify Firebase tokens WITHOUT the admin SDK.
// This keeps the bundle lightweight and avoids service-account credentials.

import { createRemoteJWKSet, jwtVerify } from "jose";

const FIREBASE_PROJECT_ID = "desk-rpg";

// Google's public JWKS endpoint for Firebase tokens
const JWKS = createRemoteJWKSet(
  new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"),
);

export interface FirebaseTokenPayload {
  uid: string;
  email?: string;
  name?: string;
  picture?: string;
  email_verified?: boolean;
  firebase: {
    sign_in_provider: string;
    identities: Record<string, string[]>;
  };
}

/**
 * Verify a Firebase ID token and return the decoded payload.
 * Returns null if the token is invalid or expired.
 */
export async function verifyFirebaseToken(idToken: string): Promise<FirebaseTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(idToken, JWKS, {
      issuer: `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`,
      audience: FIREBASE_PROJECT_ID,
    });
    return payload as unknown as FirebaseTokenPayload;
  } catch (error) {
    console.error("[firebase-admin-verify] Token verification failed:", error);
    return null;
  }
}
