#!/usr/bin/env node
// Check that every skill an agent imports exists in AI-SKILLS at the revision it pins.
// Needs the network, so it is separate from `npm run validate`.
// Usage: node scripts/check-skills.mjs [--root PATH]
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { listAgents, loadAgent } from './definitions.mjs';

// `fetchRegistry(source, ref)` returns the skill names in that revision's registry.
export async function findMissingSkills(root, fetchRegistry) {
  const issues = [];
  const cache = new Map();
  for (const name of listAgents(root)) {
    const { skills } = loadAgent(root, name);
    if (!skills.skills.length) continue;
    const key = `${skills.source}#${skills.ref}`;
    if (!cache.has(key)) {
      cache.set(key, await fetchRegistry(skills.source, skills.ref).then(
        names => ({ names: new Set(names) }),
        error => ({ error: error.message }),
      ));
    }
    const found = cache.get(key);
    if (found.error) { issues.push(`${name}: cannot read the skill registry at ${key}: ${found.error}`); continue; }
    for (const skill of skills.skills) {
      if (!found.names.has(skill)) issues.push(`${name}: skill "${skill}" does not exist in ${key}`);
    }
  }
  return issues;
}

async function fetchFromGitHub(source, ref) {
  const url = `https://raw.githubusercontent.com/${source}/${ref}/registry/skills.json`;
  const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
  const registry = await response.json();
  return registry.skills.map(skill => skill.name);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const root = args[0] === '--root' && args[1] ? args[1] : resolve(import.meta.dirname, '..');
  const issues = await findMissingSkills(root, fetchFromGitHub);
  if (issues.length) {
    console.error(`Skill check failed:\n${issues.map(issue => `- ${issue}`).join('\n')}`);
    process.exitCode = 1;
  } else console.log('Every imported skill exists at its pinned revision.');
}
