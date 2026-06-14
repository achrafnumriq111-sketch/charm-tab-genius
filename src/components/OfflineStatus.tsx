import { motion } from "framer-motion";
import { Cloud, CloudOff, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { syncEngine } from "@/lib/offline/syncEngine";
import { cn } from "@/lib/utils";

export function OfflineStatus({ className }: { className?: string }) {
  const { online, pendingCount, syncing } = useOnlineStatus();

  const label = !online
    ? `Offline${pendingCount ? ` · ${pendingCount} pending` : ""}`
    : syncing
      ? "Syncing…"
      : pendingCount
        ? `${pendingCount} pending`
        : "Online";

  const Icon = !online ? CloudOff : syncing ? RefreshCw : Cloud;

  return (
    <button
      type="button"
      onClick={() => {
        void syncEngine.pushNow();
        void syncEngine.pullNow();
      }}
      className={cn(
        "inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition-colors min-h-[44px] sm:min-h-0",
        !online
          ? "bg-destructive/15 text-destructive"
          : pendingCount
            ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
            : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
        className,
      )}
      title="Klik om handmatig te synchroniseren"
    >
      <motion.span
        animate={syncing ? { rotate: 360 } : { rotate: 0 }}
        transition={
          syncing
            ? { duration: 1.2, repeat: Infinity, ease: "linear" }
            : { duration: 0.2 }
        }
        className="flex"
      >
        <Icon className="h-3.5 w-3.5" />
      </motion.span>
      <span>{label}</span>
      {pendingCount > 0 && (
        <Badge variant="secondary" className="h-4 px-1 text-[10px]">
          {pendingCount}
        </Badge>
      )}
    </button>
  );
}
