import { TinkClient } from "../client";

// ── test helpers ──────────────────────────────────────────────────────────

function mockFetch(status: number, body: unknown, ct = "application/json"): jest.Mock {
  return jest.fn().mockResolvedValue({
    ok:      status >= 200 && status < 300,
    status,
    headers: { get: (k: string) => k === "content-type" ? ct : null },
    json:        () => Promise.resolve(body),
    text:        () => Promise.resolve(String(body ?? "")),
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
  } as unknown as Response);
}

function client(fetchFn: jest.Mock): TinkClient {
  return new TinkClient({ accessToken: "tok", fetchFn, maxRetries: 1, cache: false });
}

const getUrl     = (f: jest.Mock, i = 0) => (f.mock.calls[i] as [string])[0];
const getMethod  = (f: jest.Mock, i = 0) => (f.mock.calls[i] as [string, RequestInit])[1]?.method ?? "GET";
const getBodyStr = (f: jest.Mock, i = 0) => String((f.mock.calls[i] as [string, RequestInit])[1]?.body ?? "");
const getBodyObj = (f: jest.Mock, i = 0) => {
  const b = (f.mock.calls[i] as [string, RequestInit])[1]?.body;
  if (typeof b === "string") { try { return JSON.parse(b); } catch { return b; } }
  return b;
};

// ═════════════════════════════════════════════════════════════════════════════
// Accounts
// ═════════════════════════════════════════════════════════════════════════════

