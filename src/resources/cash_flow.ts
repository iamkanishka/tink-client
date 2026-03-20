/**
 * Tink Cash Flow API
 *
 * Income vs expense summaries across configurable time resolutions.
 * Useful for cash flow analysis, savings rate tracking, and financial health.
 *
 * Requires a user bearer token (not client credentials).
 * https://docs.tink.com/api#finance-management/cash-flow
 */
import type { HttpClient } from "../utils/http";
import type { CashFlowResponse, CashFlowOpts } from "../types";
import { buildUrl } from "../utils/helpers";

export class CashFlow {
  constructor(private readonly http: HttpClient) {}

  /**
   * Gets cash flow summaries for a date range at the given resolution.
   *
   * @example
   * ```ts
   * const { periods } = await tink.cashFlow.getSummaries({
   *   resolution: "MONTHLY",
   *   fromGte: "2024-01-01",
   *   toLte: "2024-12-31",
   * });
   * for (const p of periods) {
   *   console.log(p.periodStart, p.income?.amount, p.expenses?.amount);
   * }
   * ```
   *
   * Resolutions:
   * - `DAILY` — one entry per day (good for detailed tracking)
   * - `WEEKLY` — one entry per week
   * - `MONTHLY` — one entry per calendar month (most common)
   * - `YEARLY` — one entry per year (good for annual reviews)
   */
  async getSummaries(opts: CashFlowOpts): Promise<CashFlowResponse> {
    const params = { from_gte: opts.fromGte, to_lte: opts.toLte };
    return this.http.get<CashFlowResponse>(
      buildUrl(`/finance-management/v1/cash-flow-summaries/${opts.resolution}`, params)
    );
  }
}
