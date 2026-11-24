import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';
import { parseArguments, planInstall, skillsCommand } from '../scripts/install.mjs';
import { applyWrites, mergeBlock, planWrites } from '../scripts/writer.mjs';
import { TARGETS } from '../targets/index.mjs';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const command = join(repoRoot, 'scripts', 'install.mjs');

function project(t) {
  const directory = mkdtempSync(join(tmpdir(), 'agents-install-'));
  t.after(() => {
    assert.equal(dirname(resolve(directory)), resolve(tmpdir()));
    rmSync(directory, { recursive: true, force: true });
  });
  return directory;
}

const agent = {
  name: 'sample-agent',
  description: 'Reviews a change: use "carefully" when asked.',
  version: '1.2.0',
  body: '# Sample\n\nUse the `alpha-skill` skill, then report.\nA path like C:\\temp and """quotes""" must survive.',
  skills: { source: 'Leotus-Richard/AI-SKILLS', ref: 'v0.1.0', skills: ['alpha-skill'] },
};
const frontmatter = content => parseYaml(/^---\n([\s\S]*?)\n---\n/.exec(content)[1]);

test('only the tools you name are installed for, and none is a default', () => {
  const options = parseArguments(['--agent', 'bug-fixer', '--target', 'claude', 'opencode', '--print']);
  assert.deepEqual(options.targets, ['claude', 'opencode']);
  const [install] = planInstall(options);
  assert.deepEqual(install.files.map(file => file.path), ['.claude/agents/bug-fixer.md', '.opencode/agents/bug-fixer.md']);
  assert.deepEqual(install.skillsCommand.slice(-5), ['--agent', 'claude-code', 'opencode', '--copy', '--yes']);

  assert.throws(() => planInstall(parseArguments(['--agent', 'bug-fixer'])), /Choose at least one tool with --target; nothing is installed for a tool you do not name/);
  assert.throws(() => planInstall(parseArguments(['--target', 'claude'])), /Choose at least one agent with --agent\. Available: .*bug-fixer/);
  assert.throws(() => planInstall(parseArguments(['--agent', 'bug-fixer', '--target', 'claude', 'vim'])), /Unknown target: vim\. Available: claude/);
  assert.throws(() => planInstall(parseArguments(['--agent', 'nope', '--target', 'claude'])), /Unknown agent: nope\. Available: .*bug-fixer/);
  assert.throws(() => parseArguments(['--target', '--print']), /--target needs at least one name/);
  assert.throws(() => parseArguments(['--everything']), /Unknown option: --everything/);
});

test('each tool gets the agent in its own format and location', () => {
  const rendered = Object.fromEntries(Object.values(TARGETS).map(target => [target.id, target.render(agent)]));
  assert.deepEqual(Object.fromEntries(Object.entries(rendered).map(([id, out]) => [id, out.map(file => file.path)])), {
    claude: ['.claude/agents/sample-agent.md'],
    openai: ['.codex/agents/sample-agent.toml'],
    copilot: ['.github/agents/sample-agent.agent.md'],
    gemini: ['.agents/agents/sample-agent.md'],
    opencode: ['.opencode/agents/sample-agent.md'],
    cursor: ['.cursor/agents/sample-agent.md'],
  });
  for (const [id, out] of Object.entries(rendered)) {
    const { content } = out[0];
    assert.ok(content.includes('installed from Leotus-Richard/agents: sample-agent 1.2.0'), `${id} carries the marker`);
    assert.ok(content.includes('alpha-skill'), `${id} tells the agent which skill it uses`);
    assert.ok(content.includes('then report.'), `${id} carries the instructions`);
  }
  // Claude and Copilot can load skills by name; the others have no such field.
  assert.deepEqual(frontmatter(rendered.claude[0].content), { name: 'sample-agent', description: agent.description, skills: ['alpha-skill'] });
  assert.deepEqual(frontmatter(rendered.copilot[0].content).skills, ['alpha-skill']);
  assert.deepEqual(frontmatter(rendered.cursor[0].content), { name: 'sample-agent', description: agent.description });
  assert.deepEqual(frontmatter(rendered.gemini[0].content), { name: 'sample-agent', description: agent.description });
  // OpenCode names the agent by its file and needs an explicit mode.
  assert.deepEqual(frontmatter(rendered.opencode[0].content), { description: agent.description, mode: 'all' });
});

