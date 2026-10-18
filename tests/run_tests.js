// ===========================================================================
// Local Wally - Master Test Runner
// ===========================================================================

const { spawnSync } = require('child_process');
const path = require('path');

console.log('Running Local Wally Test Suite...\n');

const testFile = path.join(__dirname, 'test_audit_remediation.js');
const result = spawnSync(process.execPath, [testFile], {
  stdio: 'inherit',
  cwd: path.join(__dirname, '..')
});

if (result.status !== 0) {
  process.exit(result.status || 1);
}

console.log('\nAll tests completed successfully.');
