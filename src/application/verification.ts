/**
 * Verification application service.
 *
 * Covers all Tink verification products:
 *   Account Check (one-time + continuous access)
 *   Balance Check
 *   Income Check / Expense Check / Risk Insights / Risk Categorisation
 *   Business Account Check
 *
 * Endpoints:
 *   POST /link/v1/session
 *   GET  /api/v1/account-verification-reports
 *   GET  /api/v1/account-verification-reports/{id}
 *   GET  /api/v1/account-verification-reports/{id}/account-parties
 *   POST /api/v1/refresh/balance
 *   GET  /api/v1/refresh/balance/{id}
 *   GET  /v2/income-checks/{id}
 *   GET  /risk/v1/expense-checks/{id}
 *   GET  /risk/v1/risk-insights/{id}
 *   GET  /risk/v1/risk-categorisation-reports/{id}
 *   GET  /data/v1/business-account-verification-reports/{id}
 */

import { TinkError } from "../domain/errors.js";
import type {
  AccountCheckReport,
  AccountCheckReportsResponse,
  AccountCheckSession,
  AccountPartiesResponse,
  BalanceRefreshResponse,
  BalanceRefreshStatus,
  BuildAccountCheckLinkParams,
  BusinessAccountCheckReport,
  ConsentUpdateLinkParams,
  ContinuousAccessLinkParams,
  CreateSessionParams,
  ExpenseCheckReport,
  GrantUserAccessParams,
  IncomeCheckReport,
  RiskCategorisationReport,
  RiskInsightsReport,
} from "../domain/types.js";
import type { HttpClient } from "../infrastructure/http.js";

const SESSION_PATH = "/link/v1/session";
const ACCOUNT_CHECK_REPORTS_PATH = "/api/v1/account-verification-reports";
const BALANCE_REFRESH_PATH = "/api/v1/refresh/balance";
const INCOME_CHECKS_PATH = "/v2/income-checks";
const EXPENSE_CHECKS_PATH = "/risk/v1/expense-checks";
const RISK_INSIGHTS_PATH = "/risk/v1/risk-insights";
const RISK_CATEGORISATION_PATH = "/risk/v1/risk-categorisation-reports";
const BIZ_ACCOUNT_CHECK_PATH = "/data/v1/business-account-verification-reports";
const LINK_BASE = "https://link.tink.com/1.0";

/** Verification application service. */
export class VerificationService {
  constructor(
    private readonly http: HttpClient,
    private readonly clientId: string,
  ) {}

  // ── Account check (one-time) ────────────────────────────────────────────────

  /** Creates a Tink Link account check session. */
  async createSession(params: CreateSessionParams): Promise<AccountCheckSession> {
    return this.http.post<AccountCheckSession>(SESSION_PATH, params);
  }

  /** Lists account verification reports. */
  async listReports(): Promise<AccountCheckReportsResponse> {
    return this.http.get<AccountCheckReportsResponse>(ACCOUNT_CHECK_REPORTS_PATH, {
      cacheTtlMs: false,
    });
  }

  /** Fetches a single account verification report by ID. */
  async getReport(reportId: string): Promise<AccountCheckReport> {
    if (!reportId) throw TinkError.validation("reportId is required");
    return this.http.get<AccountCheckReport>(`${ACCOUNT_CHECK_REPORTS_PATH}/${reportId}`, {
      cacheTtlMs: false,
    });
  }

  /** Fetches account parties (owners) for a report. */
  async getAccountParties(reportId: string): Promise<AccountPartiesResponse> {
    if (!reportId) throw TinkError.validation("reportId is required");
    return this.http.get<AccountPartiesResponse>(
      `${ACCOUNT_CHECK_REPORTS_PATH}/${reportId}/account-parties`,
      { cacheTtlMs: false },
    );
  }

  // ── Account check (continuous access) ──────────────────────────────────────

  /** Builds a Tink Link URL for a one-time account check. */
  buildAccountCheckLink(params: BuildAccountCheckLinkParams): string {
    const p = new URLSearchParams({
      client_id: params.clientId || this.clientId,
      redirect_uri: params.redirectUri,
      market: params.market,
    });
    if (params.state) p.set("state", params.state);
    if (params.test) p.set("test", "true");
    return `${LINK_BASE}/transactions/connect-accounts?${p.toString()}`;
  }

