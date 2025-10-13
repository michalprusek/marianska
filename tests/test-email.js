#!/usr/bin/env node
/**
 * Test script for email sending functionality
 * Usage: node test-email.js <recipient-email>
 */

require('dotenv').config();
const EmailService = require('./js/shared/emailService');

// Get recipient email from command line argument
const recipientEmail = process.argv[2];

if (!recipientEmail) {
  console.error('Usage: node test-email.js <recipient-email>');
  process.exit(1);
}

// Validate email format
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
if (!emailRegex.test(recipientEmail)) {
  console.error('Error: Invalid email format');
  process.exit(1);
}

console.log('Testing email sending...');
console.log(`Recipient: ${recipientEmail}`);
console.log(`SMTP Host: ${process.env.SMTP_HOST || 'hermes.utia.cas.cz'}`);
console.log(`SMTP Port: ${process.env.SMTP_PORT || 25}`);
console.log('---');

// Initialize email service
const emailService = new EmailService();

// Test 1: Verify SMTP connection
console.log('\n1. Verifying SMTP connection...');
emailService
  .verifyConnection()
  .then((verified) => {
    if (verified) {
      console.log('✅ SMTP connection verified successfully');
    } else {
      console.log('❌ SMTP connection verification failed');
      process.exit(1);
    }

    // Test 2: Send test email
    console.log('\n2. Sending test email...');
    return emailService.sendTestEmail(recipientEmail);
  })
  .then((result) => {
    if (result.success) {
      console.log('✅ Test email sent successfully');
      console.log(`   Message ID: ${result.messageId}`);
    } else {
      console.log('❌ Failed to send test email');
      console.log(`   Error: ${result.error}`);
      process.exit(1);
    }

    // Test 3: Send booking confirmation email
    console.log('\n3. Sending sample booking confirmation...');

    const sampleBooking = {
      id: 'BK20251013TEST',
      name: 'Test Uživatel',
      email: recipientEmail,
      startDate: '2025-12-20',
      endDate: '2025-12-23',
      rooms: ['12', '13'],
      guestType: 'utia',
      adults: 4,
      children: 2,
      toddlers: 1,
      totalPrice: 5000,
      notes: 'Toto je testovací rezervace pro ověření emailové funkcionality.',
      editToken: 'test_edit_token_12345678901234',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    return emailService.sendBookingConfirmation(sampleBooking);
  })
  .then((result) => {
    if (result.success) {
      console.log('✅ Booking confirmation email sent successfully');
      console.log(`   Message ID: ${result.messageId}`);
      console.log(`   Accepted: ${result.accepted?.join(', ') || 'N/A'}`);
    } else {
      console.log('❌ Failed to send booking confirmation');
      console.log(`   Error: ${result.error}`);
      process.exit(1);
    }

    console.log('\n✅ All email tests passed!');
    console.log('\nCheck your inbox at:', recipientEmail);
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Email test failed with error:');
    console.error(error);
    process.exit(1);
  });
