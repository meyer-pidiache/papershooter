import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { checkArchitecture } from '../../scripts/architecture-rules.mjs';
import { projectModules } from '../../scripts/source-analysis.mjs';

const directories: string[] = [];
function project(files: Record<string, string>) {
  const cwd = mkdtempSync(join(tmpdir(), 'papershooter-architecture-'));
  directories.push(cwd);
  for (const dir of ['src', 'server', 'api']) mkdirSync(join(cwd, dir));
  for (const [file, source] of Object.entries(files)) {
    mkdirSync(dirname(join(cwd, file)), { recursive: true });
    writeFileSync(join(cwd, file), source);
  }
  return cwd;
}
afterEach(() => {
  for (const directory of directories) rmSync(directory, { recursive: true, force: true });
  directories.length = 0;
});

describe('architecture boundaries', () => {
  it('checks API and server dependencies as well as browser layers', () => {
    const cwd = project({
      'src/domain/rules.ts': 'export const limit = 10;',
      'server/app.ts': "export { limit } from '../src/domain/rules.js';",
      'api/handler.ts': "import '../server/app.js';",
    });
    const modules = projectModules(cwd);
    expect(modules).toHaveLength(3);
    expect(checkArchitecture(modules, cwd)).toEqual([]);
  });

  it('rejects a forbidden dependency hidden in a literal dynamic import', () => {
    const cwd = project({
      'src/domain/rules.ts': "export const load = () => import('../application/session.js');",
      'src/application/session.js': 'export const state = {};',
    });
    expect(checkArchitecture(projectModules(cwd), cwd).join('\n')).toContain(
      'Forbidden dependency: src/domain/rules.ts',
    );
  });

  it('detects cycles and missing relative imports', () => {
    const cwd = project({
      'src/domain/a.ts': "import './b.js'; import './missing.js';",
      'src/domain/b.ts': "export { value } from './a.js';",
    });
    const errors = checkArchitecture(projectModules(cwd), cwd).join('\n');
    expect(errors).toContain('Import cycle:');
    expect(errors).toContain('Missing module: src/domain/a.ts -> ./missing.js');
  });
});
