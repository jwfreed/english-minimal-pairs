const path = require('path');

const testFiles = [
  'validate-data.test.js',
  'practiceSession.test.js',
];

for (const testFile of testFiles) {
  console.log(`\n${testFile}`);
  require(path.join(__dirname, testFile));
}
