// Claude Code: a project subagent at .claude/agents/<name>.md.
// `name` and `description` are the only required fields. `skills` preloads the
// named skills' content when the agent starts; without it the agent can still
// find and invoke project skills. The same file runs as the main agent with
// `claude --agent <name>`.
import { markdownAgent } from './shared.mjs';

export default {
  id: 'claude',
  label: 'Claude Code',
  skillsAgents: ['claude-code'],
  docs: [{ url: 'https://code.claude.com/docs/en/sub-agents', checked: '2026-11-24' }],
  use: 'Delegated to automatically by its description, or run as the main agent with `claude --agent <name>`.',
  render(agent) {
    const frontmatter = { name: agent.name, description: agent.description };
    if (agent.skills.skills.length) frontmatter.skills = agent.skills.skills;
    return [{ path: `.claude/agents/${agent.name}.md`, mode: 'file', content: markdownAgent(agent, frontmatter) }];
  },
};
