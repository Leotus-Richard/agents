# agents

Agents I found useful in my software development lifecycle. Each agent is a short definition plus a list of the skills it imports from [AI-SKILLS](https://github.com/Leotus-Richard/AI-SKILLS). You install an agent into a project for the coding tools you choose, and only those.

The [catalog](docs/CATALOG.md) lists the agents by lifecycle stage, with what each version is expected to do and which tool and model tested it.

## Install an agent

Run this in the project that will use the agent. Node.js 22.20.0 or newer and Git are required.

```sh
npx --yes github:Leotus-Richard/agents#<tag or commit> --agent bug-fixer --target claude opencode
```

- `--agent` names the agents to install.
- `--target` names the tools to install them for. Nothing is installed for a tool you do not name, and there is no "all" default.

For each tool you name, the command writes the agent in that tool's own format. It then installs the skills the agent imports, along with any skills those require, at the AI-SKILLS revision the agent pins.

| Target | Tool | File written |
| --- | --- | --- |
| `claude` | Claude Code | `.claude/agents/<name>.md` |
| `openai` | OpenAI Codex | `.codex/agents/<name>.toml` |
| `copilot` | GitHub Copilot | `.github/agents/<name>.agent.md` |
| `gemini` | Gemini through Google Antigravity | `.agents/agents/<name>.md` |
| `opencode` | OpenCode | `.opencode/agents/<name>.md` |
| `cursor` | Cursor | `.cursor/agents/<name>.md` |

[Targets](docs/TARGETS.md) says how each tool finds and runs the agent, and what is known not to work.

Other options:

| Option | Effect |
| --- | --- |
| `--list` | Lists the agents and targets, and installs nothing |
| `--print` | Shows what would be written and run, and changes nothing |
| `--dir <path>` | Installs into another project folder |
| `--no-skills` | Writes the agent files only |
| `--force` | Replaces a file this tool did not write |

The command never replaces a file it did not write unless you pass `--force`. Files it wrote carry a marker line, so running it again updates them.

## How an agent is defined

```
agents/<name>/
  AGENT.md       the agent: its role, workflow, limits and output
  skills.json    the skills it imports, and the AI-SKILLS tag or commit they are pinned to
```

- **An agent holds only what is specific to it.** Anything reusable belongs in AI-SKILLS as a skill, and the agent imports it.
- **Skills are never copied into this repository.** `skills.json` names them; the install fetches them.
- **Every imported skill is named in `AGENT.md`** at the step where the agent should use it. Validation fails otherwise.
- **`AGENT.md` is tool-neutral.** The adapters in `targets/` turn it into each tool's format, so a definition is written once.
- **No secrets.** This repository is public.

`registry/agents.json` records each agent's lifecycle stage and version history. It also records which tool and model tested each version, because the same agent behaves differently on each.

## Develop

```sh
npm ci
npm run validate       # definitions, skills manifests, registry, and that every agent renders for every target
npm run catalog        # regenerate docs/CATALOG.md
npm test
npm run check:skills   # needs the network: every imported skill exists at its pinned revision
```

To try an agent from a checkout, run `npm run agents:install -- --agent <name> --target <tool> --dir <project>`.

## License

Apache-2.0. See [LICENSE](LICENSE).
