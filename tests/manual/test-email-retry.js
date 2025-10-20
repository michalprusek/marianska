/**
 * Test script for EmailService retry mechanism
 *
 * Tests:
 * 1. First attempt fails, second attempt succeeds after 1-minute delay
 * 2. Both attempts fail - proper error handling
 * 3. First attempt succeeds - no retry needed
 * 4. Verify 60-second delay between attempts
 */

const nodemailer = require('nodemailer');
const EmailService = require('./js/shared/emailService');

// Mock settings
const mockSettings = {
  email: {
    from: 'test@chata.utia.cas.cz',
    adminEmail: 'admin@chata.utia.cas.cz',
  },
};

// Mock booking for testing
const mockBooking = {
  id: 'BK1234567890TEST',
  name: 'Test User',
  email: 'testuser@example.com',
  startDate: '2025-10-20',
  endDate: '2025-10-22',
  rooms: ['12', '13'],
  adults: 2,
  children: 1,
  totalPrice: 1500,
  editToken: 'test-token-123456',
};

// Track call attempts
let sendMailCallCount = 0;
let firstAttemptTime = null;
let secondAttemptTime = null;

/**
 * Test 1: First attempt fails, second succeeds
 */
async function testRetrySuccess() {
  console.log('\n=== TEST 1: First attempt fails, second succeeds ===\n');

  sendMailCallCount = 0;
  firstAttemptTime = null;
  secondAttemptTime = null;

  // Create mock transport that fails first time, succeeds second time
  const mockTransport = {
    sendMail: async (mailOptions) => {
      sendMailCallCount++;

      if (sendMailCallCount === 1) {
        firstAttemptTime = Date.now();
        console.log(`[${new Date().toISOString()}] First attempt - simulating failure...`);
        throw new Error('SMTP connection timeout');
      } else {
        secondAttemptTime = Date.now();
        const delaySeconds = ((secondAttemptTime - firstAttemptTime) / 1000).toFixed(1);
        console.log(
          `[${new Date().toISOString()}] Second attempt - success! (delay: ${delaySeconds}s)`
        );
        return { messageId: 'test-message-id-success' };
      }
    },
  };

  // Mock nodemailer.createTransport
  const originalCreateTransport = nodemailer.createTransport;
  nodemailer.createTransport = () => mockTransport;

  try {
    const emailService = new EmailService();
    const result = await emailService.sendBookingConfirmation(mockBooking, {
      settings: mockSettings,
    });

    console.log('\n✅ Test 1 PASSED:');
    console.log(`   - Total attempts: ${sendMailCallCount}`);
    console.log(
      `   - Delay between attempts: ${((secondAttemptTime - firstAttemptTime) / 1000).toFixed(1)}s`
    );
    console.log(`   - Expected delay: ~60s`);
    console.log(`   - Result: ${JSON.stringify(result)}`);

    // Verify delay is approximately 60 seconds (allow ±2 seconds for processing time)
    const actualDelay = (secondAttemptTime - firstAttemptTime) / 1000;
    if (actualDelay >= 58 && actualDelay <= 62) {
      console.log('   - Delay verification: ✅ PASSED (within acceptable range)');
    } else {
      console.log(
        `   - Delay verification: ❌ FAILED (expected ~60s, got ${actualDelay.toFixed(1)}s)`
      );
    }
  } catch (error) {
    console.error('\n❌ Test 1 FAILED:', error.message);
  } finally {
    nodemailer.createTransport = originalCreateTransport;
  }
}

/**
 * Test 2: Both attempts fail
 */
