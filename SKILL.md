---
name: status-dashboard
description: Build and publish a live-data status dashboard Artifact for a dev/test environment (logs, Hangfire jobs, Service Bus subscriptions) tied to a work item — the reusable version of the process used for env 346957e1 / work item 346957.
args: "<environmentAlias> <workItemId> [appNames...]"
---

# Status dashboard for an environment / work item

Produces a snapshot HTML dashboard (published as a private Claude Artifact) summarizing an
environment's health for a specific work item: per-app log errors/warnings with a full,
newest-first log viewer, optional Hangfire job status, optional Service Bus subscription/filter
checks, and a ranked action-items list.

**This is always a point-in-time snapshot, never a live view.** Regenerate and republish rather
than trying to keep one artifact "live" — say so explicitly in the dashboard header
(`Snapshot as of <time> — Not live, ask Claude to refresh`).

**Artifacts are owned per Claude account.** Sharing an existing dashboard only gives a teammate
read access to *that* snapshot. Each team member who wants their own environment/story covered
needs to run this skill in their own session — it produces a new artifact they own.

## Inputs

- `environmentAlias` — e.g. `346957e1`. Ask if not given.
- `workItemId` — e.g. `346957`. Ask if not given.
- `appNames` — which apps to cover (e.g. `EMA EO DistributedJobCoordinator`). If not given, ask
  the user which apps are actually relevant to their story — don't default to covering every app
  in the repo. Valid app folder names under the environment's file share: `EMA`, `EO`,
  `ChartsBackend`, `ChartsFrontEnd`, `entmaster`, `portal`, `ppe`, `SISGateway`,
  `distjobcoordinator`, `elp`, `sisinventory*`.
- Ask up front whether Hangfire jobs and/or Service Bus subscriptions matter for this story —
  both sections are optional and should be skipped (not stubbed empty) when irrelevant.

## Step 1 — Pull today's logs per app

Application logs live in **Azure Blob Storage** (written by NLog directly, one blob per app per
day) — the `environments` Azure File Share holds only deployed binaries, not logs, despite how
that might sound. See [reference/azure-log-access.md](reference/azure-log-access.md) for how to
discover the right storage account/container per app (don't assume — pull the app's own
`NLog.config` first) and the blob-vs-file-share flag gotcha: file-share download uses `--dest`,
blob download uses `--file`.

Save each app's log to the scratchpad, e.g. `{environmentAlias}-{app}-full.log`.

## Step 2 — Build the reversed (newest-first), highlighted log blocks

Run the bundled script once per app:

```bash
node scripts/gen_logs.js <id> <label> <logFilePath> <outDir> ["<note>"]
```

- `id` — the HTML id to use for the `<pre>` block, e.g. `log-ema`.
- `note` — optional short text appended to the summary line, e.g. `"47 ERROR, 135 WARN"`.

This groups raw lines into entries (a new entry starts at a `YYYY-MM-DD HH:MM:SS` line;
continuation lines — stack frames — stay attached to the entry above them), reverses the
*entries* (not raw lines, so multi-line stack traces keep their internal order), and writes
`block-<id>.html` to `outDir`.

## Step 3 — Compose the dashboard HTML

Start from [template/dashboard-skeleton.html](template/dashboard-skeleton.html) — it carries the
validated CSS token system (light/dark themes) and section structure. Copy it to the scratchpad
and replace each `<!-- TODO: ... -->` marker with real content for this story:

- Header: work item id, environment alias, snapshot timestamp.
- Action items: rank by severity (critical/warning/info), one `<a class="action-row">` per
  finding, linking to the relevant section via `#anchor`.
- At-a-glance pills: one per app/component covered.
- Environment overview: one `.env-block` per app, each with a short `<p class="log-line">`
  summary — **do not duplicate the same value's formatting logic across templates; write one
  summary sentence per finding.**
- Hangfire jobs / Service Bus sections: include only if Step 0 said they're in scope. See
  [reference/hangfire-queries.md](reference/hangfire-queries.md) and
  [reference/service-bus-filters.md](reference/service-bus-filters.md).

Leave the `<details class="log-details"><pre class="log-full" id="log-X"></pre></details>`
placeholders empty for now — Step 4 inserts the real content safely.

## Step 4 — Splice in the log blocks

**Do not hand-write a regex to insert these blocks into an already-large HTML file — a
lazy-quantifier regex searched from the top of the document can span across an earlier
already-inserted block and silently delete large chunks of the file.** This happened once
building the original 346957e1 dashboard (a `resplice.js` bug silently shrank a 448KB file to
37KB). Always use the bundled script instead, which locates each block by its unique `id`
marker and only touches the nearest enclosing `<details>...</details>`:

```bash
node scripts/splice.js <dashboardPath> <id1>=<blockPath1> [<id2>=<blockPath2> ...]
```

It prints the pre/post byte counts and a sanity check (open/close `<details>` counts, and that
each id appears exactly once) — check those numbers make sense (should grow by roughly the sum
of the block sizes, never shrink) before publishing.

## Step 5 — Verify, then publish

Before publishing: re-read the spliced file and spot-check that the first two lines of each log
block are actually the newest entries (highest timestamp) and the last two are the oldest.

Publish with the `Artifact` tool as a **new artifact** (no `url` — do not reuse a prior story's
artifact URL) with a title like `Environment {alias} Status`. Tell the user the link and remind
them it is private by default; if they want teammates to see it, point them at the artifact's
Share menu rather than trying to make this session share it for them.

## Refreshing later

To refresh the same story's dashboard, repeat Steps 1–4 into a fresh copy of the file, then
`Artifact` publish with the *same* `url` to update it in place (keeps the same link).
