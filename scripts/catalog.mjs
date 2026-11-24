#!/usr/bin/env node
// Generate docs/CATALOG.md from the agent definitions and registry/agents.json.
// Usage: node scripts/catalog.mjs [--check]
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { listAgents, loadAgent, STAGES } from './definitions.mjs';
import { TARGETS } from '../targets/index.mjs';

const cell = value => String(value).replaceAll('|', '\\|').replace(/[\r\n]+/g, ' ');

export function renderCatalog(root) {
  const registry = JSON.parse(readFileSync(join(root, 'registry', 'agents.json'), 'utf8'));
  const agents = listAgents(root).map(name => ({ ...loadAgent(root, name), entry: registry.agents.find(entry => entry.name === name) ?? {} }));
  const lines = [
    '# Agent catalog',
    '',
    'Generated from `agents/<name>/` and `registry/agents.json`. Run `npm run catalog` after a change.',
    '',
    `This repository contains **${agents.length} agent${agents.length === 1 ? '' : 's'}**, installable for ${Object.keys(TARGETS).length} tools: ${Object.values(TARGETS).map(target => `\`${target.id}\``).join(', ')}.`,
    '',
  ];
  for (const stage of STAGES) {
    const members = agents.filter(agent => agent.entry.stage === stage);
    if (!members.length) continue;
    lines.push(`## ${stage} (${members.length})`, '', '| Agent | Version | Skills it imports | Description |', '| --- | --- | --- | --- |');
    for (const agent of members) {
      const skills = agent.skills.skills.length
        ? `${agent.skills.skills.map(skill => `\`${skill}\``).join(', ')} at \`${agent.skills.ref}\``
        : 'none';
      lines.push(`| [${agent.name}](../agents/${agent.name}/AGENT.md) | ${cell(agent.version)} | ${cell(skills)} | ${cell(agent.description)} |`);
    }
    lines.push('');
  }
  lines.push('## Tested with', '', 'The tool and model that ran each agent\'s current version. The same agent behaves differently on each, so a result only speaks for the pair it names.', '');
  for (const agent of agents) {
    const records = (agent.entry.evaluations ?? []).filter(record => record.version === agent.version);
    if (!records.length) { lines.push(`- **${agent.name}** ${agent.version}: not yet tested`); continue; }
    lines.push(`- **${agent.name}** ${agent.version}:`);
    for (const record of records) lines.push(`  - \`${cell(record.target)}\` with \`${cell(record.model)}\` (${cell(record.date)}): ${cell(record.result)}`);
  }
  lines.push('', '## Version history', '', 'Newest first. Each entry says what that version is expected to do.', '');
  for (const agent of agents) {
    lines.push(`### ${agent.name}`, '');
    for (const entry of [...(agent.entry.versions ?? [])].reverse()) {
      lines.push(`- **${cell(entry.version)}** (${cell(entry.date)}, ${cell(entry.bump)}): ${cell(entry.expectedBehavior)}`);
    }
    lines.push('');
  }
  return `${lines.join('\n').trimEnd()}\n`;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const root = resolve(import.meta.dirname, '..');
    const check = process.argv.includes('--check');
    const target = join(root, 'docs', 'CATALOG.md');
    const content = renderCatalog(root);
    const current = existsSync(target) ? readFileSync(target, 'utf8') : null;
    if (check && current !== content) throw new Error('Catalog drift: docs/CATALOG.md. Run npm run catalog.');
    if (!check && current !== content) writeFileSync(target, content);
    console.log(`Catalog ${check ? 'verified' : 'generated'}.`);
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