async function testRetryBothFail() {
  console.log('\n=== TEST 2: Both attempts fail ===\n');

  sendMailCallCount = 0;
  firstAttemptTime = null;
  secondAttemptTime = null;

  // Create mock transport that fails both times
  const mockTransport = {
    sendMail: async (mailOptions) => {
      sendMailCallCount++;

      if (sendMailCallCount === 1) {
        firstAttemptTime = Date.now();
        console.log(`[${new Date().toISOString()}] First attempt - simulating failure...`);
        throw new Error('SMTP connection timeout');
      } else {
        secondAttemptTime = Date.now();
        const delaySeconds = ((secondAttemptTime - firstAttemptTime) / 1000).toFixed(1);
        console.log(
          `[${new Date().toISOString()}] Second attempt - simulating failure (delay: ${delaySeconds}s)...`
        );
        throw new Error('SMTP server unavailable');
      }
    },
  };

  const originalCreateTransport = nodemailer.createTransport;
  nodemailer.createTransport = () => mockTransport;

  try {
    const emailService = new EmailService();
    await emailService.sendBookingConfirmation(mockBooking, { settings: mockSettings });

    console.error('\n❌ Test 2 FAILED: Should have thrown an error');
  } catch (error) {
    console.log('\n✅ Test 2 PASSED:');
    console.log(`   - Total attempts: ${sendMailCallCount}`);
    console.log(
      `   - Delay between attempts: ${((secondAttemptTime - firstAttemptTime) / 1000).toFixed(1)}s`
    );
    console.log(`   - Error message: ${error.message}`);
    console.log(
      '   - Both errors included in message:',
      error.message.includes('SMTP connection timeout') &&
        error.message.includes('SMTP server unavailable')
        ? '✅'
        : '❌'
    );
  } finally {
    nodemailer.createTransport = originalCreateTransport;
  }
}

/**
 * Test 3: First attempt succeeds (no retry needed)
 */
async function testNoRetryNeeded() {
  console.log('\n=== TEST 3: First attempt succeeds (no retry) ===\n');

  sendMailCallCount = 0;
  const startTime = Date.now();

  // Create mock transport that succeeds immediately
  const mockTransport = {
    sendMail: async (mailOptions) => {
      sendMailCallCount++;
      console.log(`[${new Date().toISOString()}] First attempt - success!`);
      return { messageId: 'test-message-id-immediate' };
    },
  };

  const originalCreateTransport = nodemailer.createTransport;
  nodemailer.createTransport = () => mockTransport;

  try {
    const emailService = new EmailService();
    const result = await emailService.sendBookingConfirmation(mockBooking, {
      settings: mockSettings,
    });

    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log('\n✅ Test 3 PASSED:');
    console.log(`   - Total attempts: ${sendMailCallCount}`);
    console.log(`   - Total time: ${totalTime}s (should be < 5s)`);
    console.log(`   - Result: ${JSON.stringify(result)}`);

    if (sendMailCallCount === 1 && totalTime < 5) {
      console.log('   - No retry verification: ✅ PASSED');
    } else {
      console.log('   - No retry verification: ❌ FAILED (unexpected retry or delay)');
    }
  } catch (error) {
    console.error('\n❌ Test 3 FAILED:', error.message);
  } finally {
    nodemailer.createTransport = originalCreateTransport;
  }
}

/**
 * Run all tests
 */
async function runAllTests() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║        Email Retry Mechanism Test Suite                     ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');

  try {
    // Test 1: Retry success (takes ~60 seconds)
    await testRetrySuccess();

    // Test 2: Both attempts fail (takes ~60 seconds)
    await testRetryBothFail();

    // Test 3: Immediate success (fast)
    await testNoRetryNeeded();

    console.log('\n╔══════════════════════════════════════════════════════════════╗');
    console.log('║                   All Tests Completed                        ║');
    console.log('╚══════════════════════════════════════════════════════════════╝\n');
  } catch (error) {
    console.error('\n💥 Test suite error:', error);
    process.exit(1);
  }
}

// Run tests
if (require.main === module) {
  runAllTests()
    .then(() => {
      console.log('Test suite finished successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Test suite failed:', error);
      process.exit(1);
    });
}

module.exports = { testRetrySuccess, testRetryBothFail, testNoRetryNeeded };
