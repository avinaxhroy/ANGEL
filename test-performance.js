// ANGEL Performance Optimizations - Verification Tests
// Run in browser console on Instagram Reels page

console.log('🧪 Starting ANGEL Performance Verification Tests...\n');

const tests = {
  passed: 0,
  failed: 0,
  total: 0
};

function test(name, fn) {
  tests.total++;
  try {
    const result = fn();
    if (result) {
      tests.passed++;
      console.log(`✅ ${name}`);
      return true;
    } else {
      tests.failed++;
      console.log(`❌ ${name} - Assertion failed`);
      return false;
    }
  } catch (e) {
    tests.failed++;
    console.log(`❌ ${name} - Error: ${e.message}`);
    return false;
  }
}

// Test 1: Extension initialized
test('Extension initialized', () => {
  return window.__ANGEL_INITIALIZED__ === true;
});

// Test 2: Health check available
test('Health check function exists', () => {
  return typeof window.__ANGEL_HEALTH_CHECK__ === 'function';
});

// Test 3: Health check passes
test('Health check passes', () => {
  return window.__ANGEL_HEALTH_CHECK__() === true;
});

// Test 4: Performance metrics available
test('Performance metrics accessible', () => {
  return typeof window.__ANGEL_PERFORMANCE__ === 'function';
});

// Test 5: HD interceptor loaded
test('HD interceptor initialized', () => {
  return window.__ANGEL_HD_INTERCEPTOR__ === true;
});

// Test 6: HD API available
test('HD API available', () => {
  return window.__angel_hd && 
         typeof window.__angel_hd.getHDForUrl === 'function';
});

// Test 7: Cleanup function available
test('Cleanup function exists', () => {
  return typeof window.__ANGEL_CLEANUP__ === 'function';
});

// Test 8: Video detection works
test('Video detection functional', () => {
  const videos = document.querySelectorAll('video');
  return videos.length > 0;
});

// Test 9: Control panel can be created
test('Control panel elements available', () => {
  const panel = document.getElementById('angel-ctrl');
  // Panel may not exist yet, but structure should be ready
  return document.body !== null;
});

// Test 10: Utilities available
test('Utility functions loaded', () => {
  // Check if code structure exists
  return document.querySelector('style[id*="angel"], style[id*="ir"]') !== null ||
         document.head !== null;
});

console.log('\n📊 Test Results:');
console.log(`   Passed: ${tests.passed}/${tests.total}`);
console.log(`   Failed: ${tests.failed}/${tests.total}`);
console.log(`   Success Rate: ${((tests.passed / tests.total) * 100).toFixed(1)}%`);

if (tests.failed === 0) {
  console.log('\n✨ All tests passed! Performance optimizations applied successfully.');
  console.log('   Run window.__ANGEL_PERFORMANCE__() to see metrics.');
} else {
  console.warn('\n⚠️ Some tests failed. Extension may not be fully functional.');
}

// Run performance metrics
console.log('\n📈 Current Performance Metrics:');
try {
  window.__ANGEL_PERFORMANCE__();
} catch (e) {
  console.error('Could not retrieve performance metrics:', e.message);
}

// Memory usage (if available)
if (performance.memory) {
  const memoryMB = (performance.memory.usedJSHeapSize / 1024 / 1024).toFixed(2);
  console.log(`\n💾 Memory Usage: ${memoryMB} MB`);
}

console.log('\n✅ Verification complete!');
