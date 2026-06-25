/**
 * Finance application service — budgets, cash flow, financial calendar.
 *
 * Endpoints:
 *   GET    /pfm/v1/budgets
 *   POST   /pfm/v1/budgets
 *   GET    /pfm/v1/budgets/{id}
 *   PUT    /pfm/v1/budgets/{id}
 *   DELETE /pfm/v1/budgets/{id}
 *   GET    /pfm/v1/budgets/{id}/history
 *   GET    /pfm/v1/statistics/expenses-and-income-for-categories
 *   GET    /pfm/v1/calendar/events
 *   POST   /pfm/v1/calendar/events
 *   GET    /pfm/v1/calendar/events/{id}
 *   DELETE /pfm/v1/calendar/events/{id}
 *   GET    /pfm/v1/calendar/summaries
 */

import { TinkError } from "../domain/errors.js";
import type {
  Budget,
  BudgetHistoryResponse,
  BudgetsListOpts,
  BudgetsResponse,
  CalendarEvent,
  CalendarEventsResponse,
  CalendarSummariesOpts,
  CashFlowOpts,
  CashFlowResponse,
  CreateBudgetParams,
  CreateCalendarEventParams,
} from "../domain/types.js";
import type { HttpClient } from "../infrastructure/http.js";
import { buildParams } from "./accounts.js";

const BUDGETS_PATH = "/pfm/v1/budgets";
const CASH_FLOW_PATH = "/pfm/v1/statistics/expenses-and-income-for-categories";
const CALENDAR_EVENTS_PATH = "/pfm/v1/calendar/events";
const CALENDAR_SUMMARIES_PATH = "/pfm/v1/calendar/summaries";

const BUDGET_CACHE_TTL_MS = 5 * 60 * 1_000;
const CASH_FLOW_CACHE_TTL_MS = 10 * 60 * 1_000;

/** Finance application service. */
export class FinanceService {
  constructor(private readonly http: HttpClient) {}

  // ── Budgets ──────────────────────────────────────────────────────────────────

  /** Lists all budgets for the authenticated user. */
  async listBudgets(opts: BudgetsListOpts = {}): Promise<BudgetsResponse> {
    const p = buildParams({
      pageToken: opts.pageToken,
      pageSize: opts.pageSize,
      progressStatusIn: opts.progressStatusIn?.join(","),
    });
    return this.http.get<BudgetsResponse>(BUDGETS_PATH + p, { cacheTtlMs: BUDGET_CACHE_TTL_MS });
  }

  /** Creates a new budget. */
  async createBudget(params: CreateBudgetParams): Promise<Budget> {
    if (!params.title) throw TinkError.validation("budget title is required");
    if (!params.type) throw TinkError.validation("budget type is required");
    return this.http.post<Budget>(BUDGETS_PATH, params);
  }

  /** Fetches a single budget by ID. */
  async getBudget(budgetId: string): Promise<Budget> {
    if (!budgetId) throw TinkError.validation("budgetId is required");
    return this.http.get<Budget>(`${BUDGETS_PATH}/${budgetId}`, {
      cacheTtlMs: BUDGET_CACHE_TTL_MS,
    });
  }

  /** Updates a budget by ID. */
  async updateBudget(budgetId: string, params: CreateBudgetParams): Promise<Budget> {
    if (!budgetId) throw TinkError.validation("budgetId is required");
    return this.http.put<Budget>(`${BUDGETS_PATH}/${budgetId}`, params);
  }

  /** Deletes a budget by ID. */
  async deleteBudget(budgetId: string): Promise<void> {
    if (!budgetId) throw TinkError.validation("budgetId is required");
    return this.http.delete(`${BUDGETS_PATH}/${budgetId}`);
  }

  /** Fetches spending history across all periods for a budget. */
  async getBudgetHistory(budgetId: string): Promise<BudgetHistoryResponse> {
    if (!budgetId) throw TinkError.validation("budgetId is required");
    return this.http.get<BudgetHistoryResponse>(`${BUDGETS_PATH}/${budgetId}/history`, {
      cacheTtlMs: false,
    });
  }

  // ── Cash flow ─────────────────────────────────────────────────────────────────

  /** Fetches income vs expense summaries for the given period and resolution. */
  async getCashFlow(opts: CashFlowOpts): Promise<CashFlowResponse> {
    const p = buildParams({
      resolution: opts.resolution,
      fromGte: opts.fromGte,
      toLte: opts.toLte,
    });
    return this.http.get<CashFlowResponse>(CASH_FLOW_PATH + p, {
      cacheTtlMs: CASH_FLOW_CACHE_TTL_MS,
    });
  }

  // ── Financial calendar ────────────────────────────────────────────────────────

  /** Lists all financial calendar events for the authenticated user. */
  async listCalendarEvents(): Promise<CalendarEventsResponse> {
    return this.http.get<CalendarEventsResponse>(CALENDAR_EVENTS_PATH, { cacheTtlMs: false });
  }

  /** Creates a new financial calendar event. */
  async createCalendarEvent(params: CreateCalendarEventParams): Promise<CalendarEvent> {
    if (!params.title) throw TinkError.validation("event title is required");
    return this.http.post<CalendarEvent>(CALENDAR_EVENTS_PATH, params);
  }

  /** Fetches a single calendar event by ID. */
  async getCalendarEvent(eventId: string): Promise<CalendarEvent> {
    if (!eventId) throw TinkError.validation("eventId is required");
    return this.http.get<CalendarEvent>(`${CALENDAR_EVENTS_PATH}/${eventId}`, {
      cacheTtlMs: false,
    });
  }

  /** Deletes a calendar event by ID. */
  async deleteCalendarEvent(eventId: string): Promise<void> {
    if (!eventId) throw TinkError.validation("eventId is required");
    return this.http.delete(`${CALENDAR_EVENTS_PATH}/${eventId}`);
  }

  /** Fetches periodic financial summaries from the calendar. */
  async getCalendarSummaries(opts: CalendarSummariesOpts): Promise<Record<string, unknown>> {
    const p = buildParams({
      resolution: opts.resolution,
      periodGte: opts.periodGte,
      periodLte: opts.periodLte,
    });
    return this.http.get<Record<string, unknown>>(CALENDAR_SUMMARIES_PATH + p, {
      cacheTtlMs: CASH_FLOW_CACHE_TTL_MS,
    });
  }
}
