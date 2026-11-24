#!/usr/bin/env node
// Check every agent definition, its skills manifest and its registry entry.
// Usage: node scripts/validate.mjs [--root PATH]
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findDefinitionIssues, listAgents, loadAgent } from './definitions.mjs';
import { findRegistryIssues } from './registry.mjs';
import { TARGETS } from '../targets/index.mjs';

export function validateRepository(repoRoot) {
  const root = resolve(repoRoot);
  const issues = findDefinitionIssues(root);
  const agents = [];
  for (const name of listAgents(root)) {
    try { agents.push(loadAgent(root, name)); } catch { /* already reported above */ }
  }
  const registryFile = join(root, 'registry', 'agents.json');
  if (!existsSync(registryFile)) issues.push('Missing registry/agents.json');
  else {
    let registry;
    try { registry = JSON.parse(readFileSync(registryFile, 'utf8')); }
    catch (error) { issues.push(`registry/agents.json: invalid JSON: ${error.message}`); }
    if (registry) issues.push(...findRegistryIssues(registry, agents, Object.keys(TARGETS)));
  }
  // Every agent must render for every target, so no tool is left with a broken file.
  for (const agent of agents) {
    for (const target of Object.values(TARGETS)) {
      try {
        const files = target.render(agent);
        if (!Array.isArray(files) || !files.length) issues.push(`${agent.name}: target ${target.id} produced no files`);
      } catch (error) { issues.push(`${agent.name}: target ${target.id} failed: ${error.message}`); }
    }
  }
  if (issues.length) throw new Error(`Validation failed:\n${issues.map(issue => `- ${issue}`).join('\n')}`);
  return { agents };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    if (args.length && (args[0] !== '--root' || args.length !== 2)) throw new Error('Usage: node scripts/validate.mjs [--root PATH]');
    const root = args.length ? args[1] : resolve(import.meta.dirname, '..');
    const result = validateRepository(root);
    console.log(`Validated ${result.agents.length} agent${result.agents.length === 1 ? '' : 's'} for ${Object.keys(TARGETS).length} targets.`);
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
