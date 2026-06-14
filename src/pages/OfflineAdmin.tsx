import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { offlineDb } from "@/lib/offline/db";
import { listDLQ, resetDLQEntry } from "@/lib/offline/outbox";
import { syncEngine } from "@/lib/offline/syncEngine";
import type { OutboxEntry } from "@/lib/offline/db";
import { toast } from "sonner";

export default function OfflineAdmin() {
  const status = useOnlineStatus();
  const [pending, setPending] = useState<OutboxEntry[]>([]);
  const [dlq, setDlq] = useState<OutboxEntry[]>([]);

  const refresh = async () => {
    const all = await offlineDb.outbox.toArray();
    setPending(all.filter((e) => e.status !== "dlq"));
    setDlq(await listDLQ());
  };

  useEffect(() => {
    void refresh();
    const t = window.setInterval(refresh, 2000);
    return () => clearInterval(t);
  }, []);

  const wipeCache = async () => {
    await Promise.all(
      offlineDb.tables
        .filter((t) => t.name.startsWith("cache_"))
        .map((t) => t.clear()),
    );
    await offlineDb.sync_meta.clear();
    toast.success("Cache leeggemaakt — sync wordt opnieuw geladen");
    await syncEngine.pullNow();
  };

  return (
    <div className="container mx-auto max-w-5xl space-y-6 py-8">
      <header className="space-y-1">
        <h1 className="text-3xl font-bold">Offline-modus</h1>
        <p className="text-muted-foreground">
          Status, outbox en lokale cache voor de POS.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Status</span>
            <Badge variant={status.online ? "default" : "destructive"}>
              {status.online ? "Online" : "Offline"}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <div className="text-muted-foreground">In wachtrij</div>
            <div className="text-2xl font-semibold">{status.pendingCount}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Laatste sync</div>
            <div className="text-lg">
              {status.lastSyncAt
                ? new Date(status.lastSyncAt).toLocaleTimeString()
                : "—"}
            </div>
          </div>
          {status.lastError && (
            <div className="sm:col-span-2 rounded-md bg-destructive/10 p-3 text-destructive">
              {status.lastError}
            </div>
          )}
          <div className="sm:col-span-2 flex flex-wrap gap-2">
            <Button onClick={() => syncEngine.pushNow()} disabled={!status.online}>
              Push nu
            </Button>
            <Button
              variant="outline"
              onClick={() => syncEngine.pullNow()}
              disabled={!status.online}
            >
              Pull nu
            </Button>
            <Button variant="destructive" onClick={wipeCache}>
              Cache wissen
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Outbox ({pending.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {pending.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Geen wachtende mutaties. Alles is gesynchroniseerd.
            </p>
          ) : (
            <ul className="divide-y text-sm">
              {pending.map((e) => (
                <li key={e.id} className="flex items-center justify-between py-2">
                  <div>
                    <div className="font-medium">{e.type}</div>
                    <div className="text-xs text-muted-foreground">
                      {e.uuid} · pogingen {e.attempts}
                    </div>
                  </div>
                  <Badge variant="outline">{e.status}</Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {dlq.length > 0 && (
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle className="text-destructive">
              Dead-letter queue ({dlq.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y text-sm">
              {dlq.map((e) => (
                <li key={e.id} className="flex items-center justify-between py-2 gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{e.type}</div>
                    <div className="text-xs text-destructive truncate">
                      {e.last_error ?? "Onbekende fout"}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      if (e.id) await resetDLQEntry(e.id);
                      await refresh();
                    }}
                  >
                    Opnieuw proberen
                  </Button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
