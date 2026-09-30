# Azure log access

Two different Azure storage services are involved, and it's easy to assume the wrong one holds
application logs. Verified by inspecting a live environment on 2026-09-30: **the File Share
does NOT hold application logs — only deployed binaries.** Application logs live in Azure Blob
Storage, written directly by NLog. Don't assume otherwise without checking `NLog.config` for the
actual environment first (see "Finding the real source" below) — deployment layout can change.

## Azure File Share — deployed binaries only

Environments have a File Share (commonly named `environments`) on a storage account discovered
via `az storage account list` (look for a `*devenv*` / `*devindia*`-style account with an
`environments` share — e.g. `devenvindia` / `sis-devenv-india-rg` for the India dev environments
as of 2026-09-30). Laid out as:

```
{environmentAlias}/{AppName}/{subApp}/{deployed .NET publish output — DLLs, NLog.config, locale dirs}
```

This is the **published app package**, not a logs directory — there is no `logs/` subfolder
here in practice, despite what an earlier version of this doc assumed. It's still useful for one
thing: reading each app's actual `NLog.config` to find out exactly where that app's real logs go
(see below), since the config can differ per app/environment.

```bash
az storage file download \
  --share-name environments \
  --path "{environmentAlias}/{AppName}/{subApp}/NLog.config" \
  --dest "<local-scratchpad-path>" \
  --account-name <storageAccount> --account-key <key>
```

(File-share download uses `--dest`, **not** `--file` — the opposite of blob download below.)

## Azure Blob Storage — where application logs actually are

NLog's `AzureBlobStorage` target writes logs (WARN and above only — see `<rules>` in
`NLog.config`) to a blob container, one blob per app per calendar day:

```
{container}/{environmentAlias}/{ServiceName}-{yyyy-MM-dd}.log
```

The container name comes from the `nlogAzureBlobStorageContainer` env var (per-app, e.g.
`enterprisemanagementdev` for EMA, `enterpriseofficedev` for EO, `distributedjobscoordinator`
for DJC) and the connection string from `ConnectionStrings__NLogBlob` (see the app's own
appsettings — the storage account was `sisapplogsindiadev` for India dev as of 2026-09-30, i.e.
the account whose connection string appears as `NLogBlob` in that app's config).

List today's (or any day's) blob for an app:

```bash
az storage blob list --container-name <container> --account-name <storageAccount> \
  --account-key <key> --prefix "{environmentAlias}/" -o table
```

Download one (blob download uses `--file`, **not** `--dest`):

```bash
az storage blob download \
  --container-name <container> \
  --name "{environmentAlias}/{ServiceName}-{yyyy-MM-dd}.log" \
  --file "<local-scratchpad-path>" \
  --account-name <storageAccount> --account-key <key>
```

## Finding the real source for real, don't assume

Before hardcoding a container/account name, pull the target app's own `NLog.config` from the
File Share (see above) and read its `<targets>`/`<rules>` — it names the exact blob container
env var, the minlevel actually being logged (often `Warn`, meaning INFO-level lines are never
captured at all — don't expect to find them), and the blob naming pattern. Confirms drift
instead of reusing a value discovered for a different app or a different day.

## Getting storage account keys

Fetch keys with a standalone command, not inside a shell `for` loop assigning
`KEY=$(...)` per iteration — that has silently returned empty for some accounts in practice.
Run the key-fetch once per account as its own command and capture the result before using it.
Delete any downloaded key/connection-string files from the scratchpad once you're done with
them in the session — don't leave live account keys sitting around as loose files.

```bash
az storage account keys list --account-name <storageAccount> --resource-group <rg> \
  --query "[0].value" -o tsv
```

## Log entry format

Application log lines start a new entry with a leading timestamp:

```
YYYY-MM-DD HH:MM:SS.ffffUTC LEVEL - Category: message...
```

Continuation lines (stack frames, wrapped SQL text, wrapped exception detail) have no leading
timestamp and belong to the entry above them — `scripts/gen_logs.js` groups on this pattern
before reversing for newest-first display, so multi-line stack traces stay internally ordered.
