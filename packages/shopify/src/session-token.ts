import { type Result, err, ok, ValidationError } from "@partnera/core";
import { normalizeShopDomain, type ShopDomain } from "./shop";

/**
 * App Bridge **session token** verification. The embedded app sends a signed JWT
 * on every request; the host verifies it and derives the shop from `dest` — the
 * browser never dictates the tenant. Real verification checks the JWT signature
 * (app secret), `aud` (API key), `exp`, and `dest`/`iss` host. A fake verifier is
 * used in tests. The verified claims resolve shop → installation → tenant → user
 * → permissions → RequestContext (see the web host).
 */
export interface SessionTokenClaims {
  readonly shop: ShopDomain;
  /** Shopify user id (`sub`); mapped to a Partnera user by the host. */
  readonly subject: string;
  readonly expiresAt: number; // epoch seconds
}

export interface SessionTokenVerifier {
  /** Verify a raw App Bridge JWT and return its claims, or an error. */
  verify(token: string, nowEpochSec: number): Result<SessionTokenClaims, ValidationError>;
}

/**
 * A fake verifier for tests/local: accepts tokens of the form
 * `dest.<shop>|sub.<subject>|exp.<epoch>` and rejects malformed/expired ones.
 * The real verifier (deploy) checks the JWT signature with the app secret.
 */
export class FakeSessionTokenVerifier implements SessionTokenVerifier {
  verify(token: string, nowEpochSec: number): Result<SessionTokenClaims, ValidationError> {
    const parts = Object.fromEntries(
      token.split("|").map((p) => {
        const i = p.indexOf(".");
        return [p.slice(0, i), p.slice(i + 1)];
      }),
    );
    const norm = normalizeShopDomain(parts.dest ?? "");
    if (!norm.ok) return err(new ValidationError("session token: bad dest", {}));
    if (!parts.sub) return err(new ValidationError("session token: missing sub", {}));
    const exp = Number(parts.exp ?? 0);
    if (!Number.isFinite(exp) || exp <= nowEpochSec) return err(new ValidationError("session token: expired", { exp }));
    return ok({ shop: norm.value, subject: parts.sub, expiresAt: exp });
  }
}
