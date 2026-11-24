# Targets

How each supported tool stores an agent, finds its skills and runs it. Every fact here was read from the tool's own documentation on 24 November 2026; the links are in each section. These formats change, so recheck the documentation before changing an adapter in `targets/`.

One `AGENT.md` produces all six files. Where a tool has a field that loads skills into an agent by name, the adapter uses it. Where it has none, the adapter adds a short Skills section to the instructions that names the skills, and the agent loads them from the project's skills folder.

| Target | Agent file | Skills folder | Skills attached by |
| --- | --- | --- | --- |
| `claude` | `.claude/agents/<name>.md` | `.claude/skills/` | `skills` field, which preloads them |
| `openai` | `.codex/agents/<name>.toml` | `.agents/skills/` | named in the instructions |
| `copilot` | `.github/agents/<name>.agent.md` | `.agents/skills/` | `skills` field, and named in the instructions |
| `gemini` | `.agents/agents/<name>.md` | `.agents/skills/` | named in the instructions |
| `opencode` | `.opencode/agents/<name>.md` | `.agents/skills/` | named in the instructions |
| `cursor` | `.cursor/agents/<name>.md` | `.agents/skills/` | named in the instructions |

Five of the six tools share `.agents/skills/`, so installing for several of them does not multiply the skill copies.

## claude: Claude Code

- **File:** Markdown with YAML frontmatter. `name` and `description` are the only required fields.
- **Skills:** the `skills` field preloads the named skills when the agent starts. Without it the agent can still find and invoke project skills.
- **Run it:** Claude Code delegates to the agent by its description, or `claude --agent <name>` runs it as the main agent.
- **Source:** <https://code.claude.com/docs/en/sub-agents>

## openai: OpenAI Codex

- **File:** TOML, with `name`, `description` and `developer_instructions` required. The agent's identity comes from `name`, not the filename.
- **Skills:** an agent inherits its parent's skills. It has no field to attach or preload particular ones.
- **Run it:** name the agent in your prompt. Codex has no flag that selects an agent.
- **Not documented:** which characters a name may use. The documentation's examples use underscores; these agents use hyphens.
- **Source:** <https://learn.chatgpt.com/docs/agent-configuration/subagents>, <https://learn.chatgpt.com/docs/build-skills>

## copilot: GitHub Copilot

- **File:** Markdown with YAML frontmatter. `description` is required, and the body may be at most 30,000 characters.
- **Read by:** the Copilot CLI, VS Code, and the cloud agent on github.com. The cloud agent reads the file only once it is on the default branch.
- **Skills:** the `skills` field loads the named skills. It is documented for VS Code and the CLI, not for the cloud agent, so the instructions name the skills too.
- **Known gap:** the Copilot CLI and the cloud agent read `.agents/skills/`. VS Code's Copilot harness documents only `.github/skills/`, so skills installed here may not be visible there.
- **Run it:** pick the agent in the agent menu, or `copilot --agent <name> --prompt "..."`.
- **Source:** <https://docs.github.com/en/copilot/reference/custom-agents-configuration>, <https://code.visualstudio.com/docs/agents/reference/custom-agent-file-reference>, <https://docs.github.com/en/copilot/concepts/agents/about-agent-skills>

## gemini: Gemini through Google Antigravity

- **File:** Markdown with YAML frontmatter, for the Antigravity app and the `agy` CLI. `name` and `description` are required.
- **Skills:** an agent sees the project's skills by default. Its `skills` field takes paths, and the documentation does not say what they are relative to, so the adapter leaves the field out.
- **Run it:** `agy --agent <name>`, the agent menu in the app, or delegation by description.
- **Not targeted:** the older Gemini CLI, which reads `.gemini/agents/` instead.
- **Source:** <https://antigravity.google/docs/subagents>, <https://antigravity.google/docs/skills>

## opencode: OpenCode

- **File:** Markdown with YAML frontmatter. The filename is the agent's name; a `name` field is ignored.
- **Mode:** the adapter always writes `mode: all`, so the agent can be the main agent or a subagent. The default differs between OpenCode 1 and OpenCode 2, so it is never left out.
- **Skills:** no field attaches skills to an agent.
- **Run it:** `opencode run --agent <name>`, switch to the agent in the TUI, or delegation by description.
- **Source:** <https://opencode.ai/docs/agents/>, <https://opencode.ai/docs/skills/>

## cursor: Cursor

- **File:** Markdown with YAML frontmatter, read by the editor, the CLI and cloud agents. The documented fields are `name`, `description`, `model`, `readonly` and `is_background`.
- **Skills:** no field attaches skills to a subagent, and a subagent inherits its parent's tools.
- **Run it:** type `/<name>` in the prompt, ask for the agent by name, or let Cursor delegate by description. The CLI has no flag that selects a subagent.
- **Source:** <https://cursor.com/docs/subagents>, <https://cursor.com/docs/skills>

## Adding a target

Add one file in `targets/` that exports `id`, `label`, `skillsAgents` (the tool's name in the Skills CLI), `docs`, `use`, and a `render(agent)` function returning the files to write. Register it in `targets/index.mjs`, add its row here, and add its expected path to the format test in `tests/install.test.mjs`.
