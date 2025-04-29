// scripts/check-audio.js
const fs = require('fs');
const path = require('path');

// 1️⃣  grab file list on disk
const AUDIO_DIR = path.join(__dirname, '../assets/audio');
const diskFiles = new Set(
  fs.readdirSync(AUDIO_DIR).filter((f) => /\.(mp3|wav|m4a)$/i.test(f))
);

// 2️⃣  expected list from japanese.ts
const expected = [
  'rake',
  'lake',
  'rate',
  'late',
  'rag',
  'lag',
  'pray',
  'play',
  'road',
  'load',
  'fry',
  'fly',
  'ban',
  'van',
  'berry',
  'very',
  'bow',
  'vow',
  'ball',
  'wall',
  'sink',
  'think',
  'sip',
  'thick',
  'mass',
  'math',
  'seal',
  'theel',
  'cat',
  'cut',
  'batter',
  'butter',
  'ran',
  'run',
  'cash',
  'cush',
  'sheep',
  'ship',
  'leave',
  'live',
  'beat',
  'bit',
  'feet',
  'fit',
];

const missing = expected.filter((word) => !diskFiles.has(`${word}.mp3`));
const extra = [...diskFiles].filter(
  (f) => !expected.includes(f.replace(/\.mp3$/, ''))
);

console.log('— Existing files —');
diskFiles.forEach((f) => console.log('  ✓', f));

console.log('\n— Missing files —');
missing.forEach((w) => console.log('  ✗', `${w}.mp3`));

console.log('\n— Unreferenced files —');
extra.forEach((f) => console.log('  ?', f));
