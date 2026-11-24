// Gemini through Google Antigravity (the app and the `agy` CLI): a custom agent at
// .agents/agents/<name>.md. `name` and `description` are required. An agent sees the
// project's skills by default. Its `skills` field takes paths whose base is not
// documented, so it is left out and the instructions name the skills.
// The older Gemini CLI uses a different folder and is not targeted.
import { markdownAgent, skillsNote } from './shared.mjs';

export default {
  id: 'gemini',
  label: 'Gemini (Antigravity)',
  skillsAgents: ['antigravity'],
  docs: [
    { url: 'https://antigravity.google/docs/subagents', checked: '2026-11-24' },
    { url: 'https://antigravity.google/docs/skills', checked: '2026-11-24' },
  ],
  use: 'Run `agy --agent <name>`, pick the agent in the app, or let Antigravity delegate to it by its description.',
  render(agent) {
    const frontmatter = { name: agent.name, description: agent.description };
    return [{
      path: `.agents/agents/${agent.name}.md`,
      mode: 'file',
      content: markdownAgent(agent, frontmatter, `${agent.body}${skillsNote(agent)}`),
    }];
  },
};
