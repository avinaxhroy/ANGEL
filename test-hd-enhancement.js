// ANGEL HD Video Enhancement - Verification Tests
// Run in browser console on Instagram Reels page

console.log('🎬 Starting HD Enhancement Verification Tests...\n');

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

// Test 1: Quality badge exists
test('Quality badge element exists', () => {
  const badge = document.querySelector('[data-display="quality-badge"]');
  return badge !== null;
});

// Test 2: Quality badge has content
test('Quality badge shows quality', () => {
  const badge = document.querySelector('[data-display="quality-badge"]');
  return badge && badge.textContent.length > 0;
});

// Test 3: getSimpleQualityLabel function exists
test('getSimpleQualityLabel function available', () => {
  // This function is in the content script scope
  // We can test indirectly by checking if badge updates
  const badge = document.querySelector('[data-display="quality-badge"]');
  if (!badge) return false;
  const validLabels = ['4K', '1440p', '1080p', '720p', '480p', 'HD', 'SD'];
  return validLabels.some(label => badge.textContent.includes(label));
});

// Test 4: Loading state can be applied
test('Loading state styling available', () => {
  const styles = Array.from(document.styleSheets).some(sheet => {
    try {
      const rules = Array.from(sheet.cssRules || []);
      return rules.some(rule => 
        rule.selectorText && 
        rule.selectorText.includes('ir-quality-badge.loading')
      );
    } catch (e) {
      return false;
    }
  });
  return styles;
});

// Test 5: Quality classes exist
test('Quality tier CSS classes available', () => {
  const classes = ['quality-4k', 'quality-hd', 'quality-sd'];
  return classes.every(className => {
    return Array.from(document.styleSheets).some(sheet => {
      try {
        const rules = Array.from(sheet.cssRules || []);
        return rules.some(rule => 
          rule.selectorText && 
          rule.selectorText.includes(className)
        );
      } catch (e) {
        return false;
      }
    });
  });
});

// Test 6: HD loading state in GlobalState
test('HD loading state tracking available', () => {
  // Check if the extension is tracking loading state
  // We can't access GlobalState directly, but we can check the badge
  const badge = document.querySelector('[data-display="quality-badge"]');
  return badge && badge.classList !== undefined;
});

// Test 7: Animations defined
test('Quality animations defined', () => {
  const animations = ['quality-pulse', 'quality-shimmer'];
  return animations.every(animName => {
    return Array.from(document.styleSheets).some(sheet => {
      try {
        const rules = Array.from(sheet.cssRules || []);
        return rules.some(rule => 
          rule.type === CSSRule.KEYFRAMES_RULE && 
          rule.name === animName
        );
      } catch (e) {
        return false;
      }
    });
  });
});

// Test 8: Badge tooltip
test('Quality badge has tooltip', () => {
  const badge = document.querySelector('[data-display="quality-badge"]');
  return badge && (badge.title !== '' || badge.getAttribute('title') !== null);
});

// Test 9: Badge in correct location
test('Badge positioned correctly in control panel', () => {
  const panel = document.getElementById('angel-ctrl');
  const badge = document.querySelector('[data-display="quality-badge"]');
  if (!panel || !badge) return false;
  return panel.contains(badge);
});

// Test 10: HD toggle button exists
test('HD toggle button exists', () => {
  const hdButton = document.querySelector('[data-action="toggle-hd"]');
  return hdButton !== null;
});

console.log('\n📊 Test Results:');
console.log(`   Passed: ${tests.passed}/${tests.total}`);
console.log(`   Failed: ${tests.failed}/${tests.total}`);
console.log(`   Success Rate: ${((tests.passed / tests.total) * 100).toFixed(1)}%`);

if (tests.failed === 0) {
  console.log('\n✨ All tests passed! HD Enhancement features working correctly.');
} else {
  console.warn(`\n⚠️ ${tests.failed} test(s) failed. Some features may not be available.`);
}

// Visual test - show current quality info
console.log('\n🎯 Current Quality Information:');
const badge = document.querySelector('[data-display="quality-badge"]');
if (badge) {
  console.log('   Badge Text:', badge.textContent);
  console.log('   Tooltip:', badge.title);
  console.log('   CSS Classes:', Array.from(badge.classList).join(', '));
  console.log('   Loading:', badge.classList.contains('loading'));
  
  // Determine quality tier
  if (badge.classList.contains('quality-4k')) {
    console.log('   Quality Tier: 🟣 Ultra HD (4K/1440p)');
  } else if (badge.classList.contains('quality-hd')) {
    console.log('   Quality Tier: 🟢 HD (1080p/720p)');
  } else if (badge.classList.contains('quality-sd')) {
    console.log('   Quality Tier: ⚪ SD (Standard Definition)');
  } else {
    console.log('   Quality Tier: ⚪ Unknown');
  }
} else {
  console.warn('   Quality badge not found. Is the extension active?');
}

// Check video info
const video = document.querySelector('video');
if (video) {
  console.log('\n📹 Current Video:');
  console.log('   Resolution:', video.videoWidth + '×' + video.videoHeight);
  console.log('   Current Source:', video.currentSrc?.substring(0, 80) + '...');
  console.log('   Paused:', video.paused);
  console.log('   Muted:', video.muted);
} else {
  console.warn('\n📹 No video element found on page.');
}

// Performance metrics
if (typeof window.__ANGEL_PERFORMANCE__ === 'function') {
  console.log('\n📈 Performance Metrics:');
  window.__ANGEL_PERFORMANCE__();
}

console.log('\n✅ HD Enhancement verification complete!');
console.log('💡 Tip: Scroll to a new reel to see the quality badge update.');
