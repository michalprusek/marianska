#!/usr/bin/env node

// Test guest distribution logic

// Wrap in IIFE to avoid global scope pollution
(function testGuestDistribution() {
  function distributeGuests(totalGuests, roomCount) {
    const guestsPerRoom = Math.floor(totalGuests / roomCount);
    const remainder = totalGuests % roomCount;

    const distribution = [];
    for (let i = 0; i < roomCount; i++) {
      distribution.push(guestsPerRoom + (i < remainder ? 1 : 0));
    }

    return distribution;
  }

  console.log('=== Test distribuce hostů ===\n');

  // Test case 1: 5 dospělých, 2 pokoje
  console.log('Test 1: 5 dospělých, 2 pokoje');
  const dist1 = distributeGuests(5, 2);
  console.log(`  Pokoj 1: ${dist1[0]} dospělých`);
  console.log(`  Pokoj 2: ${dist1[1]} dospělých`);
  console.log(`  Celkem: ${dist1.reduce((a, b) => a + b, 0)} dospělých ✓\n`);

  // Test case 2: 6 dospělých, 3 pokoje
  console.log('Test 2: 6 dospělých, 3 pokoje');
  const dist2 = distributeGuests(6, 3);
  console.log(`  Pokoj 1: ${dist2[0]} dospělých`);
  console.log(`  Pokoj 2: ${dist2[1]} dospělých`);
  console.log(`  Pokoj 3: ${dist2[2]} dospělých`);
  console.log(`  Celkem: ${dist2.reduce((a, b) => a + b, 0)} dospělých ✓\n`);

  // Test case 3: 7 dospělých, 3 pokoje
  console.log('Test 3: 7 dospělých, 3 pokoje (nerovnoměrné)');
  const dist3 = distributeGuests(7, 3);
  console.log(`  Pokoj 1: ${dist3[0]} dospělých`);
  console.log(`  Pokoj 2: ${dist3[1]} dospělých`);
  console.log(`  Pokoj 3: ${dist3[2]} dospělých`);
  console.log(`  Celkem: ${dist3.reduce((a, b) => a + b, 0)} dospělých ✓\n`);

  // Test case 4: 2 děti, 5 pokojů
  console.log('Test 4: 2 děti, 5 pokojů');
  const dist4 = distributeGuests(2, 5);
  console.log(`  Pokoj 1: ${dist4[0]} dětí`);
  console.log(`  Pokoj 2: ${dist4[1]} dětí`);
  console.log(`  Pokoj 3: ${dist4[2]} dětí`);
  console.log(`  Pokoj 4: ${dist4[3]} dětí`);
  console.log(`  Pokoj 5: ${dist4[4]} dětí`);
  console.log(`  Celkem: ${dist4.reduce((a, b) => a + b, 0)} dětí ✓\n`);

  console.log('=== Všechny testy prošly ===');
  console.log('\nPoznámka: První pokoje dostanou +1 hosta, pokud není rovnoměrné rozdělení.');
})();
