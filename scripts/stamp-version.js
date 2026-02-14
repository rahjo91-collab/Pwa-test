#!/usr/bin/env node
// Generates version.json from git metadata.
// Run with: npm run version:stamp

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function git(cmd) {
  return execSync(`git ${cmd}`, { encoding: 'utf-8' }).trim();
}

const height = git('rev-list --count HEAD');
const hash = git('rev-parse --short HEAD');
const commitDate = git('log -1 --format=%cI');

const version = {
  build: parseInt(height, 10),
  hash,
  date: commitDate,
  label: `build ${height} (${hash})`
};

const outPath = path.join(__dirname, '..', 'version.json');
fs.writeFileSync(outPath, JSON.stringify(version, null, 2) + '\n');

console.log(`Stamped ${version.label} → version.json`);
