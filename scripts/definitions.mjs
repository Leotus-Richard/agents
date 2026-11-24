// Agent definitions: agents/<name>/AGENT.md (the agent) and agents/<name>/skills.json
// (the skills it imports and the AI-SKILLS revision they are pinned to).
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { parseDocument } from 'yaml';

export const NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
// A tag, branch or commit. Kept to characters that are safe on a command line.
export const REF = /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/;
export const SOURCE = /^[A-Za-z0-9][A-Za-z0-9-]*\/[A-Za-z0-9._-]+$/;
export const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
export const SKILLS_SOURCE = 'Leotus-Richard/AI-SKILLS';
// Where an agent sits in the software development lifecycle.
export const STAGES = ['plan', 'design', 'build', 'review', 'test', 'release', 'operate'];

export function parseAgent(text, where = 'AGENT.md') {
  const match = /^(?:﻿)?---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)([\s\S]*)$/u.exec(text);
  if (!match) throw new Error(`${where}: missing YAML frontmatter`);
  const document = parseDocument(match[1], { uniqueKeys: true });
  if (document.errors.length) throw new Error(`${where}: invalid YAML: ${document.errors[0].message}`);
  const data = document.toJS();
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error(`${where}: frontmatter must be a mapping`);
  if (typeof data.name !== 'string' || !NAME.test(data.name) || data.name.length > 64) {
    throw new Error(`${where}: name must be lowercase letters, digits and single hyphens, at most 64 characters`);
  }
  if (typeof data.description !== 'string' || !data.description.trim() || data.description.length > 1024 || /[\r\n]/.test(data.description)) {
    throw new Error(`${where}: description must be one line of 1 to 1024 characters`);
  }
  const version = data.metadata?.version;
  if (typeof version !== 'string' || !SEMVER.test(version)) {
    throw new Error(`${where}: metadata.version must be a quoted "MAJOR.MINOR.PATCH" string`);
  }
  const body = match[2].replace(/\r\n/g, '\n').trim();
  if (!body) throw new Error(`${where}: the agent has no instructions`);
  return { name: data.name, description: data.description.trim(), version, body };
}

export function parseSkillsManifest(text, where = 'skills.json') {
  let data;
  try { data = JSON.parse(text); } catch (error) { throw new Error(`${where}: invalid JSON: ${error.message}`); }
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error(`${where}: must be an object`);
  if (data.source !== SKILLS_SOURCE) throw new Error(`${where}: source must be "${SKILLS_SOURCE}"`);
  if (typeof data.ref !== 'string' || !REF.test(data.ref)) throw new Error(`${where}: ref must be a tag, branch or commit`);
  if (!Array.isArray(data.skills) || data.skills.some(skill => typeof skill !== 'string' || !NAME.test(skill))) {
    throw new Error(`${where}: skills must be a list of skill names`);
  }
  if (new Set(data.skills).size !== data.skills.length) throw new Error(`${where}: a skill is listed twice`);
  return { source: data.source, ref: data.ref, skills: [...data.skills] };
}

export function listAgents(root) {
  const directory = join(root, 'agents');
  if (!existsSync(directory)) return [];
  return readdirSync(directory).filter(name => statSync(join(directory, name)).isDirectory()).sort();
}

export function loadAgent(root, name) {
  if (!NAME.test(name)) throw new Error(`Invalid agent name: ${name}`);
  const directory = join(root, 'agents', name);
  const file = join(directory, 'AGENT.md');
  if (!existsSync(file)) {
    const known = listAgents(root);
    throw new Error(`Unknown agent: ${name}. Available: ${known.join(', ') || 'none'}.`);
  }
  const agent = parseAgent(readFileSync(file, 'utf8'), `agents/${name}/AGENT.md`);
  if (agent.name !== name) throw new Error(`agents/${name}/AGENT.md: name must match the folder`);
  const manifest = join(directory, 'skills.json');
  const skills = existsSync(manifest)
    ? parseSkillsManifest(readFileSync(manifest, 'utf8'), `agents/${name}/skills.json`)
    : { source: SKILLS_SOURCE, ref: null, skills: [] };
  return { ...agent, skills };
}

// Skill names the agent's instructions mention in code formatting.
export function namedInBody(body, names) {
  return names.filter(name => body.includes(`\`${name}\``));
}

export function findDefinitionIssues(root) {
  const issues = [];
  const names = listAgents(root);
  if (!names.length) issues.push('The repository contains no agents');
  for (const name of names) {
    if (!NAME.test(name)) { issues.push(`agents/${name}: folder name is not a valid agent name`); continue; }
    let agent;
    try { agent = loadAgent(root, name); } catch (error) { issues.push(error.message); continue; }
    // An imported skill that the instructions never mention would be installed and never used.
    for (const skill of agent.skills.skills) {
      if (!agent.body.includes(`\`${skill}\``)) {
        issues.push(`agents/${name}: skills.json imports "${skill}" but AGENT.md never names it; say where the agent should use it, or remove it`);
      }
    }
    if (agent.skills.skills.length && !agent.skills.ref) issues.push(`agents/${name}: skills.json needs a ref`);
  }
  return issues;
}
