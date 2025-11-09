/**
 * Test price validation endpoint
 * Tests that admin settings endpoint properly validates price data
 */

// Test 1: Invalid price structure (missing fields)
async function testInvalidPriceStructure() {
  console.log('\n=== Test 1: Invalid Price Structure (missing fields) ===');
  
  const invalidPrices = {
    utia: {
      small: {
        empty: 250
        // Missing 'adult' and 'child'
      }
    }
  };
  
  try {
    const response = await fetch('http://localhost:3000/api/admin/settings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Session-Token': 'dummy-token-for-test' // Would need real token in production
      },
      body: JSON.stringify({ prices: invalidPrices })
    });
    
    const result = await response.json();
    console.log('Response status:', response.status);
    console.log('Response body:', JSON.stringify(result, null, 2));
    
    if (response.status === 400) {
      console.log('✅ PASS: Server correctly rejected invalid price structure');
    } else {
      console.log('❌ FAIL: Server should have returned 400 status');
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

// Test 2: Negative price
async function testNegativePrice() {
  console.log('\n=== Test 2: Negative Price ===');
  
  const negativePrices = {
    utia: {
      small: {
        empty: -100,  // Invalid: negative
        adult: 50,
        child: 25
      },
      large: {
        empty: 350,
        adult: 70,
        child: 35
      }
    },
    external: {
      small: {
        empty: 400,
        adult: 100,
        child: 50
      },
      large: {
        empty: 500,
        adult: 120,
        child: 60
      }
    }
  };
  
  try {
    const response = await fetch('http://localhost:3000/api/admin/settings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Session-Token': 'dummy-token'
      },
      body: JSON.stringify({ prices: negativePrices })
    });
    
    const result = await response.json();
    console.log('Response status:', response.status);
    console.log('Response body:', JSON.stringify(result, null, 2));
    
    if (response.status === 400 && result.error && result.error.includes('mimo povolený rozsah')) {
      console.log('✅ PASS: Server correctly rejected negative price');
    } else {
      console.log('❌ FAIL: Server should have rejected negative price');
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

// Test 3: Valid prices (should work with authentication)
async function testValidPrices() {
  console.log('\n=== Test 3: Valid Price Structure (would need auth) ===');
  
  const validPrices = {
    utia: {
      small: {
        empty: 250,
        adult: 50,
        child: 25
      },
      large: {
        empty: 350,
        adult: 70,
        child: 35
      }
    },
    external: {
      small: {
        empty: 400,
        adult: 100,
        child: 50
      },
      large: {
        empty: 500,
        adult: 120,
        child: 60
      }
    }
  };
  
  try {
    const response = await fetch('http://localhost:3000/api/admin/settings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Session-Token': 'dummy-token'
      },
      body: JSON.stringify({ prices: validPrices })
    });
    
    const result = await response.json();
    console.log('Response status:', response.status);
    console.log('Response body:', JSON.stringify(result, null, 2));
    
    if (response.status === 401) {
      console.log('✅ PASS: Valid price structure passed validation (rejected only due to auth)');
    } else if (response.status === 400) {
      console.log('❌ FAIL: Valid prices were incorrectly rejected');
    } else {
      console.log('ℹ️  Note: Would work with valid session token');
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

// Run all tests
async function runTests() {
  console.log('========================================');
  console.log('Admin Price Validation Tests');
  console.log('========================================');
  
  await testInvalidPriceStructure();
  await testNegativePrice();
  await testValidPrices();
  
  console.log('\n========================================');
  console.log('Tests completed');
  console.log('========================================\n');
}

runTests().catch(console.error);
