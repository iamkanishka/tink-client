/**
 * Tink Providers API
 *
 * List and query financial institutions (banks) supported by Tink.
 * Provider data is relatively stable and is cached for 1 hour automatically.
 *
 * https://docs.tink.com/api#providers
 */
import type { HttpClient } from "../utils/http";
import type { Provider, ProvidersResponse, ProvidersListOpts } from "../types";

export class Providers {
  constructor(private readonly http: HttpClient) {}

  /**
   * Lists available providers, optionally filtered by market or capability.
   * Results are cached for 1 hour as provider data rarely changes.
   *
   * @example
   * ```ts
   * const { providers } = await tink.providers.listProviders({ market: "GB" });
   * const activeProviders = providers.filter(p => p.status === "ENABLED");
   * ```
   */
  async listProviders(opts: ProvidersListOpts = {}): Promise<ProvidersResponse> {
    const q: Record<string, string> = {};
    if (opts.market) q["market"] = opts.market;
    if (opts.capabilities?.length) q["capabilities"] = opts.capabilities.join(",");

    const qs = Object.keys(q).length
      ? "?" +
        Object.entries(q)
          .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
          .join("&")
      : "";

    return this.http.get<ProvidersResponse>(`/api/v1/providers${qs}`);
  }

  /**
   * Gets details for a specific provider by its name identifier.
   * Result is cached for 1 hour.
   *
   * @param providerId - Provider name (e.g. "uk-ob-barclays")
   */
  async getProvider(providerId: string): Promise<Provider> {
    return this.http.get<Provider>(`/api/v1/providers/${providerId}`);
  }
}
