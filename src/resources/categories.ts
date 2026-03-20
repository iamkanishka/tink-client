/**
 * Tink Categories API
 *
 * Transaction categories are static reference data used to classify transactions.
 * They are cached for 24 hours and are locale-specific (different locales
 * produce different human-readable category names).
 *
 * https://docs.tink.com/api#categories
 */
import type { HttpClient } from "../utils/http";
import type { Category, CategoriesResponse } from "../types";

export class Categories {
  constructor(private readonly http: HttpClient) {}

  /**
   * Lists all transaction categories for the given locale.
   * Cached for 24 hours — locale is part of the cache key.
   *
   * @param opts.locale - BCP 47 locale code. Defaults to "en_US"
   *
   * @example
   * ```ts
   * const { categories } = await tink.categories.listCategories({ locale: "en_GB" });
   * ```
   */
  async listCategories(opts: { locale?: string } = {}): Promise<CategoriesResponse> {
    const locale = opts.locale ?? "en_US";
    return this.http.get<CategoriesResponse>(`/api/v1/categories?locale=${locale}`);
  }

  /**
   * Gets a single category by ID.
   * Cached for 24 hours.
   *
   * @param categoryId - Category identifier (e.g. "expenses:food.groceries")
   * @param opts.locale - BCP 47 locale code. Defaults to "en_US"
   */
  async getCategory(categoryId: string, opts: { locale?: string } = {}): Promise<Category> {
    const locale = opts.locale ?? "en_US";
    return this.http.get<Category>(`/api/v1/categories/${categoryId}?locale=${locale}`);
  }
}
