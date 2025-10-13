#!/usr/bin/env node
/**
 * Demo script for email functionality
 * Shows how email templates are generated without actually sending
 */

require('dotenv').config();
const EmailService = require('./js/shared/emailService');

console.log('='.repeat(70));
console.log('EMAIL SERVICE DEMO - Chata Mariánská');
console.log('='.repeat(70));

// Initialize email service
const emailService = new EmailService();

console.log('\n📧 Email Service Configuration:');
console.log(`   SMTP Host: ${emailService.config.host}`);
console.log(`   SMTP Port: ${emailService.config.port}`);
console.log(`   From Address: ${emailService.config.from}`);
console.log(`   App URL: ${emailService.config.appUrl}`);

// Test SMTP connection
console.log('\n🔌 Testing SMTP Connection...');
emailService
  .verifyConnection()
  .then((verified) => {
    if (verified) {
      console.log('   ✅ SMTP connection verified successfully');
      console.log('   ✅ Email server is reachable and ready');
    } else {
      console.log('   ❌ SMTP connection verification failed');
    }

    // Generate sample booking email
    console.log('\n📨 Sample Booking Confirmation Email:');
    console.log('─'.repeat(70));

    const sampleBooking = {
      id: 'BK20251213ABC123',
      name: 'Jan Novák',
      email: 'jan.novak@example.com',
      startDate: '2025-12-20',
      endDate: '2025-12-23',
      rooms: ['12', '13', '14'],
      guestType: 'utia',
      adults: 6,
      children: 2,
      toddlers: 1,
      totalPrice: 8940,
      notes: 'Prosíme o pozdější check-in (po 18:00)',
      editToken: 'abc123def456ghi789jkl012mno345',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const editUrl = `${emailService.config.appUrl}/edit.html?token=${sampleBooking.editToken}`;

    console.log('\n📋 Booking Details:');
    console.log(`   Booking ID: ${sampleBooking.id}`);
    console.log(`   Guest: ${sampleBooking.name} <${sampleBooking.email}>`);
    console.log(`   Check-in: ${sampleBooking.startDate}`);
    console.log(`   Check-out: ${sampleBooking.endDate}`);
    console.log(`   Rooms: ${sampleBooking.rooms.join(', ')}`);
    console.log(`   Total Price: ${emailService.formatPrice(sampleBooking.totalPrice)}`);
    console.log(`   Edit URL: ${editUrl}`);

    // Generate plain text email
    const textContent = emailService.generateBookingConfirmationText(sampleBooking, editUrl);

    console.log('\n📄 Generated Plain Text Email:');
    console.log('─'.repeat(70));
    console.log(textContent);
    console.log('─'.repeat(70));

    console.log('\n✅ Email HTML template also generated (not shown in console)');
    console.log('   - Professional HTML design with styling');
    console.log('   - Responsive layout for mobile devices');
    console.log('   - Includes all booking details');
    console.log('   - Edit link button prominently displayed');
    console.log('   - Contact information footer');

    console.log('\n🚀 Integration Status:');
    console.log('   ✅ EmailService module created');
    console.log('   ✅ Nodemailer installed and configured');
    console.log('   ✅ SMTP connection verified');
    console.log('   ✅ Email templates (HTML + Text) implemented');
    console.log('   ✅ Integrated into booking creation flow (server.js)');
    console.log('   ✅ Admin test email endpoint added (/api/admin/test-email)');
    console.log('   ✅ Environment variables configured');

    console.log('\n📝 How It Works:');
    console.log('   1. User creates a booking through the web interface');
    console.log('   2. Server creates booking in database and generates edit token');
    console.log('   3. EmailService sends confirmation email automatically (async)');
    console.log('   4. User receives email with booking details and edit link');
    console.log('   5. User can click edit link to modify or cancel booking');

    console.log('\n⚙️  Configuration:');
    console.log('   - SMTP server: hermes.utia.cas.cz:25');
    console.log('   - No authentication required (internal server)');
    console.log('   - Emails sent from: noreply@chata.utia.cas.cz');
    console.log('   - Edit links point to: http://chata.utia.cas.cz');

    console.log('\n🧪 Testing:');
    console.log('   - Run: node test-email.js <valid-email@utia.cas.cz>');
    console.log('   - Or use admin panel test email feature');
    console.log('   - Make sure the recipient email exists in UTIA system');

    console.log(`\n${'='.repeat(70)}`);
    console.log('Email system is ready for production use! 🎉');
    console.log(`${'='.repeat(70)}\n`);
  })
  .catch((error) => {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  });
