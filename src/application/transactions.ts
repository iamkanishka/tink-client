/**
 * Transactions application service.
 *
 * Endpoints:
 *   GET  /data/v2/transactions
 *   GET  /data/v2/transactions/{id}
 *   GET  /enrichment/v1/transactions    (default 10/page, max 100/page)
 *   GET  /api/v1/categories
 *   GET  /api/v1/categories/{id}
 *   POST /api/v1/statistics/query
 */

import { TinkError } from "../domain/errors.js";
import type {
  CategoriesResponse,
  Category,
  EnrichedTransactionsOpts,
  StatisticsOpts,
  StatisticsResponse,
  Transaction,
  TransactionsListOpts,
  TransactionsResponse,
} from "../domain/types.js";
import type { HttpClient } from "../infrastructure/http.js";
import { buildParams } from "./accounts.js";

const TRANSACTIONS_PATH = "/data/v2/transactions";
const ENRICHMENT_PATH = "/enrichment/v1/transactions";
const CATEGORIES_PATH = "/api/v1/categories";
const STATISTICS_PATH = "/api/v1/statistics/query";

const TXN_CACHE_TTL_MS = 2 * 60 * 1_000;
const CAT_CACHE_TTL_MS = 60 * 60 * 1_000; // categories rarely change

/** Transactions, enrichment, categories, and statistics service. */
export class TransactionsService {
  constructor(private readonly http: HttpClient) {}

  // ── Transactions ─────────────────────────────────────────────────────────────

  /** Fetches one page of transactions. */
  async list(opts: TransactionsListOpts = {}): Promise<TransactionsResponse> {
    const p = buildParams({
      pageToken: opts.pageToken,
      pageSize: opts.pageSize,
      accountIdIn: opts.accountIdIn?.join(","),
      bookedDateGte: opts.bookedDateGte,
      bookedDateLte: opts.bookedDateLte,
      statusIn: opts.statusIn?.join(","),
      categoryIdIn: opts.categoryIdIn?.join(","),
    });
    return this.http.get<TransactionsResponse>(TRANSACTIONS_PATH + p, {
      cacheTtlMs: TXN_CACHE_TTL_MS,
    });
  }

  /** Fetches all transactions, following `nextPageToken` automatically. */
  async listAll(opts: Omit<TransactionsListOpts, "pageToken"> = {}): Promise<Transaction[]> {
    const all: Transaction[] = [];
    let pageToken: string | undefined;
    do {
      const resp = await this.list({ ...opts, ...(pageToken ? { pageToken } : {}) });
      all.push(...resp.transactions);
      pageToken = resp.nextPageToken;
    } while (pageToken);
    return all;
  }

  /** Fetches a single transaction by ID. */
  async get(transactionId: string): Promise<Transaction> {
    if (!transactionId) throw TinkError.validation("transactionId is required");
    return this.http.get<Transaction>(`${TRANSACTIONS_PATH}/${transactionId}`, {
      cacheTtlMs: TXN_CACHE_TTL_MS,
    });
  }

  // ── Enriched transactions ─────────────────────────────────────────────────────

  /**
   * Fetches a page of enriched transactions from the Tink Enrichment API.
   *
   * Per the Tink docs, `pageSize` defaults to 10 and is capped at 100 per request.
   */
  async listEnriched(opts: EnrichedTransactionsOpts = {}): Promise<TransactionsResponse> {
    const p = buildParams({
      pageToken: opts.pageToken,
      pageSize: opts.pageSize,
      accountIdIn: opts.accountIdIn?.join(","),
      dateGte: opts.dateGte,
      dateLte: opts.dateLte,
    });
    return this.http.get<TransactionsResponse>(ENRICHMENT_PATH + p, {
      cacheTtlMs: TXN_CACHE_TTL_MS,
    });
  }

  /** Fetches all enriched transactions, following `nextPageToken` automatically. */
  async listAllEnriched(
    opts: Omit<EnrichedTransactionsOpts, "pageToken"> = {},
  ): Promise<Transaction[]> {
    const all: Transaction[] = [];
    let pageToken: string | undefined;
    do {
      const resp = await this.listEnriched({ ...opts, ...(pageToken ? { pageToken } : {}) });
      all.push(...resp.transactions);
      pageToken = resp.nextPageToken;
    } while (pageToken);
    return all;
  }

  // ── Categories ────────────────────────────────────────────────────────────────

  /** Fetches all transaction categories. Cached for 1 hour. */
  async listCategories(): Promise<CategoriesResponse> {
    return this.http.get<CategoriesResponse>(CATEGORIES_PATH, {
      cacheTtlMs: CAT_CACHE_TTL_MS,
    });
  }

  /** Fetches a single category by ID. */
  async getCategory(categoryId: string): Promise<Category> {
    if (!categoryId) throw TinkError.validation("categoryId is required");
    return this.http.get<Category>(`${CATEGORIES_PATH}/${categoryId}`, {
      cacheTtlMs: CAT_CACHE_TTL_MS,
    });
  }

  // ── Statistics ─────────────────────────────────────────────────────────────

  /** Posts a statistics query and returns aggregated period data. */
  async queryStatistics(opts: StatisticsOpts): Promise<StatisticsResponse> {
    return this.http.post<StatisticsResponse>(STATISTICS_PATH, {
      periodGte: opts.periodGte,
      periodLte: opts.periodLte,
      resolution: opts.resolution ?? "MONTHLY",
      accountIdIn: opts.accountIdIn,
      categoryIdIn: opts.categoryIdIn,
    });
  }
}
