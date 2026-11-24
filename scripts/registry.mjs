// registry/agents.json: each agent's lifecycle stage, version history with the
// behaviour each version is expected to show, and which tool and model tested it.
import { NAME, SEMVER, STAGES } from './definitions.mjs';

const compare = (a, b) => {
  const [x, y] = [a, b].map(version => version.split('.').map(Number));
  return x[0] - y[0] || x[1] - y[1] || x[2] - y[2];
};

function bumpKind(from, to) {
  const [a, b] = [from, to].map(version => version.split('.').map(Number));
  if (b[0] > a[0]) return 'major';
  if (b[0] === a[0] && b[1] > a[1]) return 'minor';
  if (b[0] === a[0] && b[1] === a[1] && b[2] > a[2]) return 'patch';
  return null;
}

export function findVersionIssues(name, versions, current) {
  if (!Array.isArray(versions) || !versions.length) return [`${name}: needs a versions entry for ${current}`];
  const issues = [];
  versions.forEach((entry, index) => {
    const label = `${name} ${entry?.version ?? `versions[${index}]`}`;
    if (typeof entry?.version !== 'string' || !SEMVER.test(entry.version)) { issues.push(`${label}: version must be MAJOR.MINOR.PATCH`); return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.date ?? '')) issues.push(`${label}: date must be YYYY-MM-DD`);
    const text = entry.expectedBehavior;
    if (typeof text !== 'string' || text.trim().length < 20 || text.length > 600) {
      issues.push(`${label}: expectedBehavior must say in 20 to 600 characters what this version should do`);
    }
    if (index === 0) {
      if (entry.bump !== 'initial') issues.push(`${label}: the first entry's bump must be "initial"`);
      return;
    }
    const previous = versions[index - 1]?.version;
    if (typeof previous !== 'string' || !SEMVER.test(previous)) return;
    const kind = bumpKind(previous, entry.version);
    if (!kind) issues.push(`${label}: versions must be listed oldest first and each must be greater than the one before`);
    else if (entry.bump !== kind) issues.push(`${label}: this is a ${kind} bump, but bump says ${entry.bump}`);
  });
  const last = versions.at(-1)?.version;
  if (last !== current) issues.push(`${name}: AGENT.md is at ${current}; add a versions entry for it (the last entry is ${last})`);
  return issues;
}

// A record says which tool and model tested a version, because the same agent
// behaves differently on each.
export function findEvaluationIssues(name, evaluations, current, targetIds) {
  if (evaluations === undefined) return [];
  if (!Array.isArray(evaluations)) return [`${name}: evaluations must be a list`];
  const issues = [];
  evaluations.forEach((record, index) => {
    const label = `${name} evaluations[${index}]`;
    if (typeof record?.version !== 'string' || !SEMVER.test(record.version)) { issues.push(`${label}: version must be MAJOR.MINOR.PATCH`); return; }
    if (compare(record.version, current) > 0) issues.push(`${label}: version ${record.version} is newer than the agent (${current})`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(record.date ?? '')) issues.push(`${label}: date must be YYYY-MM-DD`);
    if (!targetIds.includes(record.target)) issues.push(`${label}: target must be one of ${targetIds.join(', ')}`);
    if (typeof record.model !== 'string' || !record.model.trim()) issues.push(`${label}: model must name the model that ran the agent`);
    if (typeof record.result !== 'string' || !record.result.trim()) issues.push(`${label}: result must say what was observed`);
    if (record.runUrl !== undefined && !/^https:\/\//.test(record.runUrl)) issues.push(`${label}: runUrl must be an https link`);
  });
  return issues;
}

export function findRegistryIssues(registry, agents, targetIds) {
  if (registry?.schemaVersion !== 1 || !Array.isArray(registry.agents)) return ['registry/agents.json must have schemaVersion 1 and an agents list'];
  const issues = [];
  const entries = new Map();
  for (const entry of registry.agents) {
    if (typeof entry?.name !== 'string' || !NAME.test(entry.name)) { issues.push('registry: an entry has an invalid name'); continue; }
    if (entries.has(entry.name)) issues.push(`registry: ${entry.name} is listed twice`);
    entries.set(entry.name, entry);
    if (!STAGES.includes(entry.stage)) issues.push(`${entry.name}: stage must be one of ${STAGES.join(', ')}`);
    if (typeof entry.license !== 'string' || !entry.license.trim()) issues.push(`${entry.name}: missing license`);
    if ('description' in entry) issues.push(`${entry.name}: the description belongs in AGENT.md, not in the registry`);
  }
  for (const agent of agents) {
    const entry = entries.get(agent.name);
    if (!entry) { issues.push(`${agent.name}: missing registry entry`); continue; }
    issues.push(...findVersionIssues(agent.name, entry.versions, agent.version));
    issues.push(...findEvaluationIssues(agent.name, entry.evaluations, agent.version, targetIds));
  }
  const known = new Set(agents.map(agent => agent.name));
  for (const name of entries.keys()) if (!known.has(name)) issues.push(`${name}: the registry points to an agent that does not exist`);
  return issues;
}
