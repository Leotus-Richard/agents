import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findDefinitionIssues, loadAgent, parseAgent, parseSkillsManifest } from '../scripts/definitions.mjs';
import { findEvaluationIssues, findRegistryIssues, findVersionIssues } from '../scripts/registry.mjs';
import { findMissingSkills } from '../scripts/check-skills.mjs';
import { renderCatalog } from '../scripts/catalog.mjs';
import { validateRepository } from '../scripts/validate.mjs';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const agentText = (overrides = '') => `---\nname: demo\ndescription: "Does a demo. Use when testing."\nmetadata:\n  version: "1.0.0"\n${overrides}---\n\n# Demo\n\nUse the \`alpha-skill\` skill.\n`;
const entry = (version, bump, expectedBehavior = 'Behaves as described for this version.') => ({ version, date: '2026-11-24', bump, expectedBehavior });

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'agents-definitions-'));
  t.after(() => {
    assert.equal(dirname(resolve(root)), resolve(tmpdir()));
    rmSync(root, { recursive: true, force: true });
  });
  mkdirSync(join(root, 'agents', 'demo'), { recursive: true });
  mkdirSync(join(root, 'registry'));
  writeFileSync(join(root, 'agents', 'demo', 'AGENT.md'), agentText());
  writeFileSync(join(root, 'agents', 'demo', 'skills.json'), JSON.stringify({ source: 'Leotus-Richard/AI-SKILLS', ref: 'v0.1.0', skills: ['alpha-skill'] }));
  const registry = { schemaVersion: 1, agents: [{ name: 'demo', stage: 'build', license: 'Apache-2.0', versions: [entry('1.0.0', 'initial')], evaluations: [] }] };
  const save = () => writeFileSync(join(root, 'registry', 'agents.json'), JSON.stringify(registry));
  save();
  return { root, registry, save };
}

test('an agent definition needs a name, a one-line description, a version and instructions', () => {
  assert.deepEqual(parseAgent(agentText()), {
    name: 'demo', description: 'Does a demo. Use when testing.', version: '1.0.0', body: '# Demo\n\nUse the `alpha-skill` skill.',
  });
  assert.throws(() => parseAgent('# No frontmatter\n'), /missing YAML frontmatter/);
  assert.throws(() => parseAgent(agentText().replace('name: demo', 'name: Demo Agent')), /name must be lowercase/);
  assert.throws(() => parseAgent(agentText().replace('"Does a demo. Use when testing."', '""')), /description must be one line/);
  assert.throws(() => parseAgent(agentText().replace('"1.0.0"', '"1.0"')), /metadata\.version must be/);
  assert.throws(() => parseAgent('---\nname: demo\ndescription: x\nmetadata:\n  version: "1.0.0"\n---\n\n'), /has no instructions/);
  assert.throws(() => parseAgent(agentText().replace('name: demo\n', 'name: demo\nname: other\n')), /invalid YAML/);
});

test('a skills manifest pins AI-SKILLS at a revision that is safe on a command line', () => {
  const good = { source: 'Leotus-Richard/AI-SKILLS', ref: 'v0.1.0', skills: ['alpha-skill', 'beta'] };
  assert.deepEqual(parseSkillsManifest(JSON.stringify(good)), good);
  assert.throws(() => parseSkillsManifest(JSON.stringify({ ...good, source: 'someone/else' })), /source must be "Leotus-Richard\/AI-SKILLS"/);
  assert.throws(() => parseSkillsManifest(JSON.stringify({ ...good, ref: 'v1 && echo' })), /ref must be a tag, branch or commit/);
  assert.throws(() => parseSkillsManifest(JSON.stringify({ ...good, skills: ['Alpha Skill'] })), /skills must be a list of skill names/);
  assert.throws(() => parseSkillsManifest(JSON.stringify({ ...good, skills: ['beta', 'beta'] })), /listed twice/);
  assert.throws(() => parseSkillsManifest('{'), /invalid JSON/);
});

test('an imported skill must be named where the agent should use it', t => {
  const { root } = fixture(t);
  assert.deepEqual(findDefinitionIssues(root), []);
  writeFileSync(join(root, 'agents', 'demo', 'skills.json'), JSON.stringify({ source: 'Leotus-Richard/AI-SKILLS', ref: 'v0.1.0', skills: ['alpha-skill', 'unused-skill'] }));
  assert.match(findDefinitionIssues(root).join('\n'), /imports "unused-skill" but AGENT\.md never names it/);
  writeFileSync(join(root, 'agents', 'demo', 'AGENT.md'), agentText().replace('name: demo', 'name: other'));
  assert.match(findDefinitionIssues(root).join('\n'), /name must match the folder/);
});

