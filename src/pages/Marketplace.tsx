import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Loader2, RefreshCw, Plus, Copy, ShoppingBag } from "lucide-react";
import { useLocation } from "@/contexts/LocationContext";

type Integration = {
  id: string;
  provider: "mock" | "uber_eats" | "deliveroo" | "thuisbezorgd";
  status: "disconnected" | "connected" | "error" | "syncing";
  display_name: string | null;
  external_store_id: string | null;
  external_menu_id: string | null;
  webhook_secret: string | null;
  auto_accept: boolean;
  prep_time_minutes: number;
  last_sync_at: string | null;
  last_sync_status: string | null;
  last_error: string | null;
};
type MarketplaceOrder = {
  id: string;
  provider: string;
  external_order_number: string | null;
  external_order_id: string;
  status: string;
  customer_name: string | null;
  delivery_type: string;
  total: number;
  items: any[];
  received_at: string;
};

const PROVIDERS = [
  { value: "mock", label: "Mock (test)" },
  { value: "uber_eats", label: "Uber Eats" },
  { value: "deliveroo", label: "Deliveroo" },
  { value: "thuisbezorgd", label: "Thuisbezorgd" },
];

export default function Marketplace() {
  const { locationId } = useLocation();
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [orders, setOrders] = useState<MarketplaceOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [newProvider, setNewProvider] = useState<string>("mock");

  const reload = async () => {
    if (!locationId) return;
    setLoading(true);
    const [i, o] = await Promise.all([
      supabase.from("marketplace_integrations" as any).select("*").eq("location_id", locationId).order("created_at"),
      supabase.from("marketplace_orders" as any).select("*").eq("location_id", locationId).order("received_at", { ascending: false }).limit(25),
    ]);
    if (i.data) setIntegrations(i.data as any);
    if (o.data) setOrders(o.data as any);
    setLoading(false);
  };
  useEffect(() => { reload(); }, [locationId]);

  const addIntegration = async () => {
    if (!locationId) return toast.error("Geen locatie geselecteerd");
    const { data: u } = await supabase.auth.getUser();
    const { data: emp } = await supabase.from("employees").select("locations(tenant_id)").eq("user_id", u.user!.id).maybeSingle();
    const tenant_id = (emp as any)?.locations?.tenant_id;
    if (!tenant_id) return toast.error("Geen tenant");
    const secret = crypto.randomUUID();
    const { error } = await supabase.from("marketplace_integrations" as any).insert({
      provider: newProvider,
      location_id: locationId,
      tenant_id,
      display_name: PROVIDERS.find(p => p.value === newProvider)?.label,
      webhook_secret: secret,
      status: "disconnected",
    });
    if (error) return toast.error(error.message);
    reload();
  };

  const syncMenu = async (integ: Integration) => {
    const { data, error } = await supabase.functions.invoke("marketplace-menu-sync", {
      body: { integration_id: integ.id },
    });
    if (error) return toast.error(error.message);
    toast.success(`${(data as any)?.synced_items ?? 0} items gesynchroniseerd`);
    reload();
  };

  const toggleAuto = async (integ: Integration) => {
    const { error } = await supabase.from("marketplace_integrations" as any)
      .update({ auto_accept: !integ.auto_accept })
      .eq("id", integ.id);
    if (error) return toast.error(error.message);
    reload();
  };

  const remove = async (id: string) => {
    if (!confirm("Integratie verwijderen?")) return;
    const { error } = await supabase.from("marketplace_integrations" as any).delete().eq("id", id);
    if (error) return toast.error(error.message);
    reload();
  };

  const triggerMockOrder = async (integ: Integration) => {
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/marketplace-webhook?integration_id=${integ.id}`;
    const payload = {
      external_order_id: `mock_${Date.now()}`,
      order_number: `M${Math.floor(Math.random() * 9000) + 1000}`,
      customer_name: "Test Klant",
      customer_phone: "+31600000000",
      delivery_type: "delivery",
      total: 24.5,
      currency: "EUR",
      items: [
        { external_id: "demo1", name: "Matcha Latte", quantity: 2, unit_price: 5.25 },
        { external_id: "demo2", name: "Matcha Cookie", quantity: 4, unit_price: 3.5 },
      ],
    };
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-marketplace-secret": integ.webhook_secret ?? "" },
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return toast.error(json.error ?? "Webhook gefaald");
    toast.success("Mock order ontvangen");
    reload();
  };

  const webhookUrl = (id: string) =>
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/marketplace-webhook?integration_id=${id}`;

  const statusVariant = (s: string): "default" | "secondary" | "destructive" | "outline" =>
    s === "connected" ? "default" : s === "error" ? "destructive" : s === "syncing" ? "secondary" : "outline";

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Marketplace</h1>
        <p className="text-muted-foreground">Uber Eats · Deliveroo · Thuisbezorgd integraties + mock-provider voor testen</p>
      </div>

      <Tabs defaultValue="integrations">
        <TabsList>
          <TabsTrigger value="integrations">Integraties</TabsTrigger>
          <TabsTrigger value="orders">Inkomende orders</TabsTrigger>
        </TabsList>

        <TabsContent value="integrations" className="mt-6 space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Nieuwe koppeling</CardTitle></CardHeader>
            <CardContent className="flex gap-3 items-end">
              <div className="flex-1">
                <Label>Provider</Label>
                <Select value={newProvider} onValueChange={setNewProvider}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PROVIDERS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={addIntegration}><Plus className="w-4 h-4 mr-2" />Toevoegen</Button>
            </CardContent>
          </Card>

          {loading ? <Loader2 className="animate-spin" /> : integrations.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nog geen integraties.</p>
          ) : integrations.map((i) => (
            <Card key={i.id}>
              <CardContent className="py-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <ShoppingBag className="w-5 h-5 text-muted-foreground" />
                    <div>
                      <div className="font-semibold">{i.display_name ?? i.provider}</div>
                      <div className="text-xs text-muted-foreground">{i.provider}</div>
                    </div>
                    <Badge variant={statusVariant(i.status)}>{i.status}</Badge>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => syncMenu(i)}>
                      <RefreshCw className="w-4 h-4 mr-1" />Sync menu
                    </Button>
                    {i.provider === "mock" && (
                      <Button size="sm" variant="secondary" onClick={() => triggerMockOrder(i)}>
                        Trigger mock order
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => remove(i.id)}>Verwijder</Button>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  <div className="flex items-center gap-2">
                    <Switch checked={i.auto_accept} onCheckedChange={() => toggleAuto(i)} />
                    <span>Auto-accept orders</span>
                  </div>
                  <div className="text-muted-foreground text-xs">
                    {i.last_sync_at ? `Laatste sync: ${new Date(i.last_sync_at).toLocaleString("nl-NL")}` : "Nog niet gesynchroniseerd"}
                  </div>
                </div>
                <div className="bg-muted/40 rounded p-3 text-xs space-y-2">
                  <div className="font-medium">Webhook URL (voor provider config)</div>
                  <div className="flex gap-2">
                    <code className="flex-1 truncate">{webhookUrl(i.id)}</code>
                    <Button size="sm" variant="ghost" onClick={() => { navigator.clipboard.writeText(webhookUrl(i.id)); toast.success("Gekopieerd"); }}>
                      <Copy className="w-3 h-3" />
                    </Button>
                  </div>
                  {i.webhook_secret && (
                    <>
                      <div className="font-medium">Header <code>x-marketplace-secret</code></div>
                      <div className="flex gap-2"><code className="flex-1 truncate">{i.webhook_secret}</code>
                        <Button size="sm" variant="ghost" onClick={() => { navigator.clipboard.writeText(i.webhook_secret!); toast.success("Gekopieerd"); }}>
                          <Copy className="w-3 h-3" />
                        </Button>
                      </div>
                    </>
                  )}
                  {i.last_error && <div className="text-destructive">Fout: {i.last_error}</div>}
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="orders" className="mt-6 space-y-2">
          {loading ? <Loader2 className="animate-spin" /> : orders.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nog geen marketplace-orders ontvangen.</p>
          ) : orders.map((o) => (
            <Card key={o.id}>
              <CardContent className="py-3 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{o.provider}</Badge>
                    <span className="font-semibold">#{o.external_order_number ?? o.external_order_id.slice(-6)}</span>
                    <Badge>{o.status}</Badge>
                    <Badge variant="secondary">{o.delivery_type}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {o.customer_name} · {o.items.length} items · {new Date(o.received_at).toLocaleString("nl-NL")}
                  </div>
                </div>
                <div className="text-right font-mono">€{Number(o.total).toFixed(2)}</div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
