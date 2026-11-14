import { mkdirSync, writeFileSync } from 'node:fs';
import { ESLint } from 'eslint';
import { projectModules, projectPath } from './source-analysis.mjs';

// Review thresholds, not claims that existing debt is acceptable. See docs/engineering-standard.md.
const reviewRules = {
  'max-lines': ['warn', { max: 400, skipBlankLines: true, skipComments: true }],
  'max-lines-per-function': ['warn', { max: 100, skipBlankLines: true, skipComments: true }],
  complexity: ['warn', 15],
  'max-depth': ['warn', 3],
  'max-params': ['warn', 5],
};
const eslint = new ESLint({
  overrideConfig: {
    files: ['src/**/*.{js,ts}', 'server/**/*.ts', 'api/**/*.ts'],
    rules: reviewRules,
  },
});
const results = await eslint.lintFiles(['src', 'server', 'api']);
const modules = projectModules();
const rows = modules.map((module) => ({
  file: projectPath(module.file),
  physicalLines: module.physicalLines,
  imports: module.dependencies.map((file) => projectPath(file)),
  incoming: modules.filter((other) => other.dependencies.includes(module.file)).length,
  findings: results
    .find((result) => result.filePath === module.file)
    .messages.map(({ ruleId, line, message, severity }) => ({ ruleId, line, message, severity })),
}));
rows.sort((a, b) => b.physicalLines - a.physicalLines || a.file.localeCompare(b.file));
const summary = {};
for (const row of rows)
  for (const finding of row.findings) summary[finding.ruleId] = (summary[finding.ruleId] ?? 0) + 1;
const markdown = [
  '# Structural review report',
  '',
  'Advisory findings. Counts do not prove cohesion or cover runtime callback/state coupling.',
  'Physical lines include comments and blank lines. ESLint size limits exclude them.',
  'Imports include local type imports, literal dynamic imports and re-exports; incoming counts are unique importing modules.',
  '',
  '| Module | Physical lines | Local imports | Incoming | Findings |',
  '| --- | ---: | ---: | ---: | ---: |',
  ...rows.map(
    (row) =>
      `| ${row.file} | ${row.physicalLines} | ${row.imports.length} | ${row.incoming} | ${row.findings.length} |`,
  ),
  '',
  '## Findings',
  '',
  ...rows.flatMap((row) =>
    row.findings.map(
      (finding) => `- ${row.file}:${finding.line} [${finding.ruleId}] ${finding.message}`,
    ),
  ),
  '',
];
mkdirSync('reports', { recursive: true });
writeFileSync('reports/structure.json', JSON.stringify({ summary, modules: rows }, null, 2) + '\n');
writeFileSync('reports/structure.md', markdown.join('\n'));
console.log(
  `${rows.length} product modules; ${rows.filter((row) => row.physicalLines > 400).length} exceed 400 physical lines.`,
);
console.log(JSON.stringify(summary));
console.log(
  'Review reports: reports/structure.md and reports/structure.json. Structural warnings require human review.',
);
if (results.some((result) => result.errorCount > 0)) process.exitCode = 1;
