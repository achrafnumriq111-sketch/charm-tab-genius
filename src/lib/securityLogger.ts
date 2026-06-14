/**
 * Client-side security event logger.
 *
 * Detects RLS rejects (Postgres code 42501) and cross-tenant access attempts
 * and writes them to `security_events` via the `log_security_event` RPC.
 *
 * Usage:
 *   const { data, error } = await supabase.from("foo").select();
 *   if (error) logIfSecurityError(error, { table: "foo", action: "select" });
 *
 * Or wrap a promise:
 *   const result = await withSecurityLogging(
 *     supabase.from("foo").select(),
 *     { table: "foo", action: "select" }
 *   );
 */
import { supabase } from "@/integrations/supabase/client";
import type { PostgrestError } from "@supabase/supabase-js";

export type SecuritySeverity = "info" | "warning" | "critical";

export interface SecurityContext {
  table?: string;
  action?: string;
  resource?: string;
  eventType?: string;
  severity?: SecuritySeverity;
  metadata?: Record<string, unknown>;
}

const RLS_REJECT_CODE = "42501";

function classify(error: PostgrestError | Error | null | undefined): {
  isSecurity: boolean;
  eventType: string;
  severity: SecuritySeverity;
  code?: string;
} {
  if (!error) return { isSecurity: false, eventType: "", severity: "info" };

  const code = (error as PostgrestError).code;
  const msg = error.message?.toLowerCase() ?? "";

  if (code === RLS_REJECT_CODE || msg.includes("row-level security") || msg.includes("permission denied")) {
    return { isSecurity: true, eventType: "rls_reject", severity: "warning", code };
  }
  if (msg.includes("cross-tenant") || msg.includes("wrong tenant")) {
    return { isSecurity: true, eventType: "cross_tenant_attempt", severity: "critical", code };
  }
  return { isSecurity: false, eventType: "", severity: "info", code };
}

export async function logSecurityEvent(
  eventType: string,
  context: SecurityContext = {},
  error?: PostgrestError | Error | null,
): Promise<void> {
  try {
    await supabase.rpc("log_security_event", {
      _event_type: eventType,
      _severity: context.severity ?? "warning",
      _source: "client",
      _target_table: context.table ?? null,
      _target_resource: context.resource ?? null,
      _error_code: (error as PostgrestError)?.code ?? null,
      _error_message: error?.message ?? null,
      _request_path: typeof window !== "undefined" ? window.location.pathname : null,
      _user_agent: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 500) : null,
      _ip_address: null,
      _metadata: {
        action: context.action,
        ...(context.metadata ?? {}),
      } as never,
    });
  } catch {
    // Never let logging break the calling flow.
  }
}

export function logIfSecurityError(
  error: PostgrestError | Error | null | undefined,
  context: SecurityContext = {},
): boolean {
  const cls = classify(error);
  if (!cls.isSecurity) return false;
  void logSecurityEvent(context.eventType ?? cls.eventType, { ...context, severity: context.severity ?? cls.severity }, error);
  return true;
}

export async function withSecurityLogging<T extends { error: PostgrestError | null }>(
  query: PromiseLike<T>,
  context: SecurityContext,
): Promise<T> {
  const result = await query;
  if (result?.error) logIfSecurityError(result.error, context);
  return result;
}
