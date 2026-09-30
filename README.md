# Status Dashboard Skill

A Claude Code project skill that builds and publishes a live-data status dashboard Artifact for
a SISEnterprise dev/test environment: per-app logs (newest-first, highlighted ERROR/WARN),
optional Hangfire job status, optional Service Bus subscription/filter checks, and a ranked
action-items list.

See [SKILL.md](SKILL.md) for the full runbook. [`346957e1-example-dashboard.html`](346957e1-example-dashboard.html)
is a real worked example — open it in a browser to see the finished result.

## Install

Clone this repo directly into your SISEnterprise checkout's skills folder, named
`status-dashboard`:

```bash
git clone https://github.com/SIS-BYellanki/Status-Dashboard-Skill.git \
  <your-SISEnterprise-repo-path>/.claude/skills/status-dashboard
```

(The `.claude` folder itself is gitignored in the SISEnterprise repo, so this has to be a manual
clone/copy rather than something that comes through `git pull` there.)

## Prerequisites

- Node.js (for the log-processing scripts)
- Azure CLI, logged in (`az login`) with access to the environment's storage accounts /
  Postgres / Service Bus namespace
- A Claude Code session with Artifact publishing access

## Use

Open Claude Code in your SISEnterprise repo and either run `/status-dashboard <environmentAlias>
<workItemId>` or just ask in plain language — Claude will pick up the skill from its
description in `SKILL.md`.
