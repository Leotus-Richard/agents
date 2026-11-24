// Helpers shared by the target adapters.
import { stringify } from 'yaml';
import { withMarker } from '../scripts/writer.mjs';

// A Markdown file with YAML frontmatter, ending in the marker that lets a later
// install recognise the file as one it wrote.
export function markdownAgent(agent, frontmatter, body = agent.body) {
  const yaml = stringify(frontmatter, { lineWidth: 0 }).trimEnd();
  return withMarker(`---\n${yaml}\n---\n\n${body}`, agent);
}

// For a tool with no way to attach skills to an agent: say which skills the
// instructions rely on, so the agent loads them by name.
export function skillsNote(agent) {
  if (!agent.skills.skills.length) return '';
  const names = agent.skills.skills.map(name => `\`${name}\``).join(', ');
  return `\n\n## Skills\n\nThis agent uses these installed skills: ${names}. Load each one when a step above names it.`;
}
