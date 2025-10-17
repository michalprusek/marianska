/**
 * Test API endpoint responses
 */

const http = require('http');

function testAPI() {
  console.log('\n=== TESTING API ENDPOINT ===\n');

  const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/data',
    method: 'GET',
  };

  const req = http.request(options, (res) => {
    let data = '';

    res.on('data', (chunk) => {
      data += chunk;
    });

    res.on('end', () => {
      try {
        const response = JSON.parse(data);

        console.log('1. API Response Status:', res.statusCode, res.statusCode === 200 ? '✓' : '✗');

        console.log('\n2. Settings structure check:');
        console.log('   - Has settings:', !!response.settings ? '✓' : '✗');
        console.log('   - Has prices:', !!response.settings?.prices ? '✓' : '✗');

        const prices = response.settings.prices;

        console.log('\n3. Room-size-based pricing structure:');
        console.log('   - Has ÚTIA small:', !!prices?.utia?.small ? '✓' : '✗');
        console.log('   - Has ÚTIA large:', !!prices?.utia?.large ? '✓' : '✗');
        console.log('   - Has External small:', !!prices?.external?.small ? '✓' : '✗');
        console.log('   - Has External large:', !!prices?.external?.large ? '✓' : '✗');

        console.log('\n4. Price values (ÚTIA small room):');
        console.log(
          '   Base:',
          prices?.utia?.small?.base,
          'Kč',
          prices?.utia?.small?.base === 300 ? '✓' : '✗'
        );
        console.log(
          '   Adult:',
          prices?.utia?.small?.adult,
          'Kč',
          prices?.utia?.small?.adult === 50 ? '✓' : '✗'
        );
        console.log(
          '   Child:',
          prices?.utia?.small?.child,
          'Kč',
          prices?.utia?.small?.child === 25 ? '✓' : '✗'
        );

        console.log('\n5. Price values (ÚTIA large room):');
        console.log(
          '   Base:',
          prices?.utia?.large?.base,
          'Kč',
          prices?.utia?.large?.base === 400 ? '✓' : '✗'
        );
        console.log(
          '   Adult:',
          prices?.utia?.large?.adult,
          'Kč',
          prices?.utia?.large?.adult === 50 ? '✓' : '✗'
        );
        console.log(
          '   Child:',
          prices?.utia?.large?.child,
          'Kč',
          prices?.utia?.large?.child === 25 ? '✓' : '✗'
        );

        console.log('\n6. Price values (External small room):');
        console.log(
          '   Base:',
          prices?.external?.small?.base,
          'Kč',
          prices?.external?.small?.base === 500 ? '✓' : '✗'
        );
        console.log(
          '   Adult:',
          prices?.external?.small?.adult,
          'Kč',
          prices?.external?.small?.adult === 100 ? '✓' : '✗'
        );
        console.log(
          '   Child:',
          prices?.external?.small?.child,
          'Kč',
          prices?.external?.small?.child === 50 ? '✓' : '✗'
        );

        console.log('\n7. Price values (External large room):');
        console.log(
          '   Base:',
          prices?.external?.large?.base,
          'Kč',
          prices?.external?.large?.base === 600 ? '✓' : '✗'
        );
        console.log(
          '   Adult:',
          prices?.external?.large?.adult,
          'Kč',
          prices?.external?.large?.adult === 100 ? '✓' : '✗'
        );
        console.log(
          '   Child:',
          prices?.external?.large?.child,
          'Kč',
          prices?.external?.large?.child === 50 ? '✓' : '✗'
        );

        console.log('\n8. Room configuration check:');
        const rooms = response.settings.rooms;
        console.log('   - Has rooms array:', Array.isArray(rooms) ? '✓' : '✗');

        if (Array.isArray(rooms)) {
          const smallRooms = rooms.filter((r) => r.type === 'small');
          const largeRooms = rooms.filter((r) => r.type === 'large');
          console.log(
            `   - Small rooms (${smallRooms.length}):`,
            smallRooms.map((r) => r.id).join(', ')
          );
          console.log(
            `   - Large rooms (${largeRooms.length}):`,
            largeRooms.map((r) => r.id).join(', ')
          );

          // Verify specific room types
          const room12 = rooms.find((r) => r.id === '12');
          const room14 = rooms.find((r) => r.id === '14');
          console.log('   - Room 12 type:', room12?.type, room12?.type === 'small' ? '✓' : '✗');
          console.log('   - Room 14 type:', room14?.type, room14?.type === 'large' ? '✓' : '✗');
        }

        console.log('\n=== API TESTS COMPLETED ===\n');
      } catch (error) {
        console.error('Error parsing response:', error);
      }
    });
  });

  req.on('error', (error) => {
    console.error('Error making request:', error);
  });

  req.end();
}

// Wait a bit for the server to be ready, then test
setTimeout(testAPI, 1000);
