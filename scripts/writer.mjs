// Writes an agent's files into a project without clobbering anything that is not ours.
//
// A target adapter returns files of two kinds:
//   { path, content, mode: 'file' }   a file this agent owns outright
//   { path, content, mode: 'block' }  a marked block inside a file the project shares
// Owned files carry a marker line, so a later install can update them and a file
// someone else wrote is left alone unless --force is given.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';

export const MARKER_PREFIX = 'installed from Leotus-Richard/agents:';

// `style` is how the target's file format writes a comment.
export function markerLine(agent, style = 'html') {
  const text = `${MARKER_PREFIX} ${agent.name} ${agent.version}`;
  return style === 'hash' ? `# ${text}` : `<!-- ${text} -->`;
}

export function withMarker(content, agent, style = 'html') {
  return `${content.trimEnd()}\n\n${markerLine(agent, style)}\n`;
}

const blockStart = name => `<!-- agent:${name}:start -->`;
const blockEnd = name => `<!-- agent:${name}:end -->`;

// Insert or replace this agent's block, leaving the rest of the file as it was.
export function mergeBlock(existing, name, content) {
  const block = `${blockStart(name)}\n${content.trim()}\n${blockEnd(name)}`;
  if (existing === null || !existing.trim()) return `${block}\n`;
  const start = existing.indexOf(blockStart(name));
  const end = existing.indexOf(blockEnd(name));
  if (start !== -1 && end > start) {
    return `${existing.slice(0, start)}${block}${existing.slice(end + blockEnd(name).length)}`;
  }
  if (start !== -1 || end !== -1) throw new Error(`The block markers for ${name} are damaged; repair or remove them first`);
  return `${existing.trimEnd()}\n\n${block}\n`;
}

function safeTarget(projectDir, path) {
  if (typeof path !== 'string' || !path || isAbsolute(path) || path.includes('\\')) throw new Error(`Unsafe path: ${path}`);
  const target = resolve(projectDir, path);
  const back = relative(resolve(projectDir), target);
  if (!back || back === '..' || back.startsWith(`..${sep}`) || isAbsolute(back)) throw new Error(`Path escapes the project: ${path}`);
  return target;
}

// Decide what each file needs, without touching the disk.
export function planWrites(projectDir, agent, files, { force = false } = {}) {
  return files.map(file => {
    const target = safeTarget(projectDir, file.path);
    const existing = existsSync(target) ? readFileSync(target, 'utf8') : null;
    if (file.mode === 'block') {
      const content = mergeBlock(existing, agent.name, file.content);
      const action = existing === null ? 'create' : content === existing ? 'unchanged' : 'update';
      return { path: file.path, target, content, action };
    }
    if (file.mode !== 'file') throw new Error(`Unknown file mode for ${file.path}: ${file.mode}`);
    if (existing === null) return { path: file.path, target, content: file.content, action: 'create' };
    if (existing === file.content) return { path: file.path, target, content: file.content, action: 'unchanged' };
    // A file with our marker for this agent is one we installed earlier.
    const ours = existing.includes(`${MARKER_PREFIX} ${agent.name} `);
    return { path: file.path, target, content: file.content, action: ours || force ? 'update' : 'conflict' };
  });
}

export function applyWrites(plan) {
  const conflicts = plan.filter(entry => entry.action === 'conflict');
  if (conflicts.length) {
    throw new Error(`These files exist and were not installed by this tool: ${conflicts.map(entry => entry.path).join(', ')}. Move them, or pass --force to replace them.`);
  }
  for (const entry of plan) {
    if (entry.action === 'unchanged') continue;
    mkdirSync(dirname(entry.target), { recursive: true });
    writeFileSync(entry.target, entry.content);
  }
  return plan;
}

export function describePlan(plan) {
  return plan.map(entry => `  ${entry.action.padEnd(9)} ${entry.path}`);
}

export function joinPath(...parts) {
  return join(...parts).split(sep).join('/');
}
