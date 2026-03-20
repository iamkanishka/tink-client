/**
 * Tink Link URL Builder
 *
 * Constructs Tink Link URLs for redirecting end users to connect their
 * bank accounts for various financial products.
 *
 * Supported products:
 * - `transactions`  — connect bank accounts for transaction access
 * - `account_check` — verify account ownership
 * - `income_check`  — verify income
 * - `payment`       — initiate a payment
 * - `expense_check` — analyse spending
 * - `risk_insights` — generate risk report
 *
 * @example
 * ```ts
 * const url = tink.link.buildUrl("transactions", {
 *   clientId:          process.env.TINK_CLIENT_ID!,
 *   redirectUri:       "https://yourapp.com/callback",
 *   market:            "GB",
 *   locale:            "en_US",
 *   authorizationCode: grant.code,
 * });
 * // Redirect user to url
 * ```
 *
 * https://docs.tink.com/resources/tink-link
 */
import type { LinkProduct, LinkUrlParams } from "../types";

const BASE_URL = "https://link.tink.com/1.0";

const PRODUCT_PATHS: Record<LinkProduct, string> = {
  transactions: "transactions/connect-accounts",
  account_check: "account-check/connect-accounts",
  income_check: "income-check/connect-accounts",
  payment: "pay/execute-payment",
  expense_check: "expense-check/connect-accounts",
  risk_insights: "risk-insights/connect-accounts",
};

export class Link {
  /**
   * Builds a Tink Link URL for any supported product.
   * Supports test mode, iframe mode, and provider pre-selection.
   *
   * @example
   * ```ts
   * // Standard transactions URL
   * tink.link.buildUrl("transactions", {
   *   clientId: "...", redirectUri: "...", market: "GB", locale: "en_US",
   *   authorizationCode: code,
   * });
   *
   * // Payment URL
   * tink.link.buildUrl("payment", {
   *   clientId: "...", redirectUri: "...", market: "SE", locale: "sv_SE",
   *   paymentRequestId: paymentId,
   * });
   *
   * // Sandbox test mode with pre-selected provider
   * tink.link.buildUrl("transactions", {
   *   clientId: "...", redirectUri: "...", market: "GB", locale: "en_US",
   *   authorizationCode: code,
   *   test: true,
   *   inputProvider: "uk-ob-barclays",
   * });
   * ```
   */
  buildUrl(product: LinkProduct, params: LinkUrlParams): string {
    const q: Record<string, string> = {
      client_id: params.clientId,
      redirect_uri: params.redirectUri,
      market: params.market,
      locale: params.locale,
    };

    if (params.authorizationCode) q["authorization_code"] = params.authorizationCode;
    if (product === "payment" && params.paymentRequestId)
      q["payment_request_id"] = params.paymentRequestId;
    if (params.state) q["state"] = params.state;
    if (params.iframe) q["iframe"] = "true";

    if (params.test) {
      q["test"] = "true";
      if (params.inputProvider) q["input_provider"] = params.inputProvider;
      if (params.inputUsername) q["input_username"] = params.inputUsername;
    }

    return `${BASE_URL}/${PRODUCT_PATHS[product]}?${new URLSearchParams(q).toString()}`;
  }

  /**
   * Builds a Tink Link URL for the transactions product.
   * Shorthand for `buildUrl("transactions", { authorizationCode, ...opts })`.
   */
  transactionsUrl(
    authorizationCode: string,
    opts: Omit<LinkUrlParams, "authorizationCode">
  ): string {
    return this.buildUrl("transactions", { ...opts, authorizationCode });
  }

  /**
   * Builds a Tink Link URL for the account check product.
   * Shorthand for `buildUrl("account_check", { authorizationCode, ...opts })`.
   */
  accountCheckUrl(
    authorizationCode: string,
    opts: Omit<LinkUrlParams, "authorizationCode">
  ): string {
    return this.buildUrl("account_check", { ...opts, authorizationCode });
  }

  /**
   * Builds a Tink Link URL for the payment product.
   * Shorthand for `buildUrl("payment", { paymentRequestId, ...opts })`.
   */
  paymentUrl(paymentRequestId: string, opts: Omit<LinkUrlParams, "paymentRequestId">): string {
    return this.buildUrl("payment", { ...opts, paymentRequestId });
  }
}
