// Provider-agnostic marketplace adapter interface.
// All providers normalize to a common shape so the rest of the system
// (KDS, orders, accounting) never has to know which platform delivered.

export type Provider = "mock" | "uber_eats" | "deliveroo" | "thuisbezorgd";

export interface NormalizedOrderItem {
  external_id: string;
  name: string;
  quantity: number;
  unit_price: number;
  modifiers?: { name: string; price: number }[];
}

export interface NormalizedOrder {
  external_order_id: string;
  external_order_number?: string;
  customer_name?: string;
  customer_phone?: string;
  delivery_type: "delivery" | "pickup";
  total: number;
  currency: string;
  items: NormalizedOrderItem[];
}

export interface MenuItemInput {
  external_id: string;
  name: string;
  section: string;
  price: number;
  vat_rate: number;
  is_active: boolean;
}

export interface ProviderAdapter {
  provider: Provider;
  pushMenu(input: { items: MenuItemInput[]; credentials: Record<string, any>; external_menu_id?: string | null }): Promise<{
    ok: boolean;
    external_menu_id?: string;
    message?: string;
  }>;
  parseWebhook(payload: any): Promise<NormalizedOrder | null>;
  updateOrderStatus(input: { external_order_id: string; status: string; credentials: Record<string, any> }): Promise<{ ok: boolean; message?: string }>;
}

// ---- Mock provider: in-memory, always succeeds, generates demo orders ----
export const mockAdapter: ProviderAdapter = {
  provider: "mock",
  async pushMenu({ items }) {
    return { ok: true, external_menu_id: `mock_menu_${Date.now()}`, message: `Synced ${items.length} items (mock)` };
  },
  async parseWebhook(payload) {
    if (!payload?.external_order_id) return null;
    return {
      external_order_id: String(payload.external_order_id),
      external_order_number: payload.order_number ?? null,
      customer_name: payload.customer_name ?? "Mock Customer",
      customer_phone: payload.customer_phone ?? null,
      delivery_type: payload.delivery_type === "pickup" ? "pickup" : "delivery",
      total: Number(payload.total ?? 0),
      currency: payload.currency ?? "EUR",
      items: Array.isArray(payload.items) ? payload.items.map((i: any) => ({
        external_id: String(i.external_id ?? i.id ?? ""),
        name: String(i.name ?? "Item"),
        quantity: Number(i.quantity ?? 1),
        unit_price: Number(i.unit_price ?? i.price ?? 0),
        modifiers: i.modifiers ?? [],
      })) : [],
    };
  },
  async updateOrderStatus() { return { ok: true }; },
};

// Real providers are stubs that mirror the mock shape so we can swap in
// real HTTP calls once OAuth credentials are configured.
function makeStub(provider: Provider): ProviderAdapter {
  return {
    provider,
    async pushMenu({ items }) {
      return { ok: true, external_menu_id: `${provider}_pending`, message: `Stub: would push ${items.length} items to ${provider}` };
    },
    async parseWebhook(payload) { return mockAdapter.parseWebhook(payload); },
    async updateOrderStatus() { return { ok: true, message: `Stub: would update ${provider}` }; },
  };
}

export const adapters: Record<Provider, ProviderAdapter> = {
  mock: mockAdapter,
  uber_eats: makeStub("uber_eats"),
  deliveroo: makeStub("deliveroo"),
  thuisbezorgd: makeStub("thuisbezorgd"),
};

export function getAdapter(provider: Provider): ProviderAdapter {
  return adapters[provider] ?? mockAdapter;
}
