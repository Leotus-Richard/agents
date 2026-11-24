// The tools an agent can be installed for. Each adapter is the only place that
// knows its tool's file format; adding a tool means adding one file here.
import claude from './claude.mjs';
import openai from './openai.mjs';
import copilot from './copilot.mjs';
import gemini from './gemini.mjs';
import opencode from './opencode.mjs';
import cursor from './cursor.mjs';

export const TARGETS = Object.fromEntries([claude, openai, copilot, gemini, opencode, cursor].map(target => [target.id, target]));
