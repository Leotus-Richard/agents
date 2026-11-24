// OpenAI Codex: a project agent at .codex/agents/<name>.toml.
// `name`, `description` and `developer_instructions` are required. Identity comes
// from `name`, not the filename. An agent inherits its parent's skills and has no
// field to attach or preload particular ones, so the instructions name them.
// Codex starts a custom agent when the prompt names it; there is no CLI flag.
import { markerLine } from '../scripts/writer.mjs';
import { skillsNote } from './shared.mjs';

// A TOML multi-line basic string. JSON escapes are valid TOML escapes; newlines and
// tabs stay literal so the instructions remain readable in the file.
function multiline(text) {
  const escaped = [...text].map(character => {
    if (character === '\n' || character === '\t') return character;
    if (character === '\\') return '\\\\';
    const code = character.codePointAt(0);
    return code < 0x20 || code === 0x7f ? `\\u${code.toString(16).padStart(4, '0')}` : character;
  }).join('').replaceAll('"""', '""\\"');
  return `"""\n${escaped}\n"""`;
}

export default {
  id: 'openai',
  label: 'OpenAI Codex',
  skillsAgents: ['codex'],
  docs: [
    { url: 'https://learn.chatgpt.com/docs/agent-configuration/subagents', checked: '2026-11-24' },
    { url: 'https://learn.chatgpt.com/docs/build-skills', checked: '2026-11-24' },
  ],
  use: 'Name the agent in your prompt, for example "have <name> look at this". Codex has no flag that selects an agent.',
  render(agent) {
    const content = [
      `name = ${JSON.stringify(agent.name)}`,
      `description = ${JSON.stringify(agent.description)}`,
      `developer_instructions = ${multiline(`${agent.body}${skillsNote(agent)}`)}`,
      '',
      markerLine(agent, 'hash'),
      '',
    ].join('\n');
    return [{ path: `.codex/agents/${agent.name}.toml`, mode: 'file', content }];
  },
};
