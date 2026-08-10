import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const manifestPath = path.resolve('public/build/manifest.json');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const normalized = {};

const normalizeResourcePath = (value) =>
    typeof value === 'string'
        ? value.replace(/^(?:\.\.\/)+(?=resources\/)/, '')
        : value;

for (const [key, value] of Object.entries(manifest)) {
    const normalizedKey = normalizeResourcePath(key);
    const normalizedValue = {
        ...value,
        src: normalizeResourcePath(value.src),
        imports: value.imports?.map(normalizeResourcePath),
        dynamicImports: value.dynamicImports?.map(normalizeResourcePath),
    };

    normalized[normalizedKey] = normalizedValue;
}

await writeFile(manifestPath, `${JSON.stringify(normalized, null, 2)}\n`);
