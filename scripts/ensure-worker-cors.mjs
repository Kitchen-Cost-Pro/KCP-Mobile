import { readFile, writeFile } from 'node:fs/promises';

const configPath = process.argv[2];
if (!configPath) throw new Error('A wrangler.toml path is required.');

const source = await readFile(configPath, 'utf8');
const matcher = /^(ALLOWED_ORIGINS\s*=\s*")([^"]*)("\s*)$/m;
const match = source.match(matcher);
if (!match) {
  throw new Error(`Could not find a single-line ALLOWED_ORIGINS value in ${configPath}.`);
}

const required = ['https://localhost', 'capacitor://localhost'];
const origins = match[2].split(',').map((value) => value.trim()).filter(Boolean);
for (const origin of required) {
  if (!origins.includes(origin)) origins.push(origin);
}
const replacement = `${match[1]}${origins.join(',')}${match[3]}`;
if (replacement === match[0]) {
  console.log('    [ok] Capacitor origins are already present');
} else {
  await writeFile(configPath, source.replace(matcher, replacement), 'utf8');
  console.log('    [updated] Added Capacitor origins to ALLOWED_ORIGINS');
}
