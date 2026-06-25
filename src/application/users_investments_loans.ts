/**
 * Users, Investments, and Loans application services.
 *
 * Users endpoints:
 *   GET    /api/v1/user/profile
 *   POST   /api/v1/user/create
 *   DELETE /api/v1/user/{externalUserId}
 *
 * Investments endpoints:
 *   GET /data/v2/investments
 *   GET /data/v2/investments/{id}/holdings
 *
 * Loans endpoints:
 *   GET /data/v2/loans
 */

import { TinkError } from "../domain/errors.js";
import type {
  CreateUserParams,
  HoldingsResponse,
  InvestmentAccount,
  InvestmentAccountsResponse,
  LoanAccount,
  LoanAccountsResponse,
  TinkUser,
} from "../domain/types.js";
import type { HttpClient } from "../infrastructure/http.js";

// ── Users ─────────────────────────────────────────────────────────────────────

const USER_PROFILE_PATH = "/api/v1/user/profile";
const USER_CREATE_PATH = "/api/v1/user/create";
const USER_DELETE_PATH = "/api/v1/user";

/** Users application service. */
export class UsersService {
  constructor(private readonly http: HttpClient) {}

  /** Fetches the profile of the currently authenticated user. */
  async getProfile(): Promise<TinkUser> {
    return this.http.get<TinkUser>(USER_PROFILE_PATH, { cacheTtlMs: false });
  }

  /**
   * Creates a new permanent Tink user.
   * The app token must have the `user:create` scope.
   */
  async create(params: CreateUserParams): Promise<TinkUser> {
    if (!params.externalUserId) throw TinkError.validation("externalUserId is required");
    return this.http.post<TinkUser>(USER_CREATE_PATH, params);
  }

  /**
   * Permanently deletes a Tink user by external user ID.
   * The app token must have the `user:delete` scope.
   */
  async delete(externalUserId: string): Promise<void> {
    if (!externalUserId) throw TinkError.validation("externalUserId is required");
    return this.http.delete(`${USER_DELETE_PATH}/${externalUserId}`);
  }
}

// ── Investments ───────────────────────────────────────────────────────────────

const INVESTMENTS_PATH = "/data/v2/investments";
const INV_CACHE_TTL_MS = 10 * 60 * 1_000;

/** Investments application service. */
export class InvestmentsService {
  constructor(private readonly http: HttpClient) {}

  /** Fetches all investment accounts. */
  async listAccounts(): Promise<InvestmentAccountsResponse> {
    return this.http.get<InvestmentAccountsResponse>(INVESTMENTS_PATH, {
      cacheTtlMs: INV_CACHE_TTL_MS,
    });
  }

  /** Fetches all investment accounts, unwrapping pagination. */
  async listAllAccounts(): Promise<InvestmentAccount[]> {
    const resp = await this.listAccounts();
    return resp.accounts;
  }

  /** Fetches the holdings for a single investment account. */
  async getHoldings(investmentAccountId: string): Promise<HoldingsResponse> {
    if (!investmentAccountId) throw TinkError.validation("investmentAccountId is required");
    return this.http.get<HoldingsResponse>(`${INVESTMENTS_PATH}/${investmentAccountId}/holdings`, {
      cacheTtlMs: INV_CACHE_TTL_MS,
    });
  }
}

// ── Loans ─────────────────────────────────────────────────────────────────────

const LOANS_PATH = "/data/v2/loans";
const LOANS_CACHE_TTL_MS = 10 * 60 * 1_000;

/** Loans application service. */
export class LoansService {
  constructor(private readonly http: HttpClient) {}

  /** Fetches all loan accounts for the authenticated user. */
  async listAccounts(): Promise<LoanAccountsResponse> {
    return this.http.get<LoanAccountsResponse>(LOANS_PATH, { cacheTtlMs: LOANS_CACHE_TTL_MS });
  }

  /** Fetches all loan accounts, unwrapping pagination. */
  async listAllAccounts(): Promise<LoanAccount[]> {
    const resp = await this.listAccounts();
    return resp.accounts;
  }
}
