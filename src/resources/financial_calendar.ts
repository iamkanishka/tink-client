/**
 * Tink Financial Calendar API
 *
 * Schedule and track financial events such as bills, salary payments, and
 * recurring expenses. Supports attachments (invoice PDFs), recurring event
 * groups, and transaction reconciliation.
 *
 * Requires a user bearer token (not client credentials).
 * https://docs.tink.com/api#finance-management/financial-calendar
 */
import type { HttpClient } from "../utils/http";
import type {
  CalendarEvent,
  CalendarEventsResponse,
  CreateCalendarEventParams,
  CalendarSummariesOpts,
} from "../types";
import { buildUrl } from "../utils/helpers";

const EVENTS_BASE = "/finance-management/v1/financial-calendar-events";
const SUMMARIES = "/finance-management/v1/financial-calendar-summaries";

export class FinancialCalendar {
  constructor(private readonly http: HttpClient) {}

  /**
   * Creates a new financial calendar event (bill, income, etc.).
   *
   * @example
   * ```ts
   * const event = await tink.financialCalendar.createEvent({
   *   title: "Electricity Bill",
   *   dueDate: "2024-02-15",
   *   eventAmount: {
   *     currencyCode: "GBP",
   *     value: { unscaledValue: 12500, scale: 2 }, // £125.00
   *   },
   * });
   * ```
   */
  async createEvent(params: CreateCalendarEventParams): Promise<CalendarEvent> {
    return this.http.post<CalendarEvent>(EVENTS_BASE, params);
  }

  /**
   * Gets a single calendar event by ID.
   */
  async getEvent(eventId: string): Promise<CalendarEvent> {
    return this.http.get<CalendarEvent>(`${EVENTS_BASE}/${eventId}`);
  }

  /**
   * Updates a calendar event's title, amount, or due date.
   */
  async updateEvent(
    eventId: string,
    updates: Partial<CreateCalendarEventParams>
  ): Promise<CalendarEvent> {
    return this.http.patch<CalendarEvent>(`${EVENTS_BASE}/${eventId}`, updates);
  }

  /**
   * Lists calendar events with optional filtering and pagination.
   *
   * @example
   * ```ts
   * const { events } = await tink.financialCalendar.listEvents({
   *   due_date_gte: "2024-02-01",
   *   due_date_lte: "2024-02-29",
   * });
   * ```
   */
  async listEvents(opts: Record<string, unknown> = {}): Promise<CalendarEventsResponse> {
    return this.http.get<CalendarEventsResponse>(buildUrl(EVENTS_BASE, opts));
  }

  /**
   * Deletes a calendar event.
   *
   * @param opts.recurring - Which occurrences to delete:
   *   - `"SINGLE"` (default) — only this event
   *   - `"THIS_AND_FOLLOWING"` — this and all future occurrences
   *   - `"ALL"` — all occurrences in the recurring group
   */
  async deleteEvent(eventId: string, opts: { recurring?: string } = {}): Promise<void> {
    const recurring = opts.recurring ?? "SINGLE";
    await this.http.delete(`${EVENTS_BASE}/${eventId}/?recurring=${recurring}`);
  }

  /**
   * Gets summarised calendar data for a period at a given resolution.
   */
  async getSummaries(opts: CalendarSummariesOpts): Promise<unknown> {
    const params = { period_gte: opts.periodGte, period_lte: opts.periodLte };
    return this.http.get(buildUrl(`${SUMMARIES}/${opts.resolution}`, params));
  }

  /**
   * Adds an attachment (e.g. an invoice PDF URL) to a calendar event.
   */
  async addAttachment(eventId: string, params: Record<string, unknown>): Promise<unknown> {
    return this.http.post(`${EVENTS_BASE}/${eventId}/attachments`, params);
  }

  /**
   * Removes an attachment from a calendar event.
   */
  async deleteAttachment(eventId: string, attachmentId: string): Promise<void> {
    await this.http.delete(`${EVENTS_BASE}/${eventId}/attachments/${attachmentId}/`);
  }

  /**
   * Creates a recurring event group for an existing event.
   * Use this to set up recurring bills, salaries, etc.
   *
   * @param params.rrulePattern - iCalendar RRULE pattern (e.g. "FREQ=MONTHLY;COUNT=12")
   */
  async createRecurringGroup(eventId: string, params: Record<string, unknown>): Promise<unknown> {
    return this.http.post(`${EVENTS_BASE}/${eventId}/recurring-group`, params);
  }

  /**
   * Creates a reconciliation link between a calendar event and an actual transaction.
   */
  async createReconciliation(eventId: string, params: Record<string, unknown>): Promise<unknown> {
    return this.http.post(`${EVENTS_BASE}/${eventId}/reconciliations`, params);
  }

  /**
   * Gets reconciliation details for an event.
   */
  async getReconciliationDetails(eventId: string): Promise<unknown> {
    return this.http.get(`${EVENTS_BASE}/${eventId}/reconciliations/details`);
  }

  /**
   * Gets AI-suggested transactions to reconcile with an event.
   */
  async getReconciliationSuggestions(eventId: string): Promise<unknown> {
    return this.http.get(`${EVENTS_BASE}/${eventId}/reconciliations/suggestions`);
  }

  /**
   * Removes a reconciliation link between an event and a transaction.
   */
  async deleteReconciliation(eventId: string, transactionId: string): Promise<void> {
    await this.http.delete(`${EVENTS_BASE}/${eventId}/reconciliations/${transactionId}`);
  }
}