describe("Accounts", () => {
  it("listAccounts → GET /data/v2/accounts", async () => {
    const f = mockFetch(200, { accounts: [] });
    await client(f).accounts.listAccounts();
    expect(getUrl(f)).toContain("/data/v2/accounts");
    expect(getMethod(f)).toBe("GET");
  });

  it("listAccounts passes pageSize as camelCase query param", async () => {
    const f = mockFetch(200, { accounts: [] });
    await client(f).accounts.listAccounts({ pageSize: 25 });
    expect(getUrl(f)).toContain("pageSize=25");
  });

  it("listAccounts passes typeIn as repeated param", async () => {
    const f = mockFetch(200, { accounts: [] });
    await client(f).accounts.listAccounts({ typeIn: ["CHECKING", "SAVINGS"] });
    const url = getUrl(f);
    expect(url).toContain("typeIn=CHECKING");
    expect(url).toContain("typeIn=SAVINGS");
  });

  it("getAccount → GET /data/v2/accounts/:id", async () => {
    const f = mockFetch(200, { id: "a1" });
    await client(f).accounts.getAccount("a1");
    expect(getUrl(f)).toContain("/data/v2/accounts/a1");
  });

  it("getBalances → GET /data/v2/accounts/:id/balances", async () => {
    const f = mockFetch(200, { booked: {} });
    await client(f).accounts.getBalances("a1");
    expect(getUrl(f)).toContain("/data/v2/accounts/a1/balances");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Transactions
// ═════════════════════════════════════════════════════════════════════════════

describe("Transactions", () => {
  it("listTransactions → GET /data/v2/transactions", async () => {
    const f = mockFetch(200, { transactions: [] });
    await client(f).transactions.listTransactions();
    expect(getUrl(f)).toContain("/data/v2/transactions");
  });

  it("listTransactions passes bookedDateGte", async () => {
    const f = mockFetch(200, { transactions: [] });
    await client(f).transactions.listTransactions({ bookedDateGte: "2024-01-01" });
    expect(getUrl(f)).toContain("bookedDateGte=2024-01-01");
  });

  it("listTransactions passes statusIn as repeated param", async () => {
    const f = mockFetch(200, { transactions: [] });
    await client(f).transactions.listTransactions({ statusIn: ["BOOKED"] });
    expect(getUrl(f)).toContain("statusIn=BOOKED");
  });
});

describe("TransactionsContinuousAccess", () => {
  it("createUser → POST /api/v1/user/create with snake_case body", async () => {
    const f = mockFetch(200, { user_id: "u1" });
    await client(f).transactionsContinuousAccess.createUser({ externalUserId: "ext1", locale: "en_US", market: "GB" });
    expect(getUrl(f)).toContain("/api/v1/user/create");
    expect(getBodyObj(f)).toMatchObject({ external_user_id: "ext1" });
  });

  it("buildTinkLink returns correct URL with auth code", () => {
    const url = new TinkClient().transactionsContinuousAccess.buildTinkLink("code_abc", {
      clientId: "cid", redirectUri: "https://x.com", market: "GB", locale: "en_US",
    });
    expect(url).toContain("transactions/connect-accounts");
    expect(url).toContain("authorization_code=code_abc");
    expect(url).toContain("client_id=cid");
  });

  it("createAuthorization → POST /api/v1/oauth/authorization-grant", async () => {
    const f = mockFetch(200, { code: "c1" });
    await client(f).transactionsContinuousAccess.createAuthorization({ userId: "u1", scope: "accounts:read" });
    expect(getUrl(f)).toContain("/api/v1/oauth/authorization-grant");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Providers
// ═════════════════════════════════════════════════════════════════════════════

describe("Providers", () => {
  it("listProviders → GET /api/v1/providers", async () => {
    const f = mockFetch(200, { providers: [] });
    await client(f).providers.listProviders();
    expect(getUrl(f)).toContain("/api/v1/providers");
  });

  it("listProviders passes market", async () => {
    const f = mockFetch(200, { providers: [] });
    await client(f).providers.listProviders({ market: "GB" });
    expect(getUrl(f)).toContain("market=GB");
  });

  it("getProvider → GET /api/v1/providers/:id", async () => {
    const f = mockFetch(200, { name: "uk-ob-barclays" });
    await client(f).providers.getProvider("uk-ob-barclays");
    expect(getUrl(f)).toContain("/api/v1/providers/uk-ob-barclays");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Categories
// ═════════════════════════════════════════════════════════════════════════════

describe("Categories", () => {
  it("listCategories uses default locale en_US", async () => {
    const f = mockFetch(200, { categories: [] });
    await client(f).categories.listCategories();
    expect(getUrl(f)).toContain("locale=en_US");
  });

  it("listCategories uses custom locale", async () => {
    const f = mockFetch(200, { categories: [] });
    await client(f).categories.listCategories({ locale: "sv_SE" });
    expect(getUrl(f)).toContain("locale=sv_SE");
  });

  it("getCategory → GET /api/v1/categories/:id", async () => {
    const f = mockFetch(200, { id: "cat_1" });
    await client(f).categories.getCategory("cat_1");
    expect(getUrl(f)).toContain("/api/v1/categories/cat_1");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Statistics
// ═════════════════════════════════════════════════════════════════════════════

describe("Statistics", () => {
  const opts = { periodGte: "2024-01-01", periodLte: "2024-12-31" };

  it("getStatistics → GET /api/v1/statistics with default MONTHLY resolution", async () => {
    const f = mockFetch(200, { periods: [] });
    await client(f).statistics.getStatistics(opts);
    const url = getUrl(f);
    expect(url).toContain("/api/v1/statistics");
    expect(url).toContain("resolution=MONTHLY");
  });

  it("getStatistics passes period params", async () => {
    const f = mockFetch(200, { periods: [] });
    await client(f).statistics.getStatistics(opts);
    expect(getUrl(f)).toContain("periodGte=2024-01-01");
  });

  it("getCategoryStatistics → /api/v1/statistics/categories/:id", async () => {
    const f = mockFetch(200, { periods: [] });
    await client(f).statistics.getCategoryStatistics("cat_1", opts);
    expect(getUrl(f)).toContain("/api/v1/statistics/categories/cat_1");
  });

  it("getAccountStatistics → /api/v1/statistics/accounts/:id", async () => {
    const f = mockFetch(200, { periods: [] });
    await client(f).statistics.getAccountStatistics("acc_1", opts);
    expect(getUrl(f)).toContain("/api/v1/statistics/accounts/acc_1");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Users
// ═════════════════════════════════════════════════════════════════════════════

describe("Users", () => {
  it("createUser → POST /api/v1/user/create with snake_case body", async () => {
    const f = mockFetch(200, { userId: "u1" });
    await client(f).users.createUser({ externalUserId: "ext1", locale: "en_US", market: "GB" });
    expect(getUrl(f)).toContain("/api/v1/user/create");
    expect(getBodyObj(f)).toMatchObject({ external_user_id: "ext1", locale: "en_US", market: "GB" });
  });

  it("deleteUser → POST /api/v1/user/delete", async () => {
    const f = mockFetch(200, {});
    await client(f).users.deleteUser("u1");
    expect(getUrl(f)).toContain("/api/v1/user/delete");
    expect(getBodyObj(f)).toEqual({ user_id: "u1" });
  });

  it("listCredentials → GET /api/v1/credentials/list", async () => {
    const f = mockFetch(200, { credentials: [] });
    await client(f).users.listCredentials();
    expect(getUrl(f)).toContain("/api/v1/credentials/list");
  });

  it("getCredential → GET /api/v1/credentials/:id", async () => {
    const f = mockFetch(200, { id: "c1" });
    await client(f).users.getCredential("c1");
    expect(getUrl(f)).toContain("/api/v1/credentials/c1");
  });

  it("deleteCredential → DELETE /api/v1/credentials/:id", async () => {
    const f = mockFetch(204, null, "text/plain");
    await client(f).users.deleteCredential("c1");
    expect(getMethod(f)).toBe("DELETE");
    expect(getUrl(f)).toContain("/api/v1/credentials/c1");
  });

  it("refreshCredential → POST /api/v1/credentials/:id/refresh", async () => {
    const f = mockFetch(200, { id: "c1" });
    await client(f).users.refreshCredential("c1");
    expect(getMethod(f)).toBe("POST");
    expect(getUrl(f)).toContain("/api/v1/credentials/c1/refresh");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Investments
// ═════════════════════════════════════════════════════════════════════════════

describe("Investments", () => {
  it("listAccounts → GET /data/v2/investment-accounts", async () => {
    const f = mockFetch(200, { accounts: [] });
    await client(f).investments.listAccounts();
    expect(getUrl(f)).toContain("/data/v2/investment-accounts");
  });

  it("getHoldings → GET /data/v2/investment-accounts/:id/holdings", async () => {
    const f = mockFetch(200, { holdings: [] });
    await client(f).investments.getHoldings("inv_1");
    expect(getUrl(f)).toContain("/data/v2/investment-accounts/inv_1/holdings");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Loans
// ═════════════════════════════════════════════════════════════════════════════

describe("Loans", () => {
  it("listAccounts → GET /data/v2/loan-accounts", async () => {
    const f = mockFetch(200, { accounts: [] });
    await client(f).loans.listAccounts();
    expect(getUrl(f)).toContain("/data/v2/loan-accounts");
  });

  it("getAccount → GET /data/v2/loan-accounts/:id", async () => {
    const f = mockFetch(200, { id: "loan_1" });
    await client(f).loans.getAccount("loan_1");
    expect(getUrl(f)).toContain("/data/v2/loan-accounts/loan_1");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Budgets
// ═════════════════════════════════════════════════════════════════════════════

describe("Budgets", () => {
  const newBudget = {
    title: "Q1", type: "EXPENSE" as const,
    targetAmount: { value: { unscaledValue: 1000, scale: 0 }, currencyCode: "GBP" },
    recurrence: { frequency: "MONTHLY" as const, start: "2024-01-01" },
  };

  it("createBudget → POST /finance-management/v1/business-budgets", async () => {
    const f = mockFetch(200, { id: "b1" });
    await client(f).budgets.createBudget(newBudget);
    expect(getMethod(f)).toBe("POST");
    expect(getUrl(f)).toContain("/finance-management/v1/business-budgets");
  });

  it("getBudget → GET /finance-management/v1/business-budgets/:id", async () => {
    const f = mockFetch(200, { id: "b1" });
    await client(f).budgets.getBudget("b1");
    expect(getUrl(f)).toContain("/finance-management/v1/business-budgets/b1");
  });

  it("getBudgetHistory → GET .../b1/history", async () => {
    const f = mockFetch(200, { history: [] });
    await client(f).budgets.getBudgetHistory("b1");
    expect(getUrl(f)).toContain("/finance-management/v1/business-budgets/b1/history");
  });

  it("listBudgets → GET /finance-management/v1/business-budgets", async () => {
    const f = mockFetch(200, { budgets: [] });
    await client(f).budgets.listBudgets();
    expect(getUrl(f)).toContain("/finance-management/v1/business-budgets");
  });

  it("listBudgets passes progressStatusIn", async () => {
    const f = mockFetch(200, { budgets: [] });
    await client(f).budgets.listBudgets({ progressStatusIn: ["ON_TRACK"] });
    expect(getUrl(f)).toContain("progressStatusIn=ON_TRACK");
  });

  it("updateBudget → PATCH .../b1", async () => {
    const f = mockFetch(200, { id: "b1" });
    await client(f).budgets.updateBudget("b1", { title: "Updated" });
    expect(getMethod(f)).toBe("PATCH");
    expect(getUrl(f)).toContain("/finance-management/v1/business-budgets/b1");
  });

  it("deleteBudget → DELETE .../b1", async () => {
    const f = mockFetch(204, null, "text/plain");
    await client(f).budgets.deleteBudget("b1");
    expect(getMethod(f)).toBe("DELETE");
    expect(getUrl(f)).toContain("/finance-management/v1/business-budgets/b1");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// CashFlow
// ═════════════════════════════════════════════════════════════════════════════

describe("CashFlow", () => {
  it("getSummaries → GET /finance-management/v1/cash-flow-summaries/MONTHLY", async () => {
    const f = mockFetch(200, { periods: [] });
    await client(f).cashFlow.getSummaries({ resolution: "MONTHLY", fromGte: "2024-01-01", toLte: "2024-12-31" });
    expect(getUrl(f)).toContain("/finance-management/v1/cash-flow-summaries/MONTHLY");
    expect(getUrl(f)).toContain("fromGte=2024-01-01");
    expect(getUrl(f)).toContain("toLte=2024-12-31");
  });

  it("getSummaries with WEEKLY resolution", async () => {
    const f = mockFetch(200, { periods: [] });
    await client(f).cashFlow.getSummaries({ resolution: "WEEKLY", fromGte: "2024-01-01", toLte: "2024-03-31" });
    expect(getUrl(f)).toContain("/finance-management/v1/cash-flow-summaries/WEEKLY");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// FinancialCalendar
// ═════════════════════════════════════════════════════════════════════════════

describe("FinancialCalendar", () => {
  it("createEvent → POST /finance-management/v1/financial-calendar-events", async () => {
    const f = mockFetch(200, { id: "ev1" });
    await client(f).financialCalendar.createEvent({ title: "Salary" });
    expect(getMethod(f)).toBe("POST");
    expect(getUrl(f)).toContain("/finance-management/v1/financial-calendar-events");
  });

  it("getEvent → GET .../events/:id", async () => {
    const f = mockFetch(200, { id: "ev1" });
    await client(f).financialCalendar.getEvent("ev1");
    expect(getUrl(f)).toContain("/finance-management/v1/financial-calendar-events/ev1");
  });

  it("updateEvent → PATCH .../events/:id", async () => {
    const f = mockFetch(200, { id: "ev1" });
    await client(f).financialCalendar.updateEvent("ev1", { title: "Updated" });
    expect(getMethod(f)).toBe("PATCH");
  });

  it("listEvents → GET /finance-management/v1/financial-calendar-events", async () => {
    const f = mockFetch(200, { events: [] });
    await client(f).financialCalendar.listEvents();
    expect(getUrl(f)).toContain("/finance-management/v1/financial-calendar-events");
  });

  it("deleteEvent → DELETE .../events/:id/?recurring=SINGLE by default", async () => {
    const f = mockFetch(204, null, "text/plain");
    await client(f).financialCalendar.deleteEvent("ev1");
    expect(getMethod(f)).toBe("DELETE");
    expect(getUrl(f)).toContain("recurring=SINGLE");
  });

  it("deleteEvent with recurring=ALL", async () => {
    const f = mockFetch(204, null, "text/plain");
    await client(f).financialCalendar.deleteEvent("ev1", { recurring: "ALL" });
    expect(getUrl(f)).toContain("recurring=ALL");
  });

  it("addAttachment → POST .../events/:id/attachments", async () => {
    const f = mockFetch(200, {});
    await client(f).financialCalendar.addAttachment("ev1", { title: "Invoice", url: "https://x.com" });
    expect(getUrl(f)).toContain("/finance-management/v1/financial-calendar-events/ev1/attachments");
  });

  it("deleteAttachment → DELETE .../events/:id/attachments/:aid/", async () => {
    const f = mockFetch(204, null, "text/plain");
    await client(f).financialCalendar.deleteAttachment("ev1", "att1");
    expect(getMethod(f)).toBe("DELETE");
    expect(getUrl(f)).toContain("/ev1/attachments/att1/");
  });

  it("createRecurringGroup → POST .../events/:id/recurring-group", async () => {
    const f = mockFetch(200, {});
    await client(f).financialCalendar.createRecurringGroup("ev1", { rrulePattern: "FREQ=MONTHLY" });
    expect(getUrl(f)).toContain("/ev1/recurring-group");
  });

  it("createReconciliation → POST .../events/:id/reconciliations", async () => {
    const f = mockFetch(200, {});
    await client(f).financialCalendar.createReconciliation("ev1", { transactionId: "t1" });
    expect(getUrl(f)).toContain("/ev1/reconciliations");
  });

  it("getReconciliationDetails → GET .../reconciliations/details", async () => {
    const f = mockFetch(200, {});
    await client(f).financialCalendar.getReconciliationDetails("ev1");
    expect(getUrl(f)).toContain("/ev1/reconciliations/details");
  });

  it("getReconciliationSuggestions → GET .../reconciliations/suggestions", async () => {
    const f = mockFetch(200, {});
    await client(f).financialCalendar.getReconciliationSuggestions("ev1");
    expect(getUrl(f)).toContain("/ev1/reconciliations/suggestions");
  });

  it("deleteReconciliation → DELETE .../reconciliations/:txn_id", async () => {
    const f = mockFetch(204, null, "text/plain");
    await client(f).financialCalendar.deleteReconciliation("ev1", "txn1");
    expect(getMethod(f)).toBe("DELETE");
    expect(getUrl(f)).toContain("/ev1/reconciliations/txn1");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// AccountCheck
// ═════════════════════════════════════════════════════════════════════════════

describe("AccountCheck", () => {
  it("createSession → POST /link/v1/session with firstName/lastName", async () => {
    const f = mockFetch(200, { sessionId: "s1" });
    await client(f).accountCheck.createSession({
      user: { firstName: "John", lastName: "Doe" }, market: "GB",
    });
    expect(getUrl(f)).toContain("/link/v1/session");
    expect(getBodyObj(f)).toMatchObject({ user: { firstName: "John", lastName: "Doe" }, market: "GB" });
  });

  it("buildLinkUrl returns correct URL with session_id", () => {
    const url = new TinkClient().accountCheck.buildLinkUrl(
      { sessionId: "sess_1" },
      { clientId: "cid", market: "GB" }
    );
    expect(url).toContain("https://link.tink.com/1.0/account-check?");
    expect(url).toContain("session_id=sess_1");
    expect(url).toContain("client_id=cid");
    expect(url).toContain("market=GB");
  });

  it("buildLinkUrl uses default redirect_uri and market", () => {
    const url = new TinkClient().accountCheck.buildLinkUrl({ sessionId: "s" }, { clientId: "c" });
    expect(url).toContain("redirect_uri=");
    expect(url).toContain("market=GB");
  });

  it("getReport → GET /api/v1/account-verification-reports/:id", async () => {
    const f = mockFetch(200, { id: "r1" });
    await client(f).accountCheck.getReport("r1");
    expect(getUrl(f)).toContain("/api/v1/account-verification-reports/r1");
  });

  it("getReportPdf → GET .../r1/pdf?template=standard-1.0", async () => {
    const f = mockFetch(200, null, "application/pdf");
    await client(f).accountCheck.getReportPdf("r1");
    expect(getUrl(f)).toContain("/api/v1/account-verification-reports/r1/pdf");
    expect(getUrl(f)).toContain("template=standard-1.0");
  });

  it("listReports → GET /api/v1/account-verification-reports", async () => {
    const f = mockFetch(200, { reports: [] });
    await client(f).accountCheck.listReports();
    expect(getUrl(f)).toContain("/api/v1/account-verification-reports");
  });

  it("buildContinuousAccessLink → https://link.tink.com/1.0/products/connect-accounts", () => {
    const url = new TinkClient().accountCheck.buildContinuousAccessLink(
      { code: "grant_abc" },
      { clientId: "cid", market: "GB", locale: "en_US", redirectUri: "https://x.com" }
    );
    expect(url).toContain("https://link.tink.com/1.0/products/connect-accounts");
    expect(url).toContain("authorization_code=grant_abc");
    expect(url).toContain("products=ACCOUNT_CHECK%2CTRANSACTIONS");
  });

  it("buildContinuousAccessLink uses custom products", () => {
    const url = new TinkClient().accountCheck.buildContinuousAccessLink(
      { code: "c" },
      { clientId: "id", market: "GB", locale: "en_US", redirectUri: "https://x.com", products: "ACCOUNT_CHECK" }
    );
    expect(url).toContain("products=ACCOUNT_CHECK");
  });

  it("getAccountParties → GET /data/v2/accounts/:id/parties", async () => {
    const f = mockFetch(200, { parties: [] });
    await client(f).accountCheck.getAccountParties("acc_1");
    expect(getUrl(f)).toContain("/data/v2/accounts/acc_1/parties");
  });

  it("listTransactions → GET /data/v2/transactions", async () => {
    const f = mockFetch(200, { transactions: [] });
    await client(f).accountCheck.listTransactions();
    expect(getUrl(f)).toContain("/data/v2/transactions");
  });

  it("deleteUser → DELETE /api/v1/user/:id", async () => {
    const f = mockFetch(204, null, "text/plain");
    await client(f).accountCheck.deleteUser("u1");
    expect(getMethod(f)).toBe("DELETE");
    expect(getUrl(f)).toContain("/api/v1/user/u1");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// BalanceCheck
// ═════════════════════════════════════════════════════════════════════════════

describe("BalanceCheck", () => {
  it("refreshBalance → POST /api/v1/balance-refresh with accountId", async () => {
    const f = mockFetch(200, { balanceRefreshId: "r1", status: "INITIATED" });
    await client(f).balanceCheck.refreshBalance("acc_1");
    expect(getUrl(f)).toContain("/api/v1/balance-refresh");
    expect(getBodyObj(f)).toEqual({ accountId: "acc_1" });
  });

  it("getRefreshStatus → GET /api/v1/balance-refresh/:id", async () => {
    const f = mockFetch(200, { balanceRefreshId: "r1", status: "COMPLETED" });
    await client(f).balanceCheck.getRefreshStatus("r1");
    expect(getUrl(f)).toContain("/api/v1/balance-refresh/r1");
  });

  it("getAccountBalance → GET /data/v2/accounts/:id/balances", async () => {
    const f = mockFetch(200, { booked: {} });
    await client(f).balanceCheck.getAccountBalance("acc_1");
    expect(getUrl(f)).toContain("/data/v2/accounts/acc_1/balances");
  });

  it("buildAccountCheckLink contains correct URL parts", () => {
    const url = new TinkClient().balanceCheck.buildAccountCheckLink(
      { code: "code_xyz" },
      { clientId: "cid", market: "SE", redirectUri: "https://x.com" }
    );
    expect(url).toContain("https://link.tink.com/1.0/account-check/connect");
    expect(url).toContain("authorization_code=code_xyz");
    expect(url).toContain("state=OPTIONAL");
    expect(url).toContain("test=false");
    expect(url).toContain("market=SE");
  });

  it("buildAccountCheckLink with test=true", () => {
    const url = new TinkClient().balanceCheck.buildAccountCheckLink(
      { code: "c" },
      { clientId: "cid", market: "SE", redirectUri: "https://x.com", test: true }
    );
    expect(url).toContain("test=true");
  });

  it("buildConsentUpdateLink contains credentials_id", () => {
    const url = new TinkClient().balanceCheck.buildConsentUpdateLink(
      { code: "code_xyz" },
      { clientId: "cid", credentialsId: "cred_1", market: "SE", redirectUri: "https://x.com" }
    );
    expect(url).toContain("account-check/update-consent");
    expect(url).toContain("credentials_id=cred_1");
    expect(url).toContain("authorization_code=code_xyz");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Reports
// ═════════════════════════════════════════════════════════════════════════════

describe("IncomeCheck", () => {
  it("getReport → GET /v2/income-checks/:id", async () => {
    const f = mockFetch(200, { id: "r1" });
    await client(f).incomeCheck.getReport("r1");
    expect(getUrl(f)).toContain("/v2/income-checks/r1");
  });

  it("getReportPdf → GET /v2/income-checks/:id:generate-pdf", async () => {
    const f = mockFetch(200, null, "application/pdf");
    await client(f).incomeCheck.getReportPdf("r1");
    expect(getUrl(f)).toContain("/v2/income-checks/r1:generate-pdf");
  });
});

describe("ExpenseCheck", () => {
  it("getReport → GET /risk/v1/expense-checks/:id", async () => {
    const f = mockFetch(200, { id: "r1" });
    await client(f).expenseCheck.getReport("r1");
    expect(getUrl(f)).toContain("/risk/v1/expense-checks/r1");
  });
});

describe("RiskInsights", () => {
  it("getReport → GET /risk/v1/risk-insights/:id", async () => {
    const f = mockFetch(200, { id: "r1" });
    await client(f).riskInsights.getReport("r1");
    expect(getUrl(f)).toContain("/risk/v1/risk-insights/r1");
  });
});

describe("RiskCategorisation", () => {
  it("getReport → GET /risk/v2/risk-categorisation/reports/:id", async () => {
    const f = mockFetch(200, { id: "r1" });
    await client(f).riskCategorisation.getReport("r1");
    expect(getUrl(f)).toContain("/risk/v2/risk-categorisation/reports/r1");
  });
});

describe("BusinessAccountCheck", () => {
  it("getReport → GET /data/v1/business-account-verification-reports/:id", async () => {
    const f = mockFetch(200, { id: "r1" });
    await client(f).businessAccountCheck.getReport("r1");
    expect(getUrl(f)).toContain("/data/v1/business-account-verification-reports/r1");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Connector
// ═════════════════════════════════════════════════════════════════════════════

describe("Connector", () => {
  it("createUser → POST /api/v1/user/create", async () => {
    const f = mockFetch(200, { user_id: "u1" });
    await client(f).connector.createUser({ externalUserId: "ext1", market: "GB", locale: "en_US" });
    expect(getUrl(f)).toContain("/api/v1/user/create");
    expect(getBodyObj(f)).toMatchObject({ external_user_id: "ext1" });
  });

  it("ingestAccounts → POST /connector/users/:id/accounts", async () => {
    const f = mockFetch(200, {});
    await client(f).connector.ingestAccounts("ext1", {
      accounts: [{ externalId: "a1", name: "Checking", type: "CHECKING", balance: 1000 }],
    });
    expect(getUrl(f)).toContain("/connector/users/ext1/accounts");
    const body = getBodyObj(f) as { accounts: Array<{ externalId: string; balance: number }> };
    expect(body.accounts[0]?.externalId).toBe("a1");
    expect(body.accounts[0]?.balance).toBe(1000);
  });

  it("ingestAccounts omits optional fields when not provided", async () => {
    const f = mockFetch(200, {});
    await client(f).connector.ingestAccounts("ext1", {
      accounts: [{ externalId: "a1", name: "Checking", type: "CHECKING", balance: 0 }],
    });
    const body = getBodyObj(f) as { accounts: Array<Record<string, unknown>> };
    expect(body.accounts[0]).not.toHaveProperty("number");
    expect(body.accounts[0]).not.toHaveProperty("flags");
  });

  it("ingestTransactions → POST /connector/users/:id/transactions", async () => {
    const f = mockFetch(200, {});
    await client(f).connector.ingestTransactions("ext1", {
      type: "REAL_TIME",
      transactionAccounts: [{
        externalId: "a1", balance: 985,
        transactions: [{
          externalId: "t1", amount: -15, date: 1_700_000_000_000,
          description: "Coffee", type: "DEFAULT",
        }],
      }],
    });
    expect(getUrl(f)).toContain("/connector/users/ext1/transactions");
    const body = getBodyObj(f) as Record<string, unknown>;
    expect(body.type).toBe("REAL_TIME");
  });

  it("ingestTransactions passes autoBook when set", async () => {
    const f = mockFetch(200, {});
    await client(f).connector.ingestTransactions("ext1", {
      type: "BATCH",
      transactionAccounts: [],
      autoBook: true,
    });
    expect((getBodyObj(f) as Record<string, unknown>).autoBook).toBe(true);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Link
// ═════════════════════════════════════════════════════════════════════════════

describe("Link", () => {
  const baseOpts = { clientId: "cid", redirectUri: "https://x.com", market: "GB", locale: "en_US" };

  const PRODUCT_PATHS: Record<string, string> = {
    transactions:  "transactions/connect-accounts",
    account_check: "account-check/connect-accounts",
    income_check:  "income-check/connect-accounts",
    payment:       "pay/execute-payment",
    expense_check: "expense-check/connect-accounts",
    risk_insights: "risk-insights/connect-accounts",
  };

  Object.entries(PRODUCT_PATHS).forEach(([product, path]) => {
    it(`buildUrl("${product}") → path contains ${path}`, () => {
      const url = new TinkClient().link.buildUrl(product as never, baseOpts);
      expect(url).toContain(path);
    });
  });

  it("includes authorization_code when provided", () => {
    const url = new TinkClient().link.buildUrl("transactions", { ...baseOpts, authorizationCode: "code_abc" });
    expect(url).toContain("authorization_code=code_abc");
  });

  it("includes payment_request_id for payment product", () => {
    const url = new TinkClient().link.buildUrl("payment", { ...baseOpts, paymentRequestId: "pay_1" });
    expect(url).toContain("payment_request_id=pay_1");
  });

  it("includes test=true when test mode enabled", () => {
    const url = new TinkClient().link.buildUrl("transactions", { ...baseOpts, test: true });
    expect(url).toContain("test=true");
  });

  it("includes input_provider when test mode and inputProvider set", () => {
    const url = new TinkClient().link.buildUrl("transactions", { ...baseOpts, test: true, inputProvider: "uk-ob-barclays" });
    expect(url).toContain("input_provider=uk-ob-barclays");
  });

  it("includes state when set", () => {
    const url = new TinkClient().link.buildUrl("transactions", { ...baseOpts, state: "csrf_123" });
    expect(url).toContain("state=csrf_123");
  });

  it("includes iframe=true when set", () => {
    const url = new TinkClient().link.buildUrl("transactions", { ...baseOpts, iframe: true });
    expect(url).toContain("iframe=true");
  });

  it("transactionsUrl convenience wrapper", () => {
    const url = new TinkClient().link.transactionsUrl("code_x", baseOpts);
    expect(url).toContain("transactions/connect-accounts");
    expect(url).toContain("authorization_code=code_x");
  });

  it("accountCheckUrl convenience wrapper", () => {
    const url = new TinkClient().link.accountCheckUrl("code_x", baseOpts);
    expect(url).toContain("account-check/connect-accounts");
  });

  it("paymentUrl convenience wrapper", () => {
    const url = new TinkClient().link.paymentUrl("pay_x", baseOpts);
    expect(url).toContain("pay/execute-payment");
    expect(url).toContain("payment_request_id=pay_x");
  });

  it("always starts with https://link.tink.com/1.0/", () => {
    const url = new TinkClient().link.buildUrl("transactions", baseOpts);
    expect(url.startsWith("https://link.tink.com/1.0/")).toBe(true);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Connectivity
// ═════════════════════════════════════════════════════════════════════════════

describe("Connectivity", () => {
  it("listProvidersByMarket → GET /api/v1/providers/:market", async () => {
    const f = mockFetch(200, { providers: [] });
    await client(f).connectivity.listProvidersByMarket("GB");
    expect(getUrl(f)).toContain("/api/v1/providers/GB");
  });

  it("checkApiHealth returns { ok: true } on success", async () => {
    const f = mockFetch(200, { providers: [] });
    expect(await client(f).connectivity.checkApiHealth()).toEqual({ ok: true });
  });

  it("checkApiHealth returns { ok: false, error } on failure", async () => {
    const f = jest.fn().mockRejectedValue(new Error("Network error"));
    const result = await client(f).connectivity.checkApiHealth();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("Network error");
  });

  it("checkProviderStatus returns { active: true } for ENABLED provider", async () => {
    const f = mockFetch(200, { name: "uk-ob-barclays", status: "ENABLED", market: "GB" });
    const result = await client(f).connectivity.checkProviderStatus("uk-ob-barclays");
    expect(result.active).toBe(true);
    expect(result.provider?.name).toBe("uk-ob-barclays");
  });

  it("checkProviderStatus returns { active: false } for non-ENABLED provider", async () => {
    const f = mockFetch(200, { name: "p1", status: "DISABLED", market: "GB" });
    expect(await client(f).connectivity.checkProviderStatus("p1")).toEqual({ active: false, provider: expect.any(Object) });
  });

  it("checkProviderStatus returns { active: false } for market mismatch", async () => {
    const f = mockFetch(200, { name: "p1", status: "ENABLED", market: "SE" });
    expect(await client(f).connectivity.checkProviderStatus("p1", "GB")).toEqual({ active: false });
  });

  it("checkProviderStatus returns { active: false } when request fails", async () => {
    const f = jest.fn().mockRejectedValue(new Error("Not found"));
    expect(await client(f).connectivity.checkProviderStatus("unknown")).toEqual({ active: false });
  });

  it("providerOperational returns boolean", async () => {
    const f = mockFetch(200, { name: "p1", status: "ENABLED", market: "GB" });
    expect(typeof (await client(f).connectivity.providerOperational("p1"))).toBe("boolean");
    expect(await client(f).connectivity.providerOperational("p1")).toBe(true);
  });

  it("checkCredentialConnectivity → GET /api/v1/credentials/list and returns summary", async () => {
    const f = mockFetch(200, {
      credentials: [
        { id: "c1", providerName: "bank1", status: "UPDATED", statusUpdated: "2024-01-01" },
        { id: "c2", providerName: "bank2", status: "SESSION_EXPIRED", statusPayload: "Reconnect needed" },
      ],
    });
    const summary = await client(f).connectivity.checkCredentialConnectivity();
    expect(summary.total).toBe(2);
    expect(summary.healthy).toBe(1);
    expect(summary.unhealthy).toBe(1);
    expect(summary.credentials).toHaveLength(2);
  });

  it("getCredentialConnectivity → GET /api/v1/credentials/:id", async () => {
    const f = mockFetch(200, { id: "c1", providerName: "bank1", status: "UPDATED" });
    const result = await client(f).connectivity.getCredentialConnectivity("c1");
    expect(result.credentialId).toBe("c1");
    expect(result.healthy).toBe(true);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// TinkClient
// ═════════════════════════════════════════════════════════════════════════════

describe("TinkClient", () => {
  it("has all 24 namespaces", () => {
    const tink = new TinkClient();
    const namespaces = [
      "auth", "accounts", "transactions", "transactionsOneTimeAccess",
      "transactionsContinuousAccess", "providers", "categories", "statistics",
      "users", "investments", "loans", "budgets", "cashFlow", "financialCalendar",
      "accountCheck", "balanceCheck", "businessAccountCheck",
      "incomeCheck", "expenseCheck", "riskInsights", "riskCategorisation",
      "connector", "link", "connectivity",
    ];
    namespaces.forEach(ns => expect((tink as unknown as Record<string, unknown>)[ns]).toBeDefined());
  });

  it("info() returns version, baseUrl, hasToken", () => {
    const tink = new TinkClient({ accessToken: "tok" });
    const i = tink.info();
    expect(i.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(i.baseUrl).toBe("https://api.tink.com");
    expect(i.hasToken).toBe(true);
  });

  it("setAccessToken() is chainable and updates accessToken", () => {
    const tink = new TinkClient();
    const result = tink.setAccessToken("my-tok");
    expect(result).toBe(tink);
    expect(tink.accessToken).toBe("my-tok");
  });

  it("clearCache() is chainable", () => {
    const tink = new TinkClient();
    expect(tink.clearCache()).toBe(tink);
  });

  it("invalidateCache() is chainable", () => {
    const tink = new TinkClient();
    expect(tink.invalidateCache("/api/v1/providers")).toBe(tink);
  });

  it("authenticate() throws TinkError when no clientId", async () => {
    const tink = new TinkClient();
    await expect(tink.authenticate("accounts:read")).rejects.toBeInstanceOf(Error);
    await expect(tink.authenticate("accounts:read")).rejects.toMatchObject({
      type: "validation_error",
    });
  });

  it("authenticate() calls getAccessToken and sets token", async () => {
    const f = mockFetch(200, { access_token: "new-token", token_type: "bearer", expires_in: 3600, scope: "accounts:read" });
    const tink = new TinkClient({ clientId: "cid", clientSecret: "sec", fetchFn: f, maxRetries: 1, cache: false });
    await tink.authenticate("accounts:read");
    expect(tink.accessToken).toBe("new-token");
  });

  it("createWebhookHandler() returns a WebhookHandler", () => {
    const wh = new TinkClient().createWebhookHandler("secret");
    expect(typeof wh.registerHandler).toBe("function");
    expect(typeof wh.handleWebhook).toBe("function");
  });

  it("createWebhookVerifier() returns a WebhookVerifier", () => {
    const v = new TinkClient().createWebhookVerifier("secret");
    expect(typeof v.verify).toBe("function");
    expect(typeof v.generateSignature).toBe("function");
  });

  it("reads clientId from TINK_CLIENT_ID env var", () => {
    process.env["TINK_CLIENT_ID"] = "env-client-id";
    const tink = new TinkClient();
    expect(tink.clientId).toBe("env-client-id");
    delete process.env["TINK_CLIENT_ID"];
  });

  it("constructor clientId overrides env var", () => {
    process.env["TINK_CLIENT_ID"] = "env-id";
    const tink = new TinkClient({ clientId: "config-id" });
    expect(tink.clientId).toBe("config-id");
    delete process.env["TINK_CLIENT_ID"];
  });
});
