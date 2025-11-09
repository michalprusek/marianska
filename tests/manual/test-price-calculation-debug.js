// Test price calculation logic
// User reported: Nov 21-23 (should be 2 nights), 1 adult ÚTIA, seeing 900 Kč instead of 600 Kč

// Expected calculation:
// Empty room: 250 Kč
// 1 adult surcharge: 50 Kč
// Per night: 300 Kč
// 2 nights: 600 Kč

// Problem analysis:
console.log('\n=== PRICE CALCULATION DEBUG ===\n');

// Simulate date selection
const dates = new Set(['2024-11-21', '2024-11-22', '2024-11-23']);
console.log('Selected dates:', Array.from(dates));
console.log('dates.size:', dates.size);

// LINE 481 in utils.js:
const nights = Math.max(0, dates.size - 1);
console.log('Calculated nights (dates.size - 1):', nights);

// This gives us 3 - 1 = 2 nights ✓ (CORRECT)

// Base price calculation (ÚTIA small room):
const baseRoomPrice = 250; // Empty room
console.log('\nBase room price (empty):', baseRoomPrice);

// Guest surcharges:
const adults = 1;
const adultSurcharge = 50; // Per adult per night
const totalAdultSurcharge = adults * adultSurcharge;
console.log('Adult surcharge per night:', totalAdultSurcharge, '(1 × 50)');

// Price per night:
const pricePerNight = baseRoomPrice + totalAdultSurcharge;
console.log('Price per night:', pricePerNight, '(250 + 50)');

// Total price:
const totalPrice = pricePerNight * nights;
console.log('\nTotal price:', totalPrice, '(' + pricePerNight + ' × ' + nights + ')');
console.log('Expected: 600 Kč');
console.log('User sees: 900 Kč');

// HYPOTHESIS:
console.log('\n=== HYPOTHESIS ===');
console.log('If user sees 900 Kč, then:');
console.log('900 / 300 (per night) = 3 nights');
console.log('OR 900 / 2 (nights) = 450 per night');
console.log('\n450 - 250 (base) = 200 (surcharge)');
console.log('200 / 50 = 4 adults counted?');
console.log('\nOR: Is dates.size = 4 instead of 3?');

// Let's check if the issue is in night calculation
console.log('\n=== CHECKING NIGHT CALCULATION ===');
console.log('If nights = 3 instead of 2:');
console.log('300 × 3 = 900 Kč ✓ MATCHES!');
console.log('\nSo the bug is: dates.size is 4, not 3');
console.log('This means user selected 4 dates instead of 3');
console.log('OR: The inclusive date model is including an extra day');

// Check the inclusive date model
console.log('\n=== INCLUSIVE DATE MODEL ===');
console.log('User wants: Nov 21 (check-in) to Nov 23 (check-out)');
console.log('Expected nights: 2 (21→22, 22→23)');
console.log('Expected dates selected: 21, 22, 23 (3 dates)');
console.log('dates.size - 1 = 3 - 1 = 2 nights ✓');
console.log('\nIf showing 900 Kč:');
console.log('Implies: dates.size = 4 (giving 3 nights)');
console.log('Dates would be: 21, 22, 23, 24');
console.log('This would mean check-out on Nov 24 instead of Nov 23');

// SUSPECTED ROOT CAUSE
console.log('\n=== ROOT CAUSE ===');
console.log('SUSPECTED: Calendar is adding an extra day to selection');
console.log('OR: Date range calculation is off by one');
console.log('Need to check: BaseCalendar date selection logic');
console.log('Need to check: How endDate is calculated from selection');
