const http = require('http');

// Comprehensive Asset Update System Test Suite

const BASE_URL = 'localhost';
const PORT = 3000;

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function makeRequest(path, method = 'GET', data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: BASE_URL,
      port: PORT,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    if (data && method !== 'GET') {
      const jsonData = JSON.stringify(data);
      options.headers['Content-Length'] = Buffer.byteLength(jsonData);
    }

    const req = http.request(options, (res) => {
      let responseData = '';

      res.on('data', (chunk) => {
        responseData += chunk;
      });

      res.on('end', () => {
        try {
          const parsed = JSON.parse(responseData);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, data: responseData });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (data && method !== 'GET') {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

async function runTests() {
  log('\n==============================================', 'cyan');
  log('    ASSET UPDATE SYSTEM - TEST SUITE', 'cyan');
  log('==============================================\n', 'cyan');

  let passedTests = 0;
  let failedTests = 0;

  // Test 1: Check Asset Version
  log('Test 1: Check Asset Version (Client v0)', 'blue');
  try {
    const response = await makeRequest('/api/assets/version?version=0&platform=android');
    if (response.status === 200 && response.data.needsUpdate === true) {
      log('✓ PASSED: Version check works correctly', 'green');
      log(`  Server Version: ${response.data.currentVersion}`, 'yellow');
      log(`  Download Size: ${response.data.downloadSizeText}`, 'yellow');
      log(`  Force Update: ${response.data.forceUpdate}`, 'yellow');
      passedTests++;
    } else {
      log('✗ FAILED: Unexpected response', 'red');
      failedTests++;
    }
  } catch (error) {
    log(`✗ FAILED: ${error.message}`, 'red');
    failedTests++;
  }

  // Test 2: Check Asset Version (Up to date)
  log('\nTest 2: Check Asset Version (Client v15)', 'blue');
  try {
    const response = await makeRequest('/api/assets/version?version=15&platform=android');
    if (response.status === 200 && response.data.needsUpdate === false) {
      log('✓ PASSED: Up-to-date check works correctly', 'green');
      log(`  Client is up to date`, 'yellow');
      passedTests++;
    } else {
      log('✗ FAILED: Unexpected response', 'red');
      failedTests++;
    }
  } catch (error) {
    log(`✗ FAILED: ${error.message}`, 'red');
    failedTests++;
  }

  // Test 3: Get Asset Manifest
  log('\nTest 3: Get Asset Manifest', 'blue');
  try {
    const response = await makeRequest('/api/assets/manifest?version=0&platform=android');
    if (response.status === 200 && response.data.assets && response.data.assets.length > 0) {
      log('✓ PASSED: Manifest retrieved successfully', 'green');
      log(`  Total Assets: ${response.data.totalAssets}`, 'yellow');
      log(`  Required Assets: ${response.data.requiredAssets}`, 'yellow');
      log(`  Total Size: ${(response.data.totalSize / 1024 / 1024).toFixed(2)} MB`, 'yellow');
      log(`  Assets:`, 'yellow');
      response.data.assets.forEach(asset => {
        log(`    - ${asset.name} (${asset.sizeText}) ${asset.required ? '[REQUIRED]' : '[OPTIONAL]'}`, 'yellow');
      });
      passedTests++;
    } else {
      log('✗ FAILED: Manifest not retrieved correctly', 'red');
      failedTests++;
    }
  } catch (error) {
    log(`✗ FAILED: ${error.message}`, 'red');
    failedTests++;
  }

  // Test 4: Verify Asset
  log('\nTest 4: Verify Asset', 'blue');
  try {
    const response = await makeRequest('/api/assets/verify', 'POST', {
      assetId: 'unity-main-bundle',
      hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      crc: 'A1B2C3D4'
    });
    if (response.status === 200 && response.data.valid === true) {
      log('✓ PASSED: Asset verification works', 'green');
      log(`  Hash Valid: ${response.data.hashValid}`, 'yellow');
      log(`  CRC Valid: ${response.data.crcValid}`, 'yellow');
      passedTests++;
    } else {
      log('✗ FAILED: Verification failed', 'red');
      failedTests++;
    }
  } catch (error) {
    log(`✗ FAILED: ${error.message}`, 'red');
    failedTests++;
  }

  // Test 5: Complete Download
  log('\nTest 5: Complete Download', 'blue');
  try {
    const response = await makeRequest('/api/assets/complete', 'POST', {
      version: 15,
      platform: 'android',
      assets: ['unity-main-bundle', 'unity-shared-assets', 'level-data']
    });
    if (response.status === 200 && response.data.success === true) {
      log('✓ PASSED: Download completion recorded', 'green');
      passedTests++;
    } else {
      log('✗ FAILED: Completion not recorded', 'red');
      failedTests++;
    }
  } catch (error) {
    log(`✗ FAILED: ${error.message}`, 'red');
    failedTests++;
  }

  // Test 6: Get Admin Config
  log('\nTest 6: Get Admin Config', 'blue');
  try {
    const response = await makeRequest('/api/assets/admin/config');
    if (response.status === 200 && response.data.currentVersion) {
      log('✓ PASSED: Admin config retrieved', 'green');
      log(`  Current Version: ${response.data.currentVersion}`, 'yellow');
      log(`  Force Update: ${response.data.forceUpdate}`, 'yellow');
      log(`  Assets Count: ${response.data.assets.length}`, 'yellow');
      passedTests++;
    } else {
      log('✗ FAILED: Config not retrieved', 'red');
      failedTests++;
    }
  } catch (error) {
    log(`✗ FAILED: ${error.message}`, 'red');
    failedTests++;
  }

  // Test 7: Update Version (Admin)
  log('\nTest 7: Update Asset Version (Admin)', 'blue');
  try {
    const response = await makeRequest('/api/assets/admin/update-version', 'POST', {
      version: 16,
      forceUpdate: true,
      message: 'Critical update - please download new assets',
      title: 'Update Required'
    });
    if (response.status === 200 && response.data.success === true) {
      log('✓ PASSED: Version updated successfully', 'green');
      log(`  New Version: ${response.data.currentVersion}`, 'yellow');
      passedTests++;
    } else {
      log('✗ FAILED: Version not updated', 'red');
      failedTests++;
    }
  } catch (error) {
    log(`✗ FAILED: ${error.message}`, 'red');
    failedTests++;
  }

  // Test 8: Verify Version Update
  log('\nTest 8: Verify Version Update', 'blue');
  try {
    const response = await makeRequest('/api/assets/version?version=15&platform=android');
    if (response.status === 200 && response.data.currentVersion === 16 && response.data.needsUpdate === true) {
      log('✓ PASSED: Version update verified', 'green');
      log(`  Old Client Version: 15`, 'yellow');
      log(`  New Server Version: ${response.data.currentVersion}`, 'yellow');
      log(`  Update Required: ${response.data.needsUpdate}`, 'yellow');
      passedTests++;
    } else {
      log('✗ FAILED: Version update not reflected', 'red');
      failedTests++;
    }
  } catch (error) {
    log(`✗ FAILED: ${error.message}`, 'red');
    failedTests++;
  }

  // Test 9: Get Download Logs
  log('\nTest 9: Get Download Logs', 'blue');
  try {
    const response = await makeRequest('/api/assets/admin/logs?limit=10');
    if (response.status === 200 && response.data.logs) {
      log('✓ PASSED: Logs retrieved successfully', 'green');
      log(`  Total Logs: ${response.data.total}`, 'yellow');
      if (response.data.logs.length > 0) {
        log(`  Last log type: ${response.data.logs[response.data.logs.length - 1].type}`, 'yellow');
      }
      passedTests++;
    } else {
      log('✗ FAILED: Logs not retrieved', 'red');
      failedTests++;
    }
  } catch (error) {
    log(`✗ FAILED: ${error.message}`, 'red');
    failedTests++;
  }

  // Test 10: Reset Version for future tests
  log('\nTest 10: Reset Version to 15', 'blue');
  try {
    const response = await makeRequest('/api/assets/admin/update-version', 'POST', {
      version: 15,
      forceUpdate: true
    });
    if (response.status === 200 && response.data.success === true) {
      log('✓ PASSED: Version reset successfully', 'green');
      passedTests++;
    } else {
      log('✗ FAILED: Version not reset', 'red');
      failedTests++;
    }
  } catch (error) {
    log(`✗ FAILED: ${error.message}`, 'red');
    failedTests++;
  }

  // Test Summary
  log('\n==============================================', 'cyan');
  log('              TEST SUMMARY', 'cyan');
  log('==============================================', 'cyan');
  log(`Total Tests: ${passedTests + failedTests}`, 'yellow');
  log(`Passed: ${passedTests}`, 'green');
  log(`Failed: ${failedTests}`, 'red');
  log(`Success Rate: ${((passedTests / (passedTests + failedTests)) * 100).toFixed(2)}%`, 'yellow');
  log('==============================================\n', 'cyan');

  if (failedTests === 0) {
    log('✓ ALL TESTS PASSED! 🎉', 'green');
  } else {
    log('✗ SOME TESTS FAILED', 'red');
  }
}

// Run tests
log('Starting Asset Update System tests...', 'cyan');
log('Make sure the backend server is running on http://localhost:3000\n', 'yellow');

setTimeout(() => {
  runTests().catch(error => {
    log(`\n✗ Test suite failed: ${error.message}`, 'red');
    process.exit(1);
  });
}, 1000);

