/**
 * Providers application service.
 *
 * Endpoints:
 *   GET /api/v1/providers
 *   GET /api/v1/providers/{providerName}/status
 */

import { TinkError } from "../domain/errors.js";
import type {
  Provider,
  ProvidersListOpts,
  ProvidersResponse,
  ProviderStatusResult,
} from "../domain/types.js";
import type { HttpClient } from "../infrastructure/http.js";
import { buildParams } from "./accounts.js";

const PROVIDERS_PATH = "/api/v1/providers";
const CACHE_TTL_MS = 60 * 60 * 1_000; // providers change infrequently

/** Providers application service. */
export class ProvidersService {
  constructor(private readonly http: HttpClient) {}

  /** Lists all providers optionally filtered by market and capabilities. */
  async list(opts: ProvidersListOpts = {}): Promise<ProvidersResponse> {
    const p = buildParams({
      market: opts.market,
      capabilities: opts.capabilities?.join(","),
    });
    return this.http.get<ProvidersResponse>(PROVIDERS_PATH + p, { cacheTtlMs: CACHE_TTL_MS });
  }

  /** Fetches the connectivity status of a single provider by name. */
  async getStatus(providerName: string): Promise<ProviderStatusResult> {
    if (!providerName) throw TinkError.validation("providerName is required");
    const provider = await this.http.get<Provider>(`${PROVIDERS_PATH}/${providerName}/status`, {
      cacheTtlMs: false,
    });
    return { active: provider.status === "ENABLED", provider };
  }
}
