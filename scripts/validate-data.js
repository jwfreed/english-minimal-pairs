const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..', 'app', 'constants', 'minimalPairs');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.ts') && f !== 'english.ts');

console.log('Files found:', files.length);

files.forEach(f => {
  const content = fs.readFileSync(path.join(dir, f), 'utf8');
  const hasExport = content.includes('export default');
  let issues = [];

  // Find all Row arrays: const groupName: Row[] = [ ... ];
  // Each row is: ['word1', 'word2', difficulty, 'ipa1', 'ipa2', 'group', 'position']
  const arrayRegex = /const\s+(\w+):\s*Row\[\]\s*=\s*\[([\s\S]*?)\];/g;
  let m;
  const groupData = {};

  while ((m = arrayRegex.exec(content)) !== null) {
    const varName = m[1];
    const arrayBody = m[2];
    
    // Count rows by counting opening brackets for tuples
    const rows = arrayBody.match(/\['/g) || [];
    const rowCount = rows.length;
    
    // Extract difficulties (3rd element in each tuple)
    const rowRegex = /\[\s*'[^']*'\s*,\s*'[^']*'\s*,\s*(\d+)\s*,/g;
    let rm;
    const diffs = new Set();
    const diffList = [];
    while ((rm = rowRegex.exec(arrayBody)) !== null) {
      const d = Number(rm[1]);
      diffs.add(d);
      diffList.push(d);
    }

    // Extract group names from rows
    const groupNameRegex = /,\s*'(\w+)'\s*,\s*'(initial|medial|final)'\s*\]/g;
    const groupNames = new Set();
    while ((rm = groupNameRegex.exec(arrayBody)) !== null) {
      groupNames.add(rm[1]);
    }

    groupData[varName] = { rowCount, diffs, diffList, groupNames };

    if (rowCount !== 6) issues.push(`${varName}: expected 6 rows, found ${rowCount}`);
    for (let t = 1; t <= 6; t++) {
      if (!diffs.has(t)) issues.push(`${varName}: missing difficulty ${t}`);
    }
    // Check for duplicate diffs
    if (diffList.length !== diffs.size) {
      issues.push(`${varName}: has duplicate difficulties [${diffList.join(',')}]`);
    }
    if (groupNames.size > 1) issues.push(`${varName}: mixed group names ${[...groupNames].join(',')}`);
  }

  const groupCount = Object.keys(groupData).length;
  const totalRows = Object.values(groupData).reduce((s, g) => s + g.rowCount, 0);

  if (groupCount !== 5) issues.push(`Expected 5 groups, found ${groupCount}`);
  if (totalRows !== 30) issues.push(`Expected 30 total rows, found ${totalRows}`);
  if (!hasExport) issues.push('Missing export default');

  // Check for word duplicates within same group
  const wordPairRegex = /\[\s*'([^']*)'\s*,\s*'([^']*)'\s*,/g;
  const seenPairs = {};
  let lastGroup = null;
  // Re-read arrays for word duplicates
  const arrayRegex2 = /const\s+(\w+):\s*Row\[\]\s*=\s*\[([\s\S]*?)\];/g;
  while ((m = arrayRegex2.exec(content)) !== null) {
    const varName = m[1];
    const arrayBody = m[2];
    const wpRegex = /\[\s*'([^']*)'\s*,\s*'([^']*)'\s*,/g;
    let wm;
    while ((wm = wpRegex.exec(arrayBody)) !== null) {
      const key = `${wm[1]}/${wm[2]}`;
      if (seenPairs[key]) {
        issues.push(`DUPLICATE: "${wm[1]}/${wm[2]}" in ${varName} (also in ${seenPairs[key]})`);
      }
      seenPairs[key] = varName;
    }
  }

  const status = issues.length === 0 ? 'OK' : 'ISSUES';
  const groupNames = Object.keys(groupData).join(', ');
  console.log(`\n${f}: ${status} (${groupCount} groups: ${groupNames}, ${totalRows} pairs)`);
  issues.forEach(i => console.log(`  ⚠ ${i}`));
});
