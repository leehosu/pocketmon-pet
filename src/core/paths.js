import { homedir } from 'node:os';
import { join } from 'node:path';

export const SAVE_FILE = 'save.json';
export const EVENTS_FILE = 'events.jsonl';
export function dataDir() { return join(homedir(), '.pocketmon'); }
