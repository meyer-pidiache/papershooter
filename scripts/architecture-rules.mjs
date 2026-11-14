import { projectPath } from './source-analysis.mjs';
const allowed = {
  'main.ts': ['application'],
  server: ['server', 'shared', 'domain'],
  api: ['api', 'server', 'shared'],
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

export function checkArchitecture(modules, root = process.cwd()) {
  function layer(file) {
    const parts = projectPath(file, root).split('/');
    return parts[0] === 'src' ? parts[1] : parts[0];
  }

  const graph = new Map();
  const errors = [];
  for (const module of modules) {
    const file = projectPath(module.file, root);
    for (const specifier of module.missing) errors.push(`Missing module: ${file} -> ${specifier}`);
    for (const dependency of module.dependencies)
      if (!allowed[layer(module.file)]?.includes(layer(dependency)))
        errors.push(`Forbidden dependency: ${file} -> ${projectPath(dependency, root)}`);
    graph.set(module.file, module.dependencies);
  }

  const visiting = new Set();
  const visited = new Set();
  function visit(file, stack = []) {
    if (visiting.has(file)) {
      errors.push(
        `Import cycle: ${[...stack, file].map((item) => projectPath(item, root)).join(' -> ')}`,
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
  return errors;
}
