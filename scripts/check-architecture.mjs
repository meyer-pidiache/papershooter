import { projectModules } from './source-analysis.mjs';
import { checkArchitecture } from './architecture-rules.mjs';

const modules = projectModules();
const errors = checkArchitecture(modules);
if (errors.length) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
} else {
  console.log(
    `Architecture: ${modules.length} modules, allowed dependencies and no import cycles.`,
  );
}
