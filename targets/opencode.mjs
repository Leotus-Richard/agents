// OpenCode: an agent at .opencode/agents/<name>.md. The filename is the agent's name;
// a `name` field is ignored. `mode` is always written because its default differs
// between OpenCode 1 (all) and OpenCode 2 (primary). There is no field for skills,
// so the instructions name them.
import { markdownAgent, skillsNote } from './shared.mjs';

export default {
  id: 'opencode',
  label: 'OpenCode',
  skillsAgents: ['opencode'],
  docs: [
    { url: 'https://opencode.ai/docs/agents/', checked: '2026-11-24' },
    { url: 'https://opencode.ai/docs/skills/', checked: '2026-11-24' },
  ],
  use: 'Run `opencode run --agent <name>`, switch to the agent in the TUI, or let OpenCode delegate to it by its description.',
  render(agent) {
    // `all` lets the agent be chosen as the main agent and delegated to as a subagent.
    const frontmatter = { description: agent.description, mode: 'all' };
    return [{
      path: `.opencode/agents/${agent.name}.md`,
      mode: 'file',
      content: markdownAgent(agent, frontmatter, `${agent.body}${skillsNote(agent)}`),
    }];
  },
};
