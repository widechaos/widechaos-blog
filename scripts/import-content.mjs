import { mkdir, readFile, realpath, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildPublicSnapshot, mergeContentBundle, validateContent } from './content-schema.mjs';

const args = process.argv.slice(2);
const value = flag => args[args.indexOf(flag) + 1];
let temporary;
try {
  if (!args.includes('--source') || !value('--source') || value('--source').startsWith('--')) throw new Error('Usage: node scripts/import-content.mjs --source /private/content-bundle.json [--merge] [--output examples/public-content.json] [--dry-run]');
  const sourcePath = resolve(value('--source'));
  const outputPath = resolve(args.includes('--output') ? value('--output') : 'examples/public-content.json');
  if (sourcePath === outputPath) throw new Error('Source and output must be different files; retain draft material outside the public snapshot.');
  const sourceRealPath = await realpath(sourcePath);
  const previewRoot = await realpath(fileURLToPath(new URL('..', import.meta.url)));
  if (sourceRealPath === previewRoot || sourceRealPath.startsWith(previewRoot + sep)) throw new Error('Import sources must be outside the preview code directory, including static/ and symlinks into it.');
  const source = JSON.parse(await readFile(sourcePath, 'utf8'));
  let bundle = source;
  if (args.includes('--merge')) {
    let base;
    try { base = JSON.parse(await readFile(outputPath, 'utf8')); }
    catch (error) {
      if (error.code !== 'ENOENT') throw error;
      base = { articles: [], projects: [], tools: [], collection: [], topics: {}, projectKinds: {} };
    }
    const baseErrors = validateContent(base);
    if (baseErrors.length) throw new Error('Existing public snapshot is invalid:\n' + baseErrors.join('\n'));
    bundle = mergeContentBundle(base, source);
  }
  const snapshot = buildPublicSnapshot(bundle);
  const errors = validateContent(snapshot);
  if (errors.length) throw new Error(errors.join('\n'));
  const excluded = ['articles', 'projects', 'tools', 'collection'].reduce((count, key) => count + (bundle[key]?.length || 0) - snapshot[key].length, 0);
  if (!args.includes('--dry-run')) {
    await mkdir(dirname(outputPath), { recursive: true });
    temporary = `${outputPath}.${process.pid}.tmp`;
    await writeFile(temporary, JSON.stringify(snapshot, null, 2) + '\n', { flag: 'wx' });
    await rename(temporary, outputPath);
  }
  process.stdout.write(`${args.includes('--dry-run') ? 'Validated' : 'Wrote'} ${snapshot.articles.length} article versions and ${snapshot.projects.length} projects; excluded ${excluded} unpublished entries. ${outputPath}\n`);
} catch (error) {
  if (temporary) await rm(temporary, { force: true });
  process.stderr.write(error.message + '\n');
  process.exitCode = 1;
}
