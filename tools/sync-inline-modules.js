#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const indexPath = path.join(root, 'index.html');
const modules = [
  'js/data/supabase-repository.js',
  'js/data/data-mappers.js',
  'js/domain/stock-calculator.js',
  'js/core/performance-monitor.js',
  'js/integrations/external-repository.js',
];

let html = fs.readFileSync(indexPath, 'utf8');

for (const relativePath of modules) {
  const marker = `<!-- Inline module: ${relativePath} -->`;
  const markerStart = html.indexOf(marker);
  if (markerStart === -1) {
    throw new Error(`Marker tidak ditemukan: ${marker}`);
  }

  const scriptStart = html.indexOf('<script>', markerStart + marker.length);
  const scriptEnd = html.indexOf('</script>', scriptStart);
  if (scriptStart === -1 || scriptEnd === -1) {
    throw new Error(`Blok inline tidak valid: ${relativePath}`);
  }

  const sourcePath = path.join(root, relativePath);
  const source = fs.readFileSync(sourcePath, 'utf8')
    .replace(/\s+$/, '')
    .split('\n')
    .map((line) => line ? `        ${line}` : '')
    .join('\n');

  html = `${html.slice(0, scriptStart + '<script>'.length)}\n${source}\n    ${html.slice(scriptEnd)}`;
}

fs.writeFileSync(indexPath, html);
console.log(`Inline modules synchronized: ${modules.length}`);
