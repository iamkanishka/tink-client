/**
 * Connectivity application service.
 *
 * Endpoints:
 *   GET  /monitoring/v1/credentials
 *   GET  /connector/v1/users/{externalUserId}/accounts/{id}/connectivity
 *   POST /connector/v1/users/{externalUserId}/accounts
 *   POST /connector/v1/users/{externalUserId}/transactions
 *   POST /api/v1/user/create  (connector user creation)
 *
 * Also provides Tink Link URL builders for all products.
 */

import { TinkError } from "../domain/errors.js";
import type {
  ConnectivitySummary,
  ConnectorCreateUserParams,
  CredentialConnectivity,
  IngestAccountsParams,
  IngestTransactionsParams,
  LinkUrlParams,
  TinkUser,
} from "../domain/types.js";
import type { HttpClient } from "../infrastructure/http.js";

const MONITORING_PATH = "/monitoring/v1/credentials";
const CONNECTOR_USERS_PATH = "/connector/v1/users";
const USER_CREATE_PATH = "/api/v1/user/create";
const LINK_BASE = "https://link.tink.com/1.0";

/** Connectivity application service. */
export class ConnectivityService {
  constructor(
    private readonly http: HttpClient,
    private readonly clientId: string,
  ) {}

  // ── Connectivity monitoring ─────────────────────────────────────────────────

  /** Returns a connectivity health summary for all credentials of the authenticated user. */
  async getSummary(): Promise<ConnectivitySummary> {
    const credentials = await this.http.get<CredentialConnectivity[]>(MONITORING_PATH, {
      cacheTtlMs: false,
    });
    const healthy = credentials.filter((c) => c.healthy).length;
    return {
      credentials,
      healthy,
      unhealthy: credentials.length - healthy,
      total: credentials.length,
    };
  }

  /** Returns the connectivity status of a single credential. */
  async getCredentialConnectivity(
    externalUserId: string,
    accountId: string,
  ): Promise<CredentialConnectivity> {
    if (!externalUserId) throw TinkError.validation("externalUserId is required");
    if (!accountId) throw TinkError.validation("accountId is required");
    return this.http.get<CredentialConnectivity>(
      `${CONNECTOR_USERS_PATH}/${externalUserId}/accounts/${accountId}/connectivity`,
      { cacheTtlMs: false },
    );
  }

  // ── Connector data ingestion ───────────────────────────────────────────────

  /** Creates a Tink user for the Connector product. */
  async createConnectorUser(params: ConnectorCreateUserParams): Promise<TinkUser> {
    if (!params.externalUserId) throw TinkError.validation("externalUserId is required");
    return this.http.post<TinkUser>(USER_CREATE_PATH, params);
  }

  /** Ingests account data for a user via the Connector API. */
  async ingestAccounts(externalUserId: string, params: IngestAccountsParams): Promise<void> {
    if (!externalUserId) throw TinkError.validation("externalUserId is required");
    if (!params.accounts.length) throw TinkError.validation("at least one account is required");
    return this.http.post<void>(`${CONNECTOR_USERS_PATH}/${externalUserId}/accounts`, params);
  }

  /** Ingests transaction data for a user via the Connector API. */
  async ingestTransactions(
    externalUserId: string,
    params: IngestTransactionsParams,
  ): Promise<void> {
    if (!externalUserId) throw TinkError.validation("externalUserId is required");
    if (!params.transactionAccounts.length) {
      throw TinkError.validation("at least one transaction account is required");
    }
    return this.http.post<void>(`${CONNECTOR_USERS_PATH}/${externalUserId}/transactions`, params);
  }

  // ── Tink Link URL builders ─────────────────────────────────────────────────

  /** Builds a Tink Link URL for the bank account connection flow. */
  buildTransactionsLink(authCode: string, params: LinkUrlParams): string {
    return this.buildLink("transactions/connect-accounts", authCode, params);
  }

  /** Builds a Tink Link URL for a payment flow. */
  buildPaymentLink(params: LinkUrlParams): string {
    const p = this.baseParams(params);
    if (params.paymentRequestId) p.set("payment_request_id", params.paymentRequestId);
    return `${LINK_BASE}/pay/?${p.toString()}`;
  }

  /** Builds a Tink Link URL for any product path segment. */
  buildGenericLink(product: string, authCode: string, params: LinkUrlParams): string {
    return this.buildLink(product, authCode, params);
  }

  private buildLink(product: string, authCode: string, params: LinkUrlParams): string {
    const p = this.baseParams(params);
    if (authCode) p.set("authorization_code", authCode);
    if (params.state) p.set("state", params.state);
    if (params.inputProvider) p.set("input_provider", params.inputProvider);
    if (params.inputUsername) p.set("input_username", params.inputUsername);
    if (params.test) p.set("test", "true");
    if (params.iframe) p.set("iframe", "true");
    return `${LINK_BASE}/${product}?${p.toString()}`;
  }

  private baseParams(params: LinkUrlParams): URLSearchParams {
    const p = new URLSearchParams({
      client_id: params.clientId || this.clientId,
      redirect_uri: params.redirectUri,
      market: params.market,
    });
    if (params.locale) p.set("locale", params.locale);
    return p;
  }
}
