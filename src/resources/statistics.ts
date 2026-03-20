/**
 * Tink Statistics API
 *
 * Aggregated financial statistics including income, expenses, and spending
 * by category across configurable time periods and resolutions.
 * Results are cached for 1 hour.
 *
 * Required scopes: `statistics:read`, `transactions:read`
 * https://docs.tink.com/api#statistics
 */
import type { HttpClient } from "../utils/http";
import type { StatisticsResponse, StatisticsOpts } from "../types";
import { buildUrl } from "../utils/helpers";

export class Statistics {
  constructor(private readonly http: HttpClient) {}

  /**
   * Gets aggregated financial statistics for a time period.
   *
   * @example
   * ```ts
   * const stats = await tink.statistics.getStatistics({
   *   periodGte: "2024-01-01",
   *   periodLte: "2024-12-31",
   *   resolution: "MONTHLY",
   * });
   * for (const period of stats.periods) {
   *   console.log(period.period, period.income?.amount, period.expenses?.amount);
   * }
   * ```
   */
  async getStatistics(opts: StatisticsOpts): Promise<StatisticsResponse> {
    const params: Record<string, unknown> = {
      period_gte: opts.periodGte,
      period_lte: opts.periodLte,
      resolution: opts.resolution ?? "MONTHLY",
    };
    if (opts.accountIdIn?.length) params["account_id_in"] = opts.accountIdIn;
    if (opts.categoryIdIn?.length) params["category_id_in"] = opts.categoryIdIn;
    return this.http.get<StatisticsResponse>(buildUrl("/api/v1/statistics", params));
  }

  /**
   * Gets statistics filtered to a specific transaction category.
   *
   * @param categoryId - Category identifier (e.g. "expenses:food.groceries")
   */
  async getCategoryStatistics(
    categoryId: string,
    opts: StatisticsOpts
  ): Promise<StatisticsResponse> {
    const params = {
      period_gte: opts.periodGte,
      period_lte: opts.periodLte,
      resolution: opts.resolution ?? "MONTHLY",
    };
    return this.http.get<StatisticsResponse>(
      buildUrl(`/api/v1/statistics/categories/${categoryId}`, params)
    );
  }

  /**
   * Gets statistics filtered to a specific account.
   *
   * @param accountId - Tink account ID
   */
  async getAccountStatistics(accountId: string, opts: StatisticsOpts): Promise<StatisticsResponse> {
    const params = {
      period_gte: opts.periodGte,
      period_lte: opts.periodLte,
      resolution: opts.resolution ?? "MONTHLY",
    };
    return this.http.get<StatisticsResponse>(
      buildUrl(`/api/v1/statistics/accounts/${accountId}`, params)
    );
  }
}
