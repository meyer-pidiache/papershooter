import { existsSync, readFileSync, readdirSync, realpathSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';

const seen = new Map();
const cached = JSON.parse(readFileSync('third_party/licenses/sources.json', 'utf8'));
function visit(name, from) {
  const require = createRequire(from);
  const manifest = (require.resolve.paths(name) || [])
    .map((path) => join(path, name, 'package.json'))
    .find(existsSync);
  if (!manifest) throw new Error(`Cannot resolve license for ${name}`);
  const path = realpathSync(manifest);
  const info = JSON.parse(readFileSync(path, 'utf8'));
  const key = `${info.name}@${info.version}`;
  if (seen.has(key)) return;
  const directory = dirname(path);
  const license = readdirSync(directory).find((file) =>
    /^(licen[sc]e|copying)(\.(md|txt))?$/i.test(file),
  );
  const cachedEntry = cached[key];
  if (!license && !cachedEntry) throw new Error(`Missing license text for ${key}`);
  const licensePath = license
    ? join(directory, license)
    : join('third_party/licenses', cachedEntry.file);
  const source = license ? '' : `Source: ${cachedEntry.source}\n\n`;
  seen.set(key, source + readFileSync(licensePath, 'utf8').replace(/\r\n/g, '\n').trim());
  for (const dependency of Object.keys(info.dependencies || {})) visit(dependency, path);
}

const root = resolve('package.json');
for (const name of Object.keys(JSON.parse(readFileSync(root, 'utf8')).dependencies))
  visit(name, root);
const output =
  'Paper Shooter — third-party runtime dependency notices\n\n' +
  [...seen]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, license]) => `${key}\n${'='.repeat(key.length)}\n${license}\n`)
    .join('\n');
const target = 'public/THIRD_PARTY_NOTICES.txt';
if (process.argv.includes('--check')) {
  if (!existsSync(target) || readFileSync(target, 'utf8') !== output) {
    console.error('Dependency notices changed. Run pnpm licenses:generate and review the result.');
    process.exitCode = 1;
  }
} else {
  writeFileSync(target, output);
}
