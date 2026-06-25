/**
 * Accounts application service.
 *
 * Endpoints:
 *   GET    /data/v2/accounts
 *   GET    /data/v2/accounts/{id}
 *   GET    /api/v1/credentials
 *   GET    /api/v1/credentials/{id}
 *   DELETE /api/v1/credentials/{id}
 *   GET    /data/v2/identity
 */

import { TinkError } from "../domain/errors.js";
import type {
  Account,
  AccountsListOpts,
  AccountsResponse,
  Credential,
  CredentialsResponse,
  IdentityResponse,
} from "../domain/types.js";
import type { HttpClient } from "../infrastructure/http.js";

const ACCOUNTS_PATH = "/data/v2/accounts";
const CREDENTIALS_PATH = "/api/v1/credentials";
const IDENTITY_PATH = "/data/v2/identity";

const CACHE_TTL_MS = 5 * 60 * 1_000;
const IDENTITY_CACHE_TTL_MS = 15 * 60 * 1_000;

/** Accounts application service. */
export class AccountsService {
  constructor(private readonly http: HttpClient) {}

  // ── Accounts ────────────────────────────────────────────────────────────────

  /** Fetches one page of accounts. */
  async list(opts: AccountsListOpts = {}): Promise<AccountsResponse> {
    const p = buildParams({
      pageToken: opts.pageToken,
      pageSize: opts.pageSize,
      typeIn: opts.typeIn?.join(","),
    });
    return this.http.get<AccountsResponse>(ACCOUNTS_PATH + p, { cacheTtlMs: CACHE_TTL_MS });
  }

  /** Fetches all accounts, following `nextPageToken` automatically. */
  async listAll(opts: Omit<AccountsListOpts, "pageToken"> = {}): Promise<Account[]> {
    const all: Account[] = [];
    let pageToken: string | undefined;
    do {
      const resp = await this.list({ ...opts, ...(pageToken ? { pageToken } : {}) });
      all.push(...resp.accounts);
      pageToken = resp.nextPageToken;
    } while (pageToken);
    return all;
  }

  /** Fetches a single account by ID. */
  async get(accountId: string): Promise<Account> {
    if (!accountId) throw TinkError.validation("accountId is required");
    return this.http.get<Account>(`${ACCOUNTS_PATH}/${accountId}`, { cacheTtlMs: CACHE_TTL_MS });
  }

  // ── Credentials ─────────────────────────────────────────────────────────────

  /** Fetches all bank connections for the authenticated user. */
  async listCredentials(): Promise<CredentialsResponse> {
    return this.http.get<CredentialsResponse>(CREDENTIALS_PATH, { cacheTtlMs: false });
  }

  /** Fetches a single credential by ID. */
  async getCredential(credentialId: string): Promise<Credential> {
    if (!credentialId) throw TinkError.validation("credentialId is required");
    return this.http.get<Credential>(`${CREDENTIALS_PATH}/${credentialId}`, { cacheTtlMs: false });
  }

  /** Deletes a credential (removes the bank connection). */
  async deleteCredential(credentialId: string): Promise<void> {
    if (!credentialId) throw TinkError.validation("credentialId is required");
    return this.http.delete(`${CREDENTIALS_PATH}/${credentialId}`);
  }

  // ── Identity ─────────────────────────────────────────────────────────────────

  /** Fetches identity data (name, DOB) for the authenticated user. */
  async getIdentity(): Promise<IdentityResponse> {
    return this.http.get<IdentityResponse>(IDENTITY_PATH, {
      cacheTtlMs: IDENTITY_CACHE_TTL_MS,
    });
  }
}

// ── Shared helper ────────────────────────────────────────────────────────────

export function buildParams(raw: Record<string, string | number | undefined>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(raw)) {
    if (v !== undefined && v !== "" && v !== 0) p.set(k, String(v));
  }
  const s = p.toString();
  return s ? `?${s}` : "";
}
