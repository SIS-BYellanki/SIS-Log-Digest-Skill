# Service Bus subscription filter checks

Subscriptions use SQL filters matching message application-properties by name. **Property names
are case-sensitive** and must match `AzureServiceBusMessageConstants` exactly.

## Correct casing

The constants are **PascalCase**:

```
EnvironmentAlias, ApplicationSource, TargetApplication, EventSubType,
TenantName, TenantId, EventId, EventType
```

A filter written with camelCase (`environmentAlias`) or any other casing looks plausible but
silently matches zero messages — Service Bus doesn't error on a filter that never matches, it
just never delivers. Don't assume an existing subscription's filter is correct just because it
was copied from another "working" one; verify both.

## Verifying the ground truth

Don't guess the constant names from memory or from one example subscription. Confirm them
against the actual NuGet package via PowerShell reflection instead of touching the live Service
Bus resource:

```powershell
$asm = [System.Reflection.Assembly]::LoadFrom("<path-to-package-dll>")
$type = $asm.GetType("<Namespace>.AzureServiceBusMessageConstants")
$type.GetFields() | Select-Object Name, @{n='Value';e={$_.GetRawConstantValue()}}
```

## Reading/creating subscriptions and filters

```bash
az servicebus topic subscription list --resource-group <rg> --namespace-name <ns> --topic-name <topic> -o table
az servicebus topic subscription rule list --resource-group <rg> --namespace-name <ns> --topic-name <topic> --subscription-name <sub> -o table
```

When asked to create a new subscription "matching an existing pattern," reproduce the naming
convention and namespace, but verify the filter casing independently rather than copying it
verbatim — the existing one may itself be wrong (this happened with `admin-*-EMA` subscriptions
on env 346956, where both `e1` and `e2` had the same camelCase mistake).

## Scope discipline

If asked to fix one broken subscription, don't also "fix" sibling subscriptions that weren't
called out — confirm with the user before touching anything not explicitly in scope.

## Sensitive values

Never embed a raw Service Bus connection string (with `SharedAccessKey`) in a script file, even
a scratchpad one. Use `az servicebus` CLI commands (which use the caller's own `az login`
credentials) instead of connection-string-based access.
