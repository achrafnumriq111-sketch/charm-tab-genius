#!/usr/bin/env node
// scripts/qa-guards.mjs
// Runs both isolation guard suites and exits non-zero on any failure.
//
// Required env:
//   SUPABASE_URL              — project URL (or VITE_SUPABASE_URL)
//   SUPABASE_SERVICE_ROLE_KEY — to call qa_structural_isolation_checks RPC
//   QA_GUARD_SECRET           — shared secret for the behavioral function
//
// Usage:
//   node scripts/qa-guards.mjs            # both suites
//   node scripts/qa-guards.mjs structural # SQL invariants only
//   node scripts/qa-guards.mjs behavioral # cross-tenant runtime only

const URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SECRET = process.env.QA_GUARD_SECRET;
const which = process.argv[2] || "all";

if (!URL) { console.error("Missing SUPABASE_URL"); process.exit(2); }

let failed = 0;

async function runStructural() {
  if (!SERVICE) throw new Error("SUPABASE_SERVICE_ROLE_KEY required for structural suite");
  const res = await fetch(`${URL}/rest/v1/rpc/qa_structural_isolation_checks`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SERVICE,
      Authorization: `Bearer ${SERVICE}`,
    },
    body: "{}",
  });
  const body = await res.json();
  console.log("\n=== STRUCTURAL ISOLATION CHECKS ===");
  if (!Array.isArray(body)) {
    console.error("Unexpected response:", body);
    failed++; return;
  }
  for (const row of body) {
    const mark = row.status === "pass" ? "✓" : "✗";
    console.log(`${mark} ${row.check_name} — ${row.status}${row.status === "fail" ? "  " + JSON.stringify(row.details) : ""}`);
    if (row.status !== "pass") failed++;
  }
}

async function runBehavioral() {
  if (!SECRET) throw new Error("QA_GUARD_SECRET required for behavioral suite");
  const res = await fetch(`${URL}/functions/v1/qa-isolation-behavioral`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-qa-secret": SECRET },
    body: "{}",
  });
  const body = await res.json();
  console.log("\n=== BEHAVIORAL CROSS-TENANT CHECKS ===");
  if (!body.checks) {
    console.error("Unexpected response:", body);
    failed++; return;
  }
  for (const c of body.checks) {
    const mark = c.status === "pass" ? "✓" : "✗";
    console.log(`${mark} ${c.name} — ${c.status}${c.status === "fail" ? "  " + JSON.stringify(c.details) : ""}`);
    if (c.status !== "pass") failed++;
  }
  if (body.error) { console.error("Function error:", body.error); failed++; }
}

try {
  if (which === "all" || which === "structural") await runStructural();
  if (which === "all" || which === "behavioral") await runBehavioral();
} catch (e) {
  console.error("Guard runner crashed:", e.message);
  process.exit(2);
}

console.log(`\n${failed === 0 ? "All guards passed ✓" : `${failed} guard(s) failed ✗`}`);
process.exit(failed === 0 ? 0 : 1);
