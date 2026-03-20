/**
 * Tink Accounts API
 *
 * Access bank account information for authenticated users including
 * account details, types, and real-time balance data.
 *
 * Required scopes: `accounts:read`, `balances:read`
 * https://docs.tink.com/api#accounts
 */
import type { HttpClient } from "../utils/http";
import type { Account, AccountsResponse, AccountBalances, AccountsListOpts } from "../types";
import { buildUrl } from "../utils/helpers";

export class Accounts {
  constructor(private readonly http: HttpClient) {}

  /**
   * Lists all accounts for the authenticated user.
   *
   * Returns checking accounts, savings accounts, credit cards, loans,
   * and investment accounts. Results are paginated — use `nextPageToken`
   * to fetch subsequent pages.
   *
   * @example
   * ```ts
   * const { accounts, nextPageToken } = await tink.accounts.listAccounts({
   *   typeIn: ["CHECKING", "SAVINGS"],
   *   pageSize: 50,
   * });
   * ```
   */
  async listAccounts(opts: AccountsListOpts = {}): Promise<AccountsResponse> {
    return this.http.get<AccountsResponse>(buildUrl("/data/v2/accounts", opts));
  }

  /**
   * Gets detailed information for a single account by ID.
   *
   * @param accountId - The Tink account ID
   */
  async getAccount(accountId: string): Promise<Account> {
    return this.http.get<Account>(`/data/v2/accounts/${accountId}`);
  }

  /**
   * Gets the current balances for a specific account.
   *
   * Returns booked (settled) and available balances. For credit cards
   * this also includes the credit limit.
   *
   * @param accountId - The Tink account ID
   */
  async getBalances(accountId: string): Promise<AccountBalances> {
    return this.http.get<AccountBalances>(`/data/v2/accounts/${accountId}/balances`);
  }
}
