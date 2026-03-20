/**
 * Tink Investments API
 *
 * Access investment portfolio data including accounts and individual holdings.
 *
 * Required scopes: `accounts:read`, `investment-accounts:readonly`
 * https://docs.tink.com/api#investments
 */
import type { HttpClient } from "../utils/http";
import type { InvestmentAccount, InvestmentAccountsResponse, HoldingsResponse } from "../types";

export class Investments {
  constructor(private readonly http: HttpClient) {}

  /**
   * Lists all investment accounts (brokerage, ISA, pension, etc.).
   *
   * @example
   * ```ts
   * const { accounts } = await tink.investments.listAccounts();
   * const totalValue = accounts.reduce((sum, acc) => {
   *   return sum + parseFloat(acc.balance?.amount.value ?? "0");
   * }, 0);
   * ```
   */
  async listAccounts(): Promise<InvestmentAccountsResponse> {
    return this.http.get<InvestmentAccountsResponse>("/data/v2/investment-accounts");
  }

  /**
   * Gets details for a single investment account.
   *
   * @param accountId - Investment account ID
   */
  async getAccount(accountId: string): Promise<InvestmentAccount> {
    return this.http.get<InvestmentAccount>(`/data/v2/investment-accounts/${accountId}`);
  }

  /**
   * Gets all holdings (positions) for an investment account.
   * Returns stocks, bonds, funds, ETFs, and other instruments.
   *
   * @param accountId - Investment account ID
   *
   * @example
   * ```ts
   * const { holdings } = await tink.investments.getHoldings(accountId);
   * const stocks = holdings.filter(h => h.instrument?.type === "STOCK");
   * ```
   */
  async getHoldings(accountId: string): Promise<HoldingsResponse> {
    return this.http.get<HoldingsResponse>(`/data/v2/investment-accounts/${accountId}/holdings`);
  }
}
