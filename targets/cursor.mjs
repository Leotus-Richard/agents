// Cursor: a project subagent at .cursor/agents/<name>.md, read by the editor, the
// CLI and cloud agents. The documented frontmatter fields are name, description,
// model, readonly and is_background; there is no field for tools or skills, so the
// instructions name the skills. Subagents inherit the parent's tools.
import { markdownAgent, skillsNote } from './shared.mjs';

export default {
  id: 'cursor',
  label: 'Cursor',
  skillsAgents: ['cursor'],
  docs: [
    { url: 'https://cursor.com/docs/subagents', checked: '2026-11-24' },
    { url: 'https://cursor.com/docs/skills', checked: '2026-11-24' },
  ],
  use: 'Type `/<name>` in the prompt, ask for the agent by name, or let Cursor delegate to it by its description.',
  render(agent) {
    const frontmatter = { name: agent.name, description: agent.description };
    return [{
      path: `.cursor/agents/${agent.name}.md`,
      mode: 'file',
      content: markdownAgent(agent, frontmatter, `${agent.body}${skillsNote(agent)}`),
    }];
  },
};
