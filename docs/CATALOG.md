# Agent catalog

Generated from `agents/<name>/` and `registry/agents.json`. Run `npm run catalog` after a change.

This repository contains **1 agent**, installable for 6 tools: `claude`, `openai`, `copilot`, `gemini`, `opencode`, `cursor`.

## build (1)

| Agent | Version | Skills it imports | Description |
| --- | --- | --- | --- |
| [bug-fixer](../agents/bug-fixer/AGENT.md) | 1.0.0 | `principle-fix-root-causes`, `principle-prove-it-works` at `v0.1.0` | Diagnoses a reported bug to its root cause, fixes it there, and proves the fix. Use when a defect is reported or a test fails; not for new features or refactors. |

## Tested with

The tool and model that ran each agent's current version. The same agent behaves differently on each, so a result only speaks for the pair it names.

- **bug-fixer** 1.0.0: not yet tested

## Version history

Newest first. Each entry says what that version is expected to do.

### bug-fixer

- **1.0.0** (2026-11-24, initial): Reproduces one reported defect, traces it to its root cause, fixes it there with the smallest change, and reports the evidence that the fix works. It stops when it cannot reproduce the problem or when the report is a feature request, and it does not commit or push unless asked.
