/**
 * Tink Loans API
 *
 * Access loan and mortgage account information including balances,
 * interest rates, payment schedules, and maturity dates.
 *
 * Required scopes: `accounts:read`, `loan-accounts:readonly`
 * https://docs.tink.com/api#loans
 */
import type { HttpClient } from "../utils/http";
import type { LoanAccount, LoanAccountsResponse } from "../types";

export class Loans {
  constructor(private readonly http: HttpClient) {}

  /**
   * Lists all loan accounts (mortgages, personal loans, auto loans, etc.).
   *
   * @example
   * ```ts
   * const { accounts } = await tink.loans.listAccounts();
   * const totalDebt = accounts.reduce((sum, loan) => {
   *   return sum + Math.abs(parseFloat(loan.balance?.amount.value ?? "0"));
   * }, 0);
   * ```
   */
  async listAccounts(): Promise<LoanAccountsResponse> {
    return this.http.get<LoanAccountsResponse>("/data/v2/loan-accounts");
  }

  /**
   * Gets detailed information for a single loan account.
   * Includes interest rate, monthly payment, remaining term, and payment history.
   *
   * @param accountId - Loan account ID
   */
  async getAccount(accountId: string): Promise<LoanAccount> {
    return this.http.get<LoanAccount>(`/data/v2/loan-accounts/${accountId}`);
  }
}
