/**
 * Tink Connectivity API
 *
 * Check and monitor the health of financial provider integrations
 * and user bank connections (credentials).
 *
 * Useful for:
 * - Building provider selection UIs
 * - Monitoring user connection health
 * - Proactive re-authentication prompting
 * - API health checks in production dashboards
 *
 * https://docs.tink.com/api#providers
 */
import type { HttpClient } from "../utils/http";
import type {
  Provider,
  ProvidersResponse,
  ProviderStatusResult,
  ConnectivitySummary,
  CredentialConnectivity,
} from "../types";

export class Connectivity {
  constructor(private readonly http: HttpClient) {}

  /**
   * Lists all providers available in a given market.
   * This is an unauthenticated endpoint — no token required.
   *
   * @param market - ISO 3166-1 alpha-2 market code (e.g. "GB", "SE")
   */
  async listProvidersByMarket(market: string): Promise<ProvidersResponse> {
    return this.http.get<ProvidersResponse>(`/api/v1/providers/${market}`);
  }

  /**
   * Lists providers in a market using an authenticated request.
   * May return additional data compared to the unauthenticated endpoint.
   *
   * @param market - ISO 3166-1 alpha-2 market code
   */
  async listProvidersByMarketAuthenticated(market: string): Promise<ProvidersResponse> {
    return this.http.get<ProvidersResponse>(`/api/v1/providers/${market}`);
  }

  /**
   * Checks whether a specific provider is active and operational.
   * Optionally validates that the provider belongs to the given market.
   *
   * Returns `{ active: false }` if:
   * - The provider does not exist
   * - The provider status is not "ENABLED"
   * - The provider market does not match (when `market` is provided)
   *
   * @example
   * ```ts
   * const { active, provider } = await tink.connectivity.checkProviderStatus(
   *   "uk-ob-barclays",
   *   "GB"
   * );
   * if (!active) {
   *   console.warn("Barclays is currently unavailable");
   * }
   * ```
   */
  async checkProviderStatus(providerId: string, market?: string): Promise<ProviderStatusResult> {
    try {
      const provider = await this.http.get<Provider>(`/api/v1/providers/${providerId}`);
      if (market && provider.market !== market) return { active: false };
      return { active: provider.status === "ENABLED", provider };
    } catch {
      return { active: false };
    }
  }

  /**
   * Returns true if the provider is active and accepting connections.
   * Convenience boolean wrapper around `checkProviderStatus()`.
   */
  async providerOperational(providerId: string, market?: string): Promise<boolean> {
    const result = await this.checkProviderStatus(providerId, market);
    return result.active;
  }

  /**
   * Checks the connectivity health of all credentials (bank connections)
   * for the authenticated user.
   *
   * Returns a summary with healthy/unhealthy counts and per-credential details.
   *
   * @example
   * ```ts
   * const summary = await tink.connectivity.checkCredentialConnectivity();
   * console.log(`${summary.healthy}/${summary.total} connections healthy`);
   *
   * for (const cred of summary.credentials) {
   *   if (!cred.healthy) {
   *     await promptUserToReconnect(cred.credentialId);
   *   }
   * }
   * ```
   */
  async checkCredentialConnectivity(
    opts: { includeHealthy?: boolean; includeErrors?: boolean } = {}
  ): Promise<ConnectivitySummary> {
    const data = await this.http.get<{
      credentials?: Array<{
        id: string;
        providerName: string;
        status: string;
        statusUpdated?: string;
        statusPayload?: string;
      }>;
    }>("/api/v1/credentials/list");

    const all: CredentialConnectivity[] = (data.credentials ?? []).map((c) => ({
      credentialId: c.id,
      providerName: c.providerName,
      status: c.status,
      healthy: c.status === "UPDATED",
      lastRefreshed: c.statusUpdated,
      errorMessage: c.statusPayload,
    }));

    const filtered = all.filter((c) => {
      if (opts.includeHealthy === false && c.healthy) return false;
      if (opts.includeErrors === false && !c.healthy) return false;
      return true;
    });

    return {
      credentials: filtered,
      healthy: all.filter((c) => c.healthy).length,
      unhealthy: all.filter((c) => !c.healthy).length,
      total: all.length,
    };
  }

  /**
   * Gets the connectivity status for a single credential.
   *
   * A credential is healthy when its status is "UPDATED" (data was
   * successfully fetched from the bank). Other statuses (e.g. "SESSION_EXPIRED",
   * "AUTHENTICATION_ERROR") indicate re-authentication is needed.
   */
  async getCredentialConnectivity(credentialId: string): Promise<CredentialConnectivity> {
    const c = await this.http.get<{
      id: string;
      providerName: string;
      status: string;
      statusUpdated?: string;
      statusPayload?: string;
    }>(`/api/v1/credentials/${credentialId}`);

    return {
      credentialId: c.id,
      providerName: c.providerName,
      status: c.status,
      healthy: c.status === "UPDATED",
      lastRefreshed: c.statusUpdated,
      errorMessage: c.statusPayload,
    };
  }

  /**
   * Checks overall Tink API health by probing a known endpoint.
   * Returns `{ ok: true }` if the API is reachable, `{ ok: false, error }` otherwise.
   *
   * @example
   * ```ts
   * const health = await tink.connectivity.checkApiHealth();
   * if (!health.ok) {
   *   alertOpsTeam("Tink API is unreachable: " + health.error);
   * }
   * ```
   */
  async checkApiHealth(): Promise<{ ok: true } | { ok: false; error: string }> {
    try {
      await this.http.get("/api/v1/providers/GB");
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  }
}
