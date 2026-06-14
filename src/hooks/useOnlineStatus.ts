import { useEffect, useState } from "react";
import { subscribe, type SyncStatus } from "@/lib/offline/syncEngine";

export function useOnlineStatus(): SyncStatus {
  const [status, setStatus] = useState<SyncStatus>({
    online: typeof navigator !== "undefined" ? navigator.onLine : true,
    pendingCount: 0,
    syncing: false,
    lastError: null,
    lastSyncAt: null,
  });
  useEffect(() => subscribe(setStatus), []);
  return status;
}
