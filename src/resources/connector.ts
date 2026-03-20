/**
 * Tink Connector API
 *
 * Ingest your own financial data into the Tink platform.
 * Use this when you already have account and transaction data
 * and want to leverage Tink's enrichment and analytics on top of it.
 *
 * Flow:
 * 1. `createUser()` — create a Tink user for the data owner
 * 2. `ingestAccounts()` — push account data for that user
 * 3. `ingestTransactions()` — push transaction data per account
 *
 * https://docs.tink.com/api#connector
 */
import type { HttpClient } from "../utils/http";
import type { TinkUser, IngestAccountsParams, IngestTransactionsParams } from "../types";

export class Connector {
  constructor(private readonly http: HttpClient) {}

  /**
   * Creates a Tink user to own the ingested data.
   * Store the returned `user_id` for subsequent ingestion calls.
   *
   * @example
   * ```ts
   * const user = await tink.connector.createUser({
   *   externalUserId: "your_internal_user_id",
   *   market: "GB",
   *   locale: "en_US",
   * });
   * ```
   */
  async createUser(params: {
    externalUserId: string;
    market: string;
    locale: string;
  }): Promise<TinkUser> {
    return this.http.post<TinkUser>("/api/v1/user/create", {
      external_user_id: params.externalUserId,
      market: params.market,
      locale: params.locale,
    });
  }

  /**
   * Ingests account data for a user.
   * Account balances and metadata are pushed to Tink for enrichment.
   *
   * @param externalUserId - Your internal user identifier
   *
   * @example
   * ```ts
   * await tink.connector.ingestAccounts("user_123", {
   *   accounts: [
   *     {
   *       externalId: "acc_1",
   *       name: "Main Checking",
   *       type: "CHECKING",
   *       balance: 1500.00,
   *     },
   *   ],
   * });
   * ```
   */
  async ingestAccounts(externalUserId: string, params: IngestAccountsParams): Promise<unknown> {
    return this.http.post(`/connector/users/${externalUserId}/accounts`, {
      accounts: params.accounts.map((a) => ({
        externalId: a.externalId,
        name: a.name,
        type: a.type,
        balance: a.balance,
        ...(a.number !== undefined ? { number: a.number } : {}),
        ...(a.availableCredit !== undefined ? { availableCredit: a.availableCredit } : {}),
        ...(a.reservedAmount !== undefined ? { reservedAmount: a.reservedAmount } : {}),
        ...(a.closed !== undefined ? { closed: a.closed } : {}),
        ...(a.flags?.length ? { flags: a.flags } : {}),
        ...(a.payload ? { payload: a.payload } : {}),
      })),
    });
  }

  /**
   * Ingests transaction data for a user's accounts.
   *
   * Use `type: "REAL_TIME"` for live transaction feeds.
   * Use `type: "BATCH"` for historical data imports.
   *
   * @param externalUserId - Your internal user identifier
   *
   * @example
   * ```ts
   * await tink.connector.ingestTransactions("user_123", {
   *   type: "REAL_TIME",
   *   transactionAccounts: [
   *     {
   *       externalId: "acc_1",
   *       balance: 1485.00,
   *       transactions: [
   *         {
   *           externalId: "txn_001",
   *           amount: -15.00,
   *           date: Date.now(),
   *           description: "Coffee Shop",
   *           type: "DEFAULT",
   *         },
   *       ],
   *     },
   *   ],
   * });
   * ```
   */
  async ingestTransactions(
    externalUserId: string,
    params: IngestTransactionsParams
  ): Promise<unknown> {
    const body: Record<string, unknown> = {
      type: params.type,
      transactionAccounts: params.transactionAccounts.map((ta) => ({
        externalId: ta.externalId,
        balance: ta.balance,
        transactions: ta.transactions.map((t) => ({
          externalId: t.externalId,
          amount: t.amount,
          date: t.date,
          description: t.description,
          type: t.type,
          ...(t.pending !== undefined ? { pending: t.pending } : {}),
          ...(t.payload ? { payload: t.payload } : {}),
        })),
        ...(ta.reservedAmount !== undefined ? { reservedAmount: ta.reservedAmount } : {}),
      })),
    };
    if (params.autoBook !== undefined) body["autoBook"] = params.autoBook;
    if (params.overridePending !== undefined) body["overridePending"] = params.overridePending;

    return this.http.post(`/connector/users/${externalUserId}/transactions`, body);
  }
}
