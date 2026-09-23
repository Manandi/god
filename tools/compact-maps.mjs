#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const directory = fileURLToPath(new URL('../public/maps/', import.meta.url));

function encode(values) {
  const pairs = [];
  for (const value of values) {
    const last = pairs[pairs.length - 1];
    if (last && last[0] === value) last[1] += 1;
    else pairs.push([value, 1]);
  }
  return pairs;
}

for (const file of readdirSync(directory).filter(name => name.endsWith('.json'))) {
  const fullPath = path.join(directory, file);
  const map = JSON.parse(readFileSync(fullPath, 'utf8'));
  for (const layer of map.layers ?? []) {
    if (Array.isArray(layer.data)) {
      layer.dataRle = encode(layer.data);
      delete layer.data;
    }
  }
  writeFileSync(fullPath, `${JSON.stringify(map, null, 2)}\n`);
  console.log(`compacted ${file}`);
}