test('the Codex file is valid TOML that keeps the instructions exactly', () => {
  const { content } = TARGETS.openai.render(agent)[0];
  assert.match(content, /^name = "sample-agent"\ndescription = "Reviews a change: use \\"carefully\\" when asked\."\ndeveloper_instructions = """\n/);
  // Undo the two escapes the writer applies and compare with the source text.
  const body = /developer_instructions = """\n([\s\S]*?)\n"""\n/.exec(content)[1].replaceAll('""\\"', '"""').replaceAll('\\\\', '\\');
  assert.ok(body.startsWith(agent.body));
  assert.ok(content.trimEnd().endsWith('# installed from Leotus-Richard/agents: sample-agent 1.2.0'));
});

test('an install never replaces a file it did not write, and updates its own', t => {
  const directory = project(t);
  const rendered = TARGETS.claude.render(agent);
  assert.deepEqual(applyWrites(planWrites(directory, agent, rendered)).map(entry => entry.action), ['create']);
  assert.deepEqual(planWrites(directory, agent, rendered).map(entry => entry.action), ['unchanged']);
  const newer = { ...agent, version: '1.3.0', body: `${agent.body}\n\nNew step.` };
  assert.deepEqual(planWrites(directory, newer, TARGETS.claude.render(newer)).map(entry => entry.action), ['update'], 'our own file may be updated');

  const target = join(directory, '.claude', 'agents', 'sample-agent.md');
  writeFileSync(target, '---\nname: sample-agent\ndescription: Written by hand.\n---\n\nMine.\n');
  const plan = planWrites(directory, agent, rendered);
  assert.deepEqual(plan.map(entry => entry.action), ['conflict']);
  assert.throws(() => applyWrites(plan), /were not installed by this tool: \.claude\/agents\/sample-agent\.md.*--force/);
  assert.match(readFileSync(target, 'utf8'), /Mine\./, 'the hand-written file is untouched');
  assert.deepEqual(planWrites(directory, agent, rendered, { force: true }).map(entry => entry.action), ['update']);

  assert.throws(() => planWrites(directory, agent, [{ path: '../outside.md', mode: 'file', content: 'x' }]), /escapes the project/);
  assert.throws(() => planWrites(directory, agent, [{ path: '/etc/outside.md', mode: 'file', content: 'x' }]), /Unsafe path/);
});

test('a shared file gets one marked block per agent, replaced in place', () => {
  const first = mergeBlock('# Project notes\n\nKeep me.\n', 'sample-agent', 'Version one.');
  assert.match(first, /^# Project notes\n\nKeep me\.\n\n<!-- agent:sample-agent:start -->\nVersion one\.\n<!-- agent:sample-agent:end -->\n$/);
  const second = mergeBlock(first, 'sample-agent', 'Version two.');
  assert.ok(second.includes('Keep me.') && second.includes('Version two.') && !second.includes('Version one.'));
  assert.equal(mergeBlock(second, 'sample-agent', 'Version two.'), second, 'installing twice changes nothing');
  assert.equal(mergeBlock(null, 'sample-agent', 'Only.'), '<!-- agent:sample-agent:start -->\nOnly.\n<!-- agent:sample-agent:end -->\n');
  assert.throws(() => mergeBlock('<!-- agent:sample-agent:start -->\nhalf', 'sample-agent', 'x'), /markers for sample-agent are damaged/);
});

test('the skills command pins one AI-SKILLS revision and refuses unsafe values', () => {
  assert.deepEqual(skillsCommand(agent, ['claude-code', 'cursor']), [
    'npx', '--yes', 'github:Leotus-Richard/AI-SKILLS#v0.1.0', '--skill', 'alpha-skill', '--agent', 'claude-code', 'cursor', '--copy', '--yes',
  ]);
  for (const skills of [{ ...agent.skills, ref: 'v1; rm -rf x' }, { ...agent.skills, skills: ['a b'] }, { ...agent.skills, source: 'x/y && z' }]) {
    assert.throws(() => skillsCommand({ ...agent, skills }, ['claude-code']), /not safe to pass to a command/);
  }
});

test('the command installs the example agent for two tools and nothing for the others', t => {
  const directory = project(t);
  const run = args => spawnSync(process.execPath, [command, ...args], { encoding: 'utf8' });
  const preview = run(['--agent', 'bug-fixer', '--target', 'claude', 'openai', '--dir', directory, '--print']);
  assert.equal(preview.status, 0, preview.stderr);
  assert.match(preview.stdout, /create    \.claude\/agents\/bug-fixer\.md\n  create    \.codex\/agents\/bug-fixer\.toml\n  skills    npx --yes github:Leotus-Richard\/AI-SKILLS#/);
  assert.deepEqual(readdirSync(directory), [], '--print changes nothing');

  const installed = run(['--agent', 'bug-fixer', '--target', 'claude', 'openai', '--dir', directory, '--no-skills']);
  assert.equal(installed.status, 0, installed.stderr);
  assert.deepEqual(readdirSync(directory).sort(), ['.claude', '.codex'], 'no file for a tool that was not named');
  assert.match(readFileSync(join(directory, '.claude', 'agents', 'bug-fixer.md'), 'utf8'), /^---\nname: bug-fixer\n/);
  assert.equal(run(['--agent', 'bug-fixer', '--dir', directory]).status, 1, 'no target is an error, not "all"');
  assert.equal(existsSync(join(directory, '.cursor')), false);
});

test('the command runs when npm starts it through its link', t => {
  const directory = project(t);
  const link = join(directory, 'node_modules', '.bin', 'agents');
  mkdirSync(dirname(link), { recursive: true });
  try { symlinkSync(command, link); }
  catch (error) { if (error.code !== 'EPERM') throw error; t.skip('no symlink privilege on this Windows runner'); return; }
  const result = spawnSync(process.execPath, [link, '--list'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Agents:\n  bug-fixer [\s\S]*Targets:\n  claude/);
});

test('the package npx fetches lists every file its command imports', () => {
  const manifest = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8'));
  const entry = manifest.bin.agents;
  assert.ok(readFileSync(join(repoRoot, entry), 'utf8').startsWith('#!/usr/bin/env node\n'));
  const covered = file => manifest.files.some(item => item === file || (item.endsWith('/') && file.startsWith(item)));
  const pending = [entry];
  for (const file of pending) {
    assert.ok(covered(file), `"files" leaves out ${file}`);
    for (const [, specifier] of readFileSync(join(repoRoot, file), 'utf8').matchAll(/from '(\.[^']+)'/g)) {
      const imported = join(dirname(file), specifier).replaceAll('\\', '/');
      if (!pending.includes(imported)) pending.push(imported);
    }
  }
  assert.ok(covered('agents/bug-fixer/AGENT.md') && covered('registry/agents.json'));
  // yaml is needed at run time, so it must be a dependency: npx does not install devDependencies.
  assert.ok(manifest.dependencies.yaml);
});
