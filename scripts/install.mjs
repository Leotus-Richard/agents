#!/usr/bin/env node
// Install agents into a project, for the tools you choose.
//
//   npx --yes github:Leotus-Richard/agents#<tag or commit> --agent <name...> --target <tool...>
//   npm run agents:install -- --agent <name...> --target <tool...>     (from a checkout)
//
//   --agent <name...>   agents to install (required)
//   --target <tool...>  tools to install them for (required; nothing is installed for a tool you do not name)
//   --dir <path>        project to install into (default: the current folder)
//   --list              list the agents and targets, and install nothing
//   --print             show what would be written and run, and change nothing
//   --no-skills         write the agent files only; do not install the skills
//   --force             replace files this tool did not write
//
// For each chosen tool this writes the agent in that tool's own format, then installs
// the skills the agent imports, at the AI-SKILLS revision its skills.json pins.
import { spawnSync } from 'node:child_process';
import { existsSync, realpathSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { listAgents, loadAgent, NAME, REF, SOURCE } from './definitions.mjs';
import { applyWrites, describePlan, planWrites } from './writer.mjs';
import { TARGETS } from '../targets/index.mjs';

const root = resolve(import.meta.dirname, '..');
const LISTS = { '--agent': 'agents', '-a': 'agents', '--target': 'targets', '-t': 'targets' };
const FLAGS = { '--list': 'list', '--print': 'print', '--no-skills': 'noSkills', '--force': 'force', '--help': 'help', '-h': 'help' };

export function parseArguments(argv) {
  const options = { agents: [], targets: [], dir: null, list: false, print: false, noSkills: false, force: false, help: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg in LISTS) {
      let taken = 0;
      while (i + 1 < argv.length && !argv[i + 1].startsWith('-')) { options[LISTS[arg]].push(argv[++i]); taken += 1; }
      if (!taken) throw new Error(`${arg} needs at least one name`);
    } else if (arg in FLAGS) options[FLAGS[arg]] = true;
    else if (arg === '--dir') {
      if (i + 1 >= argv.length || argv[i + 1].startsWith('-')) throw new Error('--dir needs a path');
      options.dir = argv[++i];
    } else throw new Error(`Unknown option: ${arg}. Run with --help to see the options.`);
  }
  options.agents = [...new Set(options.agents)];
  options.targets = [...new Set(options.targets)];
  return options;
}

const targetList = () => Object.values(TARGETS).map(target => `${target.id} (${target.label})`).join(', ');

// Everything the install will do, worked out before anything is written.
export function planInstall(options, { packageRoot = root, targets = TARGETS } = {}) {
  if (!options.agents.length) {
    throw new Error(`Choose at least one agent with --agent. Available: ${listAgents(packageRoot).join(', ') || 'none'}.`);
  }
  if (!options.targets.length) {
    throw new Error(`Choose at least one tool with --target; nothing is installed for a tool you do not name. Available: ${targetList()}.`);
  }
  const unknown = options.targets.filter(id => !Object.hasOwn(targets, id));
  if (unknown.length) throw new Error(`Unknown target${unknown.length > 1 ? 's' : ''}: ${unknown.join(', ')}. Available: ${targetList()}.`);
  const chosen = options.targets.map(id => targets[id]);
  return options.agents.map(name => {
    const agent = loadAgent(packageRoot, name);
    const files = chosen.flatMap(target => target.render(agent).map(file => ({ ...file, target: target.id })));
    const skillsAgents = [...new Set(chosen.flatMap(target => target.skillsAgents))];
    return { agent, files, skillsCommand: agent.skills.skills.length ? skillsCommand(agent, skillsAgents) : null };
  });
}

// The AI-SKILLS command installs each skill with the skills it requires, at one revision.
export function skillsCommand(agent, skillsAgents) {
  const { source, ref, skills } = agent.skills;
  if (!SOURCE.test(source) || !REF.test(ref) || skills.some(skill => !NAME.test(skill)) || skillsAgents.some(id => !NAME.test(id))) {
    throw new Error(`agents/${agent.name}/skills.json has a value that is not safe to pass to a command`);
  }
  return ['npx', '--yes', `github:${source}#${ref}`, ...skills.flatMap(skill => ['--skill', skill]), '--agent', ...skillsAgents, '--copy', '--yes'];
}

function projectDirectory(dir) {
  const project = resolve(dir ?? process.cwd());
  if (!existsSync(project) || !statSync(project).isDirectory()) throw new Error(`Not a folder: ${project}`);
  return project;
}

function listEverything() {
  console.log('Agents:');
  for (const name of listAgents(root)) {
    const agent = loadAgent(root, name);
    console.log(`  ${agent.name} ${agent.version}  ${agent.description}`);
  }
  console.log('\nTargets:');
  for (const target of Object.values(TARGETS)) console.log(`  ${target.id.padEnd(9)} ${target.label}`);
}

function usage() {
  console.log([
    'Install agents into a project, for the tools you choose.',
    '',
    '  --agent <name...>   agents to install',
    `  --target <tool...>  tools to install them for: ${Object.keys(TARGETS).join(', ')}`,
    '  --dir <path>        project to install into (default: the current folder)',
    '  --list              list the agents and targets',
    '  --print             show what would happen and change nothing',
    '  --no-skills         write the agent files only',
    '  --force             replace files this tool did not write',
  ].join('\n'));
}

export function main(argv) {
  const options = parseArguments(argv);
  if (options.help) return usage();
  if (options.list) return listEverything();
  const project = projectDirectory(options.dir);
  const installs = planInstall(options);
  // Plan every write first, so a conflict stops the run before anything changes.
  const plans = installs.map(install => ({
    ...install,
    writes: planWrites(project, install.agent, install.files, { force: options.force }),
  }));
  for (const { agent, writes, skillsCommand: command } of plans) {
    console.log(`${agent.name} ${agent.version} for ${options.targets.join(', ')}:`);
    console.log(describePlan(writes).join('\n'));
    if (command && !options.noSkills) console.log(`  skills    ${command.join(' ')}`);
  }
  if (options.print) return;
  for (const { writes } of plans) applyWrites(writes);
  if (options.noSkills) return;
  for (const { agent, skillsCommand: command } of plans) {
    if (!command) continue;
    // npx is a .cmd shim on Windows, which Node only runs through a shell. Every argument was checked above.
    const result = spawnSync(command[0], command.slice(1), { cwd: project, stdio: 'inherit', shell: process.platform === 'win32' });
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error(`Installing the skills for ${agent.name} failed (exit ${result.status}). The agent files were written.`);
  }
}

// npm runs a package command through a link in node_modules/.bin, so compare real paths.
function isMainModule() {
  if (!process.argv[1]) return false;
  try { return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url)); }
  catch { return false; }
}

if (isMainModule()) {
  try { main(process.argv.slice(2)); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
