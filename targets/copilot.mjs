// GitHub Copilot: a custom agent at .github/agents/<name>.agent.md, read by the
// Copilot CLI, VS Code and the cloud agent on github.com (there, only once the file
// is on the default branch). `description` is required. `skills` loads the named
// skills into the agent's context; it is documented for VS Code and the CLI, not for
// the cloud agent, so the instructions name the skills as well.
import { markdownAgent, skillsNote } from './shared.mjs';

export default {
  id: 'copilot',
  label: 'GitHub Copilot',
  skillsAgents: ['github-copilot'],
  docs: [
    { url: 'https://docs.github.com/en/copilot/reference/custom-agents-configuration', checked: '2026-11-24' },
    { url: 'https://code.visualstudio.com/docs/agents/reference/custom-agent-file-reference', checked: '2026-11-24' },
    { url: 'https://docs.github.com/en/copilot/concepts/agents/about-agent-skills', checked: '2026-11-24' },
  ],
  use: 'Pick the agent in the agent menu, or run `copilot --agent <name> --prompt "..."` in the CLI.',
  render(agent) {
    const frontmatter = { name: agent.name, description: agent.description };
    if (agent.skills.skills.length) frontmatter.skills = agent.skills.skills;
    return [{
      path: `.github/agents/${agent.name}.agent.md`,
      mode: 'file',
      content: markdownAgent(agent, frontmatter, `${agent.body}${skillsNote(agent)}`),
    }];
  },
};
