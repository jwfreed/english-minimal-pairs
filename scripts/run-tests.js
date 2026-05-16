const fs = require('fs');
const path = require('path');

const testFiles = fs
  .readdirSync(__dirname)
  .filter((file) => file.endsWith('.test.js'))
  .sort((a, b) => a.localeCompare(b));

for (const testFile of testFiles) {
  console.log(`\n${testFile}`);
  require(path.join(__dirname, testFile));
}
