import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { validateContent } from './content-schema.mjs';

try {
  const file = resolve(process.argv[2] || 'examples/public-content.json');
  const data = JSON.parse(await readFile(file, 'utf8'));
  const errors = validateContent(data);
  if (errors.length) {
    process.stderr.write(errors.join('\n') + '\n');
    process.exitCode = 1;
  } else {
    process.stdout.write(`Content valid: ${data.articles.length} article versions, ${data.projects.length} projects, ${data.tools.length} standalone tools.\n`);
  }
} catch (error) {
  process.stderr.write(error.message + '\n');
  process.exitCode = 1;
}
