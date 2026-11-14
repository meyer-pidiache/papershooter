import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import ts from 'typescript';

const root = resolve('src');
const allowed = {
  shared: ['shared'],
  domain: ['domain', 'shared'],
  engine: ['engine', 'domain', 'shared'],
  presentation: ['presentation', 'engine', 'domain', 'shared'],
  platform: ['platform', 'engine', 'domain', 'shared'],
  maps: ['maps', 'presentation', 'engine', 'domain', 'shared'],
  gameplay: ['gameplay', 'presentation', 'platform', 'engine', 'domain', 'shared'],
  network: ['network', 'domain', 'shared'],
  application: [
    'application',
    'gameplay',
    'maps',
    'network',
    'platform',
    'presentation',
    'engine',
    'domain',
    'shared',
  ],
};

function files(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    return entry.isDirectory() ? files(path) : /\.(js|ts)$/.test(path) ? [path] : [];
  });
}

const graph = new Map();
const errors = [];
for (const file of files(root)) {
  const source = ts.createSourceFile(
    file,
    readFileSync(file, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
  );
  const layer = relative(root, file).split('/')[0];
  const dependencies = [];
  for (const node of source.statements) {
    if (!ts.isImportDeclaration(node) && !ts.isExportDeclaration(node)) continue;
    if (!node.moduleSpecifier || !ts.isStringLiteral(node.moduleSpecifier)) continue;
    const specifier = node.moduleSpecifier.text;
    if (!specifier.startsWith('.')) continue;
    const base = resolve(dirname(file), specifier);
    const dependency = [base, base.replace(/\.js$/, '.ts'), `${base}.ts`, `${base}.js`].find(
      (candidate) => existsSync(candidate),
    );
    if (!dependency) {
      errors.push(`Missing module: ${relative(root, file)} -> ${specifier}`);
      continue;
    }
    dependencies.push(dependency);
    const target = relative(root, dependency).split('/')[0];
    if (allowed[layer] && !allowed[layer].includes(target))
      errors.push(`Forbidden dependency: ${relative(root, file)} -> ${relative(root, dependency)}`);
  }
  graph.set(file, dependencies);
}

const visiting = new Set();
const visited = new Set();
function visit(file, stack = []) {
  if (visiting.has(file)) {
    errors.push(
      `Import cycle: ${[...stack, file].map((item) => relative(root, item)).join(' -> ')}`,
    );
    return;
  }
  if (visited.has(file)) return;
  visiting.add(file);
  for (const dependency of graph.get(file) || []) visit(dependency, [...stack, file]);
  visiting.delete(file);
  visited.add(file);
}
for (const file of graph.keys()) visit(file);
if (errors.length) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
} else
  console.log(`Architecture: ${graph.size} modules, allowed dependencies and no import cycles.`);
