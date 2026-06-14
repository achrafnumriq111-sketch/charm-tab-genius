# CI Setup — QA Supabase Project

The CI pipeline (`.github/workflows/ci.yml`) runs two jobs on every pull request:

1. **Vitest** — frontend unit tests (no secrets needed; always runs).
2. **Edge function pen-tests** — calls `qa-invite-tests` and `qa-pentest` against a **separate** Supabase project to keep production safe.

The pen-test job auto-skips when the GitHub Variable `QA_TESTS_ENABLED` is not `true`. Until you finish the steps below, only Vitest runs — Vitest alone already catches RBAC, logout, and location-context regressions.

---

## One-time setup (15 min)

### 1. Create a free QA Supabase project

1. Go to https://supabase.com/dashboard and click **New project**.
2. Name it `saakouk-pos-qa` (or anything you want). Pick the **Free** tier.
3. Wait until it's provisioned, then open **Project Settings → API**.
4. Copy:
   - **Project URL** → becomes `QA_SUPABASE_URL`
   - **anon** public key → becomes `QA_SUPABASE_ANON_KEY`

### 2. Apply schema + edge functions to the QA project

Easiest way: install the Supabase CLI locally, then from this repo:

```bash
# One-time: link the local repo to the QA project
supabase link --project-ref <qa-project-ref>

# Push every migration in supabase/migrations/ to QA
supabase db push

# Deploy the QA test edge functions
supabase functions deploy qa-invite-tests
supabase functions deploy qa-pentest      # if/when re-added
supabase functions deploy invite-accept
supabase functions deploy employee-invite
supabase functions deploy pos-login
```

> The QA project mirrors prod schema but stays empty between runs — every test creates throwaway data and cleans itself up.

### 3. Add GitHub secrets + variable

In your GitHub repo, go to **Settings → Secrets and variables → Actions**:

**Secrets** (encrypted, used by the pen-test step):
| Name | Value |
|---|---|
| `QA_SUPABASE_URL` | the QA project URL from step 1 |
| `QA_SUPABASE_ANON_KEY` | the QA anon key from step 1 |

**Variables** (plain text, controls whether the job runs):
| Name | Value |
|---|---|
| `QA_TESTS_ENABLED` | `true` |

### 4. Open a pull request

Push any branch and open a PR. You should see two CI checks: **Vitest** and **Edge function pen-tests**. Both must pass before the PR can merge (configure branch protection in GitHub if you want this enforced).

---

## Troubleshooting

**"QA secrets not configured — skipping pen-tests"**
→ Either you haven't added the secrets yet, or you forgot to set `QA_TESTS_ENABLED=true`.

**"Pen-tests failed" with all-pass false**
→ Open the workflow log; each test case is printed with `expected` vs `actual`. Fix the regression, push again.

**Cleanup failed → orphan rows in QA project**
→ Run this once in the QA SQL editor:
```sql
DELETE FROM public.tenants WHERE slug LIKE 'qa-%';
DELETE FROM auth.users WHERE email LIKE '%@qa.saakouk.test';
```

**Pen-tests pass locally but fail in CI**
→ Most often a missing migration in the QA project. Re-run `supabase db push` against the QA project ref.

---

## Why a separate project?

- Prevents test failures from leaving rows in production.
- Lets CI run on every PR without ever touching real tenants' data.
- Free tier is more than enough — the tests only create a handful of rows and delete them in the same call.
