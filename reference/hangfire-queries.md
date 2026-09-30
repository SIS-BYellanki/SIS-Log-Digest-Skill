# Hangfire job queries (Postgres)

Hangfire Pro + PostgreSQL backend. No `psql` is available locally in most dev setups — use a
scratchpad Node project with the `pg` npm package instead:

```bash
mkdir -p <scratchpad>/hfquery && cd <scratchpad>/hfquery
npm init -y && npm install pg
```

Set the connection string in an env var (never hardcode it in a committed file):

```bash
export PG_CONN="postgresql://user:pass@host:port/EnterpriseDatabase"
```

```js
const { Client } = require('pg');
const client = new Client({ connectionString: process.env.PG_CONN, ssl: { rejectUnauthorized: false } });
await client.connect();
```

## Schema layout

- `hangfire.job` / `hangfire.state` / `hangfire.set` / `hangfire.hash` — Hangfire's own tables.
  `hangfire.job.createdat` etc. are `timestamptz` (correctly timezone-aware).
- `hangfire.jobqueue` — currently-queued jobs; `hangfire.server` — active worker heartbeats.
- `public.managed_jobs` — app-level wrapper table around Hangfire jobs, with
  `public.work_subjects` / `public.managed_job_status` / `public.managed_job_types` as lookups.
  Supports `parent_managed_job_id` for Hangfire Pro batch children.

## Timezone gotcha

`public.managed_jobs.created_date` / `modified_date` are **naive** (no-timezone) columns that
actually store **IST wall-clock** values. A naive driver read of these will mislabel them as
UTC, making a job look ~5.5 hours older than it is. Cross-check against `hangfire.job.createdat`
(or another `timestamptz` column) for the same job/batch before reporting an age or a "stuck
since" time — don't trust `managed_jobs` timestamps in isolation.

## Stuck Hangfire Pro batches

A batch (parent) job can appear permanently "pending" not because it's hung, but because one or
more of its children failed terminally and never clear the batch's own bookkeeping in
`hangfire.set`/`hangfire.hash`. Look up the batch's guid, find its children via
`parent_managed_job_id`, and check each child's `hangfire.state` — a batch stuck at 100% isn't a
new bug if all children show the same underlying exception; report it as the same root cause,
not a separate finding.
