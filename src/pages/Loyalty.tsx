import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, Send } from "lucide-react";

type Tier = {
  id: string;
  name: string;
  color: string;
  min_total_spent: number;
  min_visit_count: number;
  point_multiplier: number;
  perks: string | null;
  sort_order: number;
  is_active: boolean;
};
type Segment = {
  id: string;
  name: string;
  description: string | null;
  definition: any;
  is_active: boolean;
};
type Campaign = {
  id: string;
  name: string;
  channel: string;
  subject: string | null;
  message: string;
  status: string;
  scheduled_at: string | null;
  sent_at: string | null;
  recipients_count: number;
  delivered_count: number;
  segment_id: string | null;
};

export default function Loyalty() {
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = async () => {
    setLoading(true);
    const [t, s, c] = await Promise.all([
      supabase.from("loyalty_tiers" as any).select("*").order("sort_order"),
      supabase.from("customer_segments" as any).select("*").order("created_at", { ascending: false }),
      supabase.from("loyalty_campaigns" as any).select("*").order("created_at", { ascending: false }),
    ]);
    if (t.data) setTiers(t.data as any);
    if (s.data) setSegments(s.data as any);
    if (c.data) setCampaigns(c.data as any);
    setLoading(false);
  };
  useEffect(() => { reload(); }, []);

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Loyalty 2.0</h1>
        <p className="text-muted-foreground">Tiers, segmenten en campagnes voor je klanten</p>
      </div>
      <Tabs defaultValue="tiers">
        <TabsList>
          <TabsTrigger value="tiers">Tiers</TabsTrigger>
          <TabsTrigger value="segments">Segmenten</TabsTrigger>
          <TabsTrigger value="campaigns">Campagnes</TabsTrigger>
        </TabsList>
        <TabsContent value="tiers" className="mt-6">
          <TiersPanel tiers={tiers} loading={loading} reload={reload} />
        </TabsContent>
        <TabsContent value="segments" className="mt-6">
          <SegmentsPanel segments={segments} tiers={tiers} loading={loading} reload={reload} />
        </TabsContent>
        <TabsContent value="campaigns" className="mt-6">
          <CampaignsPanel campaigns={campaigns} segments={segments} loading={loading} reload={reload} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function TiersPanel({ tiers, loading, reload }: { tiers: Tier[]; loading: boolean; reload: () => void }) {
  const [draft, setDraft] = useState({ name: "", color: "#7cb342", min_total_spent: 0, min_visit_count: 0, point_multiplier: 1, perks: "" });
  const [saving, setSaving] = useState(false);

  const add = async () => {
    if (!draft.name.trim()) return toast.error("Naam verplicht");
    setSaving(true);
    const { data: u } = await supabase.auth.getUser();
    const { data: emp } = await supabase.from("employees").select("location_id, locations(tenant_id)").eq("user_id", u.user!.id).maybeSingle();
    const tenant_id = (emp as any)?.locations?.tenant_id;
    if (!tenant_id) { setSaving(false); return toast.error("Geen tenant"); }
    const { error } = await supabase.from("loyalty_tiers" as any).insert({ ...draft, tenant_id, sort_order: tiers.length });
    setSaving(false);
    if (error) return toast.error(error.message);
    setDraft({ name: "", color: "#7cb342", min_total_spent: 0, min_visit_count: 0, point_multiplier: 1, perks: "" });
    reload();
  };
  const remove = async (id: string) => {
    if (!confirm("Tier verwijderen?")) return;
    const { error } = await supabase.from("loyalty_tiers" as any).delete().eq("id", id);
    if (error) return toast.error(error.message);
    reload();
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-base">Nieuwe tier</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-6 gap-3">
          <div className="md:col-span-2"><Label>Naam</Label><Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Bronze" /></div>
          <div><Label>Kleur</Label><Input type="color" value={draft.color} onChange={(e) => setDraft({ ...draft, color: e.target.value })} /></div>
          <div><Label>Min. spend €</Label><Input type="number" value={draft.min_total_spent} onChange={(e) => setDraft({ ...draft, min_total_spent: Number(e.target.value) })} /></div>
          <div><Label>Min. visits</Label><Input type="number" value={draft.min_visit_count} onChange={(e) => setDraft({ ...draft, min_visit_count: Number(e.target.value) })} /></div>
          <div><Label>Pts ×</Label><Input type="number" step="0.1" value={draft.point_multiplier} onChange={(e) => setDraft({ ...draft, point_multiplier: Number(e.target.value) })} /></div>
          <div className="md:col-span-6"><Label>Perks</Label><Input value={draft.perks} onChange={(e) => setDraft({ ...draft, perks: e.target.value })} placeholder="Gratis upgrade na 10 bestellingen" /></div>
          <div className="md:col-span-6"><Button onClick={add} disabled={saving}><Plus className="w-4 h-4 mr-2" />Toevoegen</Button></div>
        </CardContent>
      </Card>
      {loading ? <Loader2 className="animate-spin" /> : tiers.length === 0 ? (
        <p className="text-muted-foreground text-sm">Nog geen tiers. Voeg er een toe om te beginnen.</p>
      ) : (
        <div className="grid gap-3">
          {tiers.map((t) => (
            <Card key={t.id}>
              <CardContent className="flex items-center justify-between py-4">
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded-full" style={{ background: t.color }} />
                  <div>
                    <div className="font-semibold">{t.name} <span className="text-xs text-muted-foreground">×{t.point_multiplier}</span></div>
                    <div className="text-xs text-muted-foreground">Vanaf €{t.min_total_spent} · {t.min_visit_count} bezoeken{t.perks ? ` · ${t.perks}` : ""}</div>
                  </div>
                </div>
                <Button size="sm" variant="ghost" onClick={() => remove(t.id)}><Trash2 className="w-4 h-4" /></Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function SegmentsPanel({ segments, tiers, loading, reload }: { segments: Segment[]; tiers: Tier[]; loading: boolean; reload: () => void }) {
  const [draft, setDraft] = useState({ name: "", description: "", min_total_spent: 0, min_visits: 0, days_since_last_visit_max: "", marketing_opt_in: true, tier_id: "" });
  const [previews, setPreviews] = useState<Record<string, { count: number }>>({});

  const add = async () => {
    if (!draft.name.trim()) return toast.error("Naam verplicht");
    const { data: u } = await supabase.auth.getUser();
    const { data: emp } = await supabase.from("employees").select("location_id, locations(tenant_id)").eq("user_id", u.user!.id).maybeSingle();
    const tenant_id = (emp as any)?.locations?.tenant_id;
    if (!tenant_id) return toast.error("Geen tenant");
    const definition: any = {
      min_total_spent: draft.min_total_spent || 0,
      min_visits: draft.min_visits || 0,
      marketing_opt_in: draft.marketing_opt_in,
    };
    if (draft.days_since_last_visit_max) definition.days_since_last_visit_max = Number(draft.days_since_last_visit_max);
    if (draft.tier_id) definition.tier_id = draft.tier_id;
    const { error } = await supabase.from("customer_segments" as any).insert({ name: draft.name, description: draft.description, tenant_id, definition });
    if (error) return toast.error(error.message);
    setDraft({ name: "", description: "", min_total_spent: 0, min_visits: 0, days_since_last_visit_max: "", marketing_opt_in: true, tier_id: "" });
    reload();
  };
  const preview = async (id: string) => {
    const { data, error } = await supabase.rpc("segment_preview" as any, { _segment_id: id });
    if (error) return toast.error(error.message);
    setPreviews({ ...previews, [id]: data as any });
  };
  const remove = async (id: string) => {
    if (!confirm("Segment verwijderen?")) return;
    const { error } = await supabase.from("customer_segments" as any).delete().eq("id", id);
    if (error) return toast.error(error.message);
    reload();
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-base">Nieuw segment</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-6 gap-3">
          <div className="md:col-span-3"><Label>Naam</Label><Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Top spenders" /></div>
          <div className="md:col-span-3"><Label>Beschrijving</Label><Input value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} /></div>
          <div><Label>Min. spend €</Label><Input type="number" value={draft.min_total_spent} onChange={(e) => setDraft({ ...draft, min_total_spent: Number(e.target.value) })} /></div>
          <div><Label>Min. visits</Label><Input type="number" value={draft.min_visits} onChange={(e) => setDraft({ ...draft, min_visits: Number(e.target.value) })} /></div>
          <div><Label>Bezoek ≤ dagen</Label><Input type="number" value={draft.days_since_last_visit_max} onChange={(e) => setDraft({ ...draft, days_since_last_visit_max: e.target.value })} placeholder="30" /></div>
          <div>
            <Label>Tier</Label>
            <Select value={draft.tier_id || "any"} onValueChange={(v) => setDraft({ ...draft, tier_id: v === "any" ? "" : v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Alle</SelectItem>
                {tiers.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end gap-2">
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.marketing_opt_in} onChange={(e) => setDraft({ ...draft, marketing_opt_in: e.target.checked })} /> Opt-in</label>
          </div>
          <div className="md:col-span-6"><Button onClick={add}><Plus className="w-4 h-4 mr-2" />Toevoegen</Button></div>
        </CardContent>
      </Card>
      {loading ? <Loader2 className="animate-spin" /> : segments.length === 0 ? (
        <p className="text-muted-foreground text-sm">Nog geen segmenten.</p>
      ) : (
        <div className="grid gap-3">
          {segments.map((s) => (
            <Card key={s.id}>
              <CardContent className="flex items-center justify-between py-4">
                <div>
                  <div className="font-semibold">{s.name}</div>
                  <div className="text-xs text-muted-foreground">{s.description}</div>
                  <div className="text-xs mt-1 font-mono text-muted-foreground">{JSON.stringify(s.definition)}</div>
                  {previews[s.id] && <Badge variant="secondary" className="mt-2">{previews[s.id].count} klanten</Badge>}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => preview(s.id)}>Preview</Button>
                  <Button size="sm" variant="ghost" onClick={() => remove(s.id)}><Trash2 className="w-4 h-4" /></Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function CampaignsPanel({ campaigns, segments, loading, reload }: { campaigns: Campaign[]; segments: Segment[]; loading: boolean; reload: () => void }) {
  const [draft, setDraft] = useState({ name: "", channel: "push", segment_id: "", subject: "", message: "", scheduled_at: "" });

  const add = async () => {
    if (!draft.name.trim() || !draft.message.trim()) return toast.error("Naam en bericht verplicht");
    const { data: u } = await supabase.auth.getUser();
    const { data: emp } = await supabase.from("employees").select("location_id, locations(tenant_id)").eq("user_id", u.user!.id).maybeSingle();
    const tenant_id = (emp as any)?.locations?.tenant_id;
    if (!tenant_id) return toast.error("Geen tenant");
    const payload: any = {
      name: draft.name, channel: draft.channel, message: draft.message, subject: draft.subject || null,
      segment_id: draft.segment_id || null, tenant_id, created_by: u.user!.id,
      status: draft.scheduled_at ? "scheduled" : "draft",
      scheduled_at: draft.scheduled_at || null,
    };
    const { error } = await supabase.from("loyalty_campaigns" as any).insert(payload);
    if (error) return toast.error(error.message);
    setDraft({ name: "", channel: "push", segment_id: "", subject: "", message: "", scheduled_at: "" });
    reload();
  };

  const send = async (c: Campaign) => {
    if (!c.segment_id) return toast.error("Geen segment");
    const { data, error } = await supabase.rpc("segment_preview" as any, { _segment_id: c.segment_id });
    if (error) return toast.error(error.message);
    const count = (data as any)?.count ?? 0;
    if (!confirm(`Campagne verzenden naar ${count} klanten via ${c.channel}?`)) return;
    const { error: upErr } = await supabase.from("loyalty_campaigns" as any).update({
      status: "sent", sent_at: new Date().toISOString(), recipients_count: count, delivered_count: count,
    }).eq("id", c.id);
    if (upErr) return toast.error(upErr.message);
    toast.success(`Campagne gemarkeerd als verzonden (${count})`);
    reload();
  };
  const remove = async (id: string) => {
    if (!confirm("Campagne verwijderen?")) return;
    const { error } = await supabase.from("loyalty_campaigns" as any).delete().eq("id", id);
    if (error) return toast.error(error.message);
    reload();
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-base">Nieuwe campagne</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-6 gap-3">
          <div className="md:col-span-3"><Label>Naam</Label><Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></div>
          <div>
            <Label>Kanaal</Label>
            <Select value={draft.channel} onValueChange={(v) => setDraft({ ...draft, channel: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="push">PassKit push</SelectItem>
                <SelectItem value="email">E-mail</SelectItem>
                <SelectItem value="passkit">PassKit update</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2">
            <Label>Segment</Label>
            <Select value={draft.segment_id || "none"} onValueChange={(v) => setDraft({ ...draft, segment_id: v === "none" ? "" : v })}>
              <SelectTrigger><SelectValue placeholder="Kies segment" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— Geen —</SelectItem>
                {segments.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {draft.channel === "email" && (
            <div className="md:col-span-6"><Label>Onderwerp</Label><Input value={draft.subject} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} /></div>
          )}
          <div className="md:col-span-6"><Label>Bericht</Label><Textarea rows={3} value={draft.message} onChange={(e) => setDraft({ ...draft, message: e.target.value })} /></div>
          <div className="md:col-span-3"><Label>Inplannen (optioneel)</Label><Input type="datetime-local" value={draft.scheduled_at} onChange={(e) => setDraft({ ...draft, scheduled_at: e.target.value })} /></div>
          <div className="md:col-span-6"><Button onClick={add}><Plus className="w-4 h-4 mr-2" />Toevoegen</Button></div>
        </CardContent>
      </Card>
      {loading ? <Loader2 className="animate-spin" /> : campaigns.length === 0 ? (
        <p className="text-muted-foreground text-sm">Nog geen campagnes.</p>
      ) : (
        <div className="grid gap-3">
          {campaigns.map((c) => (
            <Card key={c.id}>
              <CardContent className="flex items-center justify-between py-4">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="font-semibold">{c.name}</div>
                    <Badge variant="outline">{c.channel}</Badge>
                    <Badge variant={c.status === "sent" ? "default" : "secondary"}>{c.status}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">{c.message}</div>
                  {c.recipients_count > 0 && <div className="text-xs mt-1">Verzonden: {c.delivered_count}/{c.recipients_count}</div>}
                </div>
                <div className="flex gap-2">
                  {c.status !== "sent" && <Button size="sm" onClick={() => send(c)}><Send className="w-4 h-4 mr-1" />Verzenden</Button>}
                  <Button size="sm" variant="ghost" onClick={() => remove(c.id)}><Trash2 className="w-4 h-4" /></Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