  /** Builds a Tink Link URL for updating an existing bank consent. */
  buildConsentUpdateLink(params: ConsentUpdateLinkParams): string {
    const p = new URLSearchParams({
      client_id: params.clientId || this.clientId,
      redirect_uri: params.redirectUri,
      market: params.market,
      credentials_id: params.credentialsId,
    });
    return `${LINK_BASE}/credentials/update?${p.toString()}`;
  }

  /** Builds a Tink Link URL for the continuous-access consent flow. */
  buildContinuousAccessLink(authCode: string, params: ContinuousAccessLinkParams): string {
    const p = new URLSearchParams({
      client_id: params.clientId || this.clientId,
      redirect_uri: params.redirectUri,
      market: params.market,
      locale: params.locale,
      authorization_code: authCode,
    });
    if (params.products) p.set("products", params.products);
    return `${LINK_BASE}/transactions/connect-accounts?${p.toString()}`;
  }

  /**
   * Posts a delegated grant for account check / balance check continuous-access flows.
   * Returns the authorization code to embed in the Tink Link URL.
   */
  async grantUserAccess(
    appToken: string,
    delegatePath: string,
    params: GrantUserAccessParams,
  ): Promise<{ code: string }> {
    if (!appToken) throw TinkError.validation("app-level bearer token is required");
    if (!params.userId) throw TinkError.validation("userId is required");
    if (!params.scope) throw TinkError.validation("scope is required");

    const saved = this.http["tokenProvider"]?.();
    this.http.setToken(appToken);
    try {
      return await this.http.postForm<{ code: string }>(delegatePath, {
        user_id: params.userId,
        id_hint: params.idHint,
        scope: params.scope,
        actor_client_id: params.actorClientId ?? this.clientId,
      });
    } finally {
      this.http.setToken(saved);
    }
  }

  // ── Balance check ─────────────────────────────────────────────────────────

  /** Initiates a balance refresh for an account. */
  async initiateBalanceRefresh(accountId: string): Promise<BalanceRefreshResponse> {
    if (!accountId) throw TinkError.validation("accountId is required");
    return this.http.post<BalanceRefreshResponse>(BALANCE_REFRESH_PATH, { accountId });
  }

  /** Polls the status of a balance refresh operation. */
  async getBalanceRefreshStatus(balanceRefreshId: string): Promise<BalanceRefreshStatus> {
    if (!balanceRefreshId) throw TinkError.validation("balanceRefreshId is required");
    return this.http.get<BalanceRefreshStatus>(`${BALANCE_REFRESH_PATH}/${balanceRefreshId}`, {
      cacheTtlMs: false,
    });
  }

  // ── Risk & report products ────────────────────────────────────────────────

  /** Fetches an income check report by ID. */
  async getIncomeCheck(reportId: string): Promise<IncomeCheckReport> {
    if (!reportId) throw TinkError.validation("reportId is required");
    return this.http.get<IncomeCheckReport>(`${INCOME_CHECKS_PATH}/${reportId}`, {
      cacheTtlMs: false,
    });
  }

  /** Fetches an expense check report by ID. */
  async getExpenseCheck(reportId: string): Promise<ExpenseCheckReport> {
    if (!reportId) throw TinkError.validation("reportId is required");
    return this.http.get<ExpenseCheckReport>(`${EXPENSE_CHECKS_PATH}/${reportId}`, {
      cacheTtlMs: false,
    });
  }

  /** Fetches a risk insights report by ID. */
  async getRiskInsights(reportId: string): Promise<RiskInsightsReport> {
    if (!reportId) throw TinkError.validation("reportId is required");
    return this.http.get<RiskInsightsReport>(`${RISK_INSIGHTS_PATH}/${reportId}`, {
      cacheTtlMs: false,
    });
  }

  /** Fetches a risk categorisation report by ID. */
  async getRiskCategorisation(reportId: string): Promise<RiskCategorisationReport> {
    if (!reportId) throw TinkError.validation("reportId is required");
    return this.http.get<RiskCategorisationReport>(`${RISK_CATEGORISATION_PATH}/${reportId}`, {
      cacheTtlMs: false,
    });
  }

  /** Fetches a business account verification report by ID. */
  async getBusinessAccountCheck(reportId: string): Promise<BusinessAccountCheckReport> {
    if (!reportId) throw TinkError.validation("reportId is required");
    return this.http.get<BusinessAccountCheckReport>(`${BIZ_ACCOUNT_CHECK_PATH}/${reportId}`, {
      cacheTtlMs: false,
    });
  }
}
