/** OAuth scopes for Inventory + Account (Sell) APIs. */
export const EBAY_SELL_SCOPES = [
  "https://api.ebay.com/oauth/api_scope/sell.inventory",
  "https://api.ebay.com/oauth/api_scope/sell.account",
  "https://api.ebay.com/oauth/api_scope/sell.fulfillment",
] as const;

export function getEbaySellScopeString(): string {
  return EBAY_SELL_SCOPES.join(" ");
}
