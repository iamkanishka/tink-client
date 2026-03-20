/**
 * Tink Business Finance Management — Budgets API
 *
 * Create and track financial budgets for income or expense categories.
 * Supports one-off and recurring budgets with flexible allocation rules.
 *
 * Requires a user bearer token (not client credentials).
 * https://docs.tink.com/api#finance-management
 */
import type { HttpClient } from "../utils/http";
import type {
  Budget,
  BudgetsResponse,
  BudgetHistoryResponse,
  CreateBudgetParams,
  BudgetsListOpts,
} from "../types";
import { buildUrl } from "../utils/helpers";

const BASE = "/finance-management/v1/business-budgets";

export class Budgets {
  constructor(private readonly http: HttpClient) {}

  /**
   * Creates a new budget.
   *
   * @example
   * ```ts
   * const budget = await tink.budgets.createBudget({
   *   title: "Office Supplies",
   *   type: "EXPENSE",
   *   targetAmount: {
   *     value: { unscaledValue: 50000, scale: 2 }, // £500.00
   *     currencyCode: "GBP",
   *   },
   *   recurrence: { frequency: "MONTHLY", start: "2024-01-01" },
   * });
   * ```
   */
  async createBudget(params: CreateBudgetParams): Promise<Budget> {
    return this.http.post<Budget>(BASE, params);
  }

  /**
   * Gets a budget by ID.
   */
  async getBudget(budgetId: string): Promise<Budget> {
    return this.http.get<Budget>(`${BASE}/${budgetId}`);
  }

  /**
   * Gets the spending history for a budget across all past periods.
   * Useful for trend analysis and budget performance reports.
   */
  async getBudgetHistory(budgetId: string): Promise<BudgetHistoryResponse> {
    return this.http.get<BudgetHistoryResponse>(`${BASE}/${budgetId}/history`);
  }

  /**
   * Lists all budgets with optional status filter.
   *
   * @example
   * ```ts
   * // Get only over-budget items
   * const { budgets } = await tink.budgets.listBudgets({
   *   progressStatusIn: ["OVER_BUDGET"],
   * });
   * ```
   */
  async listBudgets(opts: BudgetsListOpts = {}): Promise<BudgetsResponse> {
    return this.http.get<BudgetsResponse>(buildUrl(BASE, opts));
  }

  /**
   * Updates a budget's title, amount, or recurrence configuration.
   */
  async updateBudget(budgetId: string, updates: Partial<CreateBudgetParams>): Promise<Budget> {
    return this.http.patch<Budget>(`${BASE}/${budgetId}`, updates);
  }

  /**
   * Permanently deletes a budget.
   */
  async deleteBudget(budgetId: string): Promise<void> {
    await this.http.delete(`${BASE}/${budgetId}`);
  }
}
