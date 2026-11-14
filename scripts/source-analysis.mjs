import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import ts from 'typescript';

const comparePaths = (left, right) => left.localeCompare(right);

export function sourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) return sourceFiles(path);
      return /\.(js|ts)$/.test(path) && !path.endsWith('.d.ts') ? [path] : [];
    })
    .sort(comparePaths);
}

function resolveImport(file, specifier) {
  const base = resolve(dirname(file), specifier);
  return [
    base,
    base.replace(/\.js$/, '.ts'),
    `${base}.ts`,
    `${base}.js`,
    `${base}/index.ts`,
    `${base}/index.js`,
  ].find((candidate) => existsSync(candidate) && statSync(candidate).isFile());
}

/** Literal imports/re-exports, including dynamic imports. Runtime callbacks are outside this graph. */
export function analyzeModule(file) {
  const text = readFileSync(file, 'utf8');
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  const specifiers = new Set();
  function visit(node) {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    )
      specifiers.add(node.moduleSpecifier.text);
    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments.length === 1 &&
      ts.isStringLiteral(node.arguments[0])
    )
      specifiers.add(node.arguments[0].text);
    if (
      ts.isImportTypeNode(node) &&
      ts.isLiteralTypeNode(node.argument) &&
      ts.isStringLiteral(node.argument.literal)
    )
      specifiers.add(node.argument.literal.text);
    ts.forEachChild(node, visit);
  }
  visit(source);
  const dependencies = new Set();
  const missing = [];
  for (const specifier of specifiers) {
    if (!specifier.startsWith('.')) continue;
    const dependency = resolveImport(file, specifier);
    if (dependency) dependencies.add(dependency);
    else missing.push(specifier);
  }
  return {
    file,
    physicalLines: text.split(/\r?\n/).length - Number(text.endsWith('\n')),
    dependencies: [...dependencies].sort(comparePaths),
    missing,
  };
}

export const projectModules = (root = process.cwd()) =>
  ['src', 'server', 'api']
    .flatMap((directory) => sourceFiles(resolve(root, directory)))
    .map(analyzeModule);
export const projectPath = (file, root = process.cwd()) =>
  relative(root, file).replaceAll('\\', '/');