test('the registry tracks each version, its expected behaviour, and what tested it', t => {
  const { root, registry, save } = fixture(t);
  assert.equal(validateRepository(root).agents.length, 1);

  assert.deepEqual(findVersionIssues('demo', [entry('1.0.0', 'initial'), entry('1.1.0', 'minor'), entry('2.0.0', 'major')], '2.0.0'), []);
  assert.match(findVersionIssues('demo', [entry('1.0.0', 'initial')], '1.1.0').join('\n'), /AGENT\.md is at 1\.1\.0; add a versions entry/);
  assert.match(findVersionIssues('demo', [entry('1.0.0', 'initial'), entry('1.0.1', 'minor')], '1.0.1').join('\n'), /patch bump, but bump says minor/);
  assert.match(findVersionIssues('demo', [entry('1.0.0', 'initial', 'short')], '1.0.0').join('\n'), /expectedBehavior must say/);
  assert.match(findVersionIssues('demo', [entry('1.1.0', 'initial'), entry('1.0.0', 'patch')], '1.0.0').join('\n'), /oldest first/);

  const record = { version: '1.0.0', date: '2026-11-24', target: 'opencode', model: 'qwen/qwen3.6-35b-a3b', result: 'Found the root cause in 3 of 4 cases.' };
  assert.deepEqual(findEvaluationIssues('demo', [record], '1.0.0', ['claude', 'opencode']), []);
  const bad = findEvaluationIssues('demo', [{ ...record, target: 'vim', model: '', version: '2.0.0', runUrl: 'http://x' }], '1.0.0', ['claude', 'opencode']).join('\n');
  assert.match(bad, /newer than the agent/);
  assert.match(bad, /target must be one of claude, opencode/);
  assert.match(bad, /model must name the model/);
  assert.match(bad, /runUrl must be an https link/);

  registry.agents[0].stage = 'party';
  registry.agents.push({ name: 'ghost', stage: 'build', license: 'Apache-2.0', versions: [entry('1.0.0', 'initial')] });
  save();
  assert.throws(() => validateRepository(root), /stage must be one of plan, design, build, review, test, release, operate[\s\S]*ghost: the registry points to an agent that does not exist/);
  assert.match(findRegistryIssues({ schemaVersion: 1, agents: [] }, [loadAgent(root, 'demo')], ['claude']).join('\n'), /demo: missing registry entry/);
});

test('every imported skill must exist at the pinned revision', async t => {
  const { root } = fixture(t);
  assert.deepEqual(await findMissingSkills(root, async () => ['alpha-skill', 'other']), []);
  assert.deepEqual(await findMissingSkills(root, async () => ['other']), ['demo: skill "alpha-skill" does not exist in Leotus-Richard/AI-SKILLS#v0.1.0']);
  assert.match((await findMissingSkills(root, async () => { throw new Error('HTTP 404'); }))[0], /cannot read the skill registry at Leotus-Richard\/AI-SKILLS#v0\.1\.0: HTTP 404/);
});

test('the catalog lists agents by stage with what tested them', t => {
  const { root, registry, save } = fixture(t);
  let catalog = renderCatalog(root);
  assert.match(catalog, /## build \(1\)\n\n\| Agent \| Version \| Skills it imports \| Description \|\n\| --- \| --- \| --- \| --- \|\n\| \[demo\]\(\.\.\/agents\/demo\/AGENT\.md\) \| 1\.0\.0 \| `alpha-skill` at `v0\.1\.0` \|/);
  assert.match(catalog, /- \*\*demo\*\* 1\.0\.0: not yet tested/);
  registry.agents[0].evaluations = [{ version: '1.0.0', date: '2026-11-24', target: 'opencode', model: 'qwen/qwen3.6-35b-a3b', result: 'Fixed 3 of 4 seeded bugs.' }];
  save();
  catalog = renderCatalog(root);
  assert.match(catalog, /- \*\*demo\*\* 1\.0\.0:\n  - `opencode` with `qwen\/qwen3\.6-35b-a3b` \(2026-11-24\): Fixed 3 of 4 seeded bugs\./);
});

test('this repository validates and its catalog is current', () => {
  assert.ok(validateRepository(repoRoot).agents.length >= 1);
  assert.equal(readFileSync(join(repoRoot, 'docs', 'CATALOG.md'), 'utf8'), renderCatalog(repoRoot));
});
