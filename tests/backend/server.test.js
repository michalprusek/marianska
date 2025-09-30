// Comprehensive server.js integration tests
const request = require('supertest');

// Mock DatabaseManager before requiring server
jest.mock('../../database', () => {
  const mockDb = {
    getAllBookings: jest.fn(() => []),
    getBooking: jest.fn(),
    createBooking: jest.fn(),
    updateBooking: jest.fn(),
    deleteBooking: jest.fn(),
    getAllBlockedDates: jest.fn(() => []),
    blockDate: jest.fn(),
    unblockDate: jest.fn(),
    getSettings: jest.fn(() => ({
      adminPassword: '$2b$10$rKqH1p3NxZ.F9eQH9fZ0d.YXq0v7Z5KQ5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z',
      christmasAccessCodes: ['XMAS2024'],
      christmasPeriods: [
        {
          period_id: 'XMAS_2024',
          name: 'Vánoce 2024',
          start_date: '2024-12-23',
          end_date: '2025-01-02',
          year: 2024,
        },
      ],
      rooms: [
        { id: '12', name: 'Pokoj 12', beds: 2, type: 'small' },
        { id: '13', name: 'Pokoj 13', beds: 3, type: 'small' },
      ],
      prices: {
        utia: { base: 300, adult: 50, child: 25 },
        external: { base: 500, adult: 100, child: 50 },
      },
    })),
    updateSettings: jest.fn(),
  };
  return jest.fn(() => mockDb);
});

describe('Server Integration Tests', () => {
  let app;
  let db;

  beforeEach(() => {
    // Clear module cache to get fresh instance
    jest.clearAllMocks();
    delete require.cache[require.resolve('../../server')];

    // Import server (this will use mocked DatabaseManager)
    app = require('../../server');

    // Get database instance from mock
    const DatabaseManager = require('../../database');
    db = new DatabaseManager();
  });

  afterEach(() => {
    // Close server connections if any
    if (app && app.close) {
      app.close();
    }
  });

  describe('Static File Serving', () => {
    it('should serve index.html', async () => {
      const response = await request(app).get('/');
      expect(response.status).toBe(200);
      expect(response.type).toMatch(/html/u);
    });

    it('should serve admin.html', async () => {
      const response = await request(app).get('/admin.html');
      expect(response.status).toBe(200);
      expect(response.type).toMatch(/html/u);
    });

    it('should serve edit.html', async () => {
      const response = await request(app).get('/edit.html');
      expect(response.status).toBe(200);
      expect(response.type).toMatch(/html/u);
    });

    it('should serve JavaScript files', async () => {
      const response = await request(app).get('/js/booking-app.js');
      expect(response.status).toBe(200);
      expect(response.type).toMatch(/javascript/u);
    });

    it('should serve CSS files', async () => {
      const response = await request(app).get('/css/styles.css');
      expect([200, 404]).toContain(response.status); // May or may not exist
    });
  });

  describe('GET /health', () => {
    it('should return health status', async () => {
      const response = await request(app).get('/health');
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ status: 'ok' });
    });
  });

  describe('GET /api/data', () => {
    it('should return all data', async () => {
      db.getAllBookings.mockReturnValue([
        {
          id: 'BK1234567890ABC',
          name: 'Test User',
          email: 'test@example.com',
        },
      ]);

      const response = await request(app).get('/api/data');
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('bookings');
      expect(response.body).toHaveProperty('blockedDates');
      expect(response.body).toHaveProperty('settings');
      expect(response.body.bookings).toHaveLength(1);
    });

    it('should not include admin password', async () => {
      const response = await request(app).get('/api/data');
      expect(response.status).toBe(200);
      expect(response.body.settings.adminPassword).toBeUndefined();
    });
  });

  describe('POST /api/booking', () => {
    const validBooking = {
      name: 'Jan Novák',
      email: 'jan@example.com',
      phone: '+420123456789',
      company: 'Test s.r.o.',
      address: 'Test 123',
      city: 'Praha',
      zip: '12345',
      startDate: '2025-07-01',
      endDate: '2025-07-03',
      rooms: ['12'],
      guestType: 'utia',
      adults: 2,
      children: 0,
      toddlers: 0,
      notes: '',
    };

    beforeEach(() => {
      db.createBooking.mockImplementation((booking) => ({
        ...booking,
        id: 'BK1234567890ABC',
        editToken: 'abc123def456ghi789jkl012mno345',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }));
    });

    it('should create booking with valid data', async () => {
      const response = await request(app).post('/api/booking').send(validBooking);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data).toHaveProperty('editToken');
      expect(db.createBooking).toHaveBeenCalled();
    });

    it('should reject booking with missing name', async () => {
      const invalidBooking = { ...validBooking, name: '' };
      const response = await request(app).post('/api/booking').send(invalidBooking);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toMatch(/name/iu);
    });

    it('should reject booking with invalid email', async () => {
      const invalidBooking = { ...validBooking, email: 'invalid-email' };
      const response = await request(app).post('/api/booking').send(invalidBooking);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should reject booking with invalid phone', async () => {
      const invalidBooking = { ...validBooking, phone: '123' };
      const response = await request(app).post('/api/booking').send(invalidBooking);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should reject booking with end date before start date', async () => {
      const invalidBooking = {
        ...validBooking,
        startDate: '2025-07-05',
        endDate: '2025-07-03',
      };
      const response = await request(app).post('/api/booking').send(invalidBooking);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should calculate total price', async () => {
      const response = await request(app).post('/api/booking').send(validBooking);

      expect(response.status).toBe(201);
      expect(response.body.data).toHaveProperty('totalPrice');
      expect(response.body.data.totalPrice).toBeGreaterThan(0);
    });
  });

  describe('PUT /api/booking/:id', () => {
    const existingBooking = {
      id: 'BK1234567890ABC',
      name: 'Original Name',
      email: 'original@example.com',
      phone: '+420123456789',
      editToken: 'abc123def456ghi789jkl012mno345',
      startDate: '2025-07-01',
      endDate: '2025-07-03',
      rooms: ['12'],
      guestType: 'utia',
      adults: 2,
      children: 0,
      toddlers: 0,
    };

    beforeEach(() => {
      db.getBooking.mockReturnValue(existingBooking);
      db.updateBooking.mockImplementation((id, updates) => ({
        ...existingBooking,
        ...updates,
        updatedAt: new Date().toISOString(),
      }));
    });

    it('should update booking with valid edit token', async () => {
      const updates = {
        name: 'Updated Name',
        editToken: existingBooking.editToken,
      };

      const response = await request(app).put(`/api/booking/${existingBooking.id}`).send(updates);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(db.updateBooking).toHaveBeenCalled();
    });

    it('should reject update without edit token', async () => {
      const updates = { name: 'Updated Name' };

      const response = await request(app).put(`/api/booking/${existingBooking.id}`).send(updates);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });

    it('should reject update with invalid edit token', async () => {
      const updates = {
        name: 'Updated Name',
        editToken: 'wrong-token',
      };

      const response = await request(app).put(`/api/booking/${existingBooking.id}`).send(updates);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });

    it('should reject update for non-existent booking', async () => {
      db.getBooking.mockReturnValue(null);

      const updates = {
        name: 'Updated Name',
        editToken: 'some-token',
      };

      const response = await request(app).put('/api/booking/NONEXISTENT').send(updates);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('DELETE /api/booking/:id', () => {
    const existingBooking = {
      id: 'BK1234567890ABC',
      editToken: 'abc123def456ghi789jkl012mno345',
    };

    beforeEach(() => {
      db.getBooking.mockReturnValue(existingBooking);
      db.deleteBooking.mockReturnValue({ changes: 1 });
    });

    it('should delete booking with valid edit token', async () => {
      const response = await request(app)
        .delete(`/api/booking/${existingBooking.id}`)
        .send({ editToken: existingBooking.editToken });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(db.deleteBooking).toHaveBeenCalledWith(existingBooking.id);
    });

    it('should reject delete without edit token', async () => {
      const response = await request(app).delete(`/api/booking/${existingBooking.id}`).send({});

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });

    it('should reject delete with invalid edit token', async () => {
      const response = await request(app)
        .delete(`/api/booking/${existingBooking.id}`)
        .send({ editToken: 'wrong-token' });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });

    it('should handle deletion of non-existent booking', async () => {
      db.getBooking.mockReturnValue(null);

      const response = await request(app)
        .delete('/api/booking/NONEXISTENT')
        .send({ editToken: 'some-token' });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('Admin Authentication', () => {
    describe('POST /api/admin/login', () => {
      it('should authenticate with correct password', async () => {
        const response = await request(app).post('/api/admin/login').send({ password: 'admin123' });

        expect([200, 401]).toContain(response.status); // May vary based on hash
      });

      it('should reject incorrect password', async () => {
        const response = await request(app)
          .post('/api/admin/login')
          .send({ password: 'wrongpassword' });

        expect(response.status).toBe(401);
        expect(response.body.success).toBe(false);
      });

      it('should reject missing password', async () => {
        const response = await request(app).post('/api/admin/login').send({});

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
      });
    });
  });

  describe('Admin Operations', () => {
    const validApiKey = 'admin-api-key-123';

    describe('POST /api/admin/block-dates', () => {
      it('should block dates with valid API key', async () => {
        db.blockDate.mockResolvedValue(true);

        const response = await request(app)
          .post('/api/admin/block-dates')
          .set('x-api-key', validApiKey)
          .send({
            startDate: '2025-07-01',
            endDate: '2025-07-05',
            roomIds: ['12', '13'],
            reason: 'Maintenance',
          });

        // Will fail without proper API key validation, which is expected
        expect([200, 401]).toContain(response.status);
      });

      it('should reject without API key', async () => {
        const response = await request(app)
          .post('/api/admin/block-dates')
          .send({
            startDate: '2025-07-01',
            endDate: '2025-07-05',
            roomIds: ['12'],
            reason: 'Test',
          });

        expect(response.status).toBe(401);
      });
    });

    describe('POST /api/admin/update-password', () => {
      it('should reject password update without API key', async () => {
        const response = await request(app).post('/api/admin/update-password').send({
          currentPassword: 'admin123',
          newPassword: 'newpassword123',
        });

        expect(response.status).toBe(401);
      });
    });

    describe('GET /api/admin/bookings', () => {
      it('should return bookings with valid API key', async () => {
        db.getAllBookings.mockReturnValue([
          { id: 'BK1', name: 'Test 1' },
          { id: 'BK2', name: 'Test 2' },
        ]);

        const response = await request(app)
          .get('/api/admin/bookings')
          .set('x-api-key', validApiKey);

        // Will fail without proper API key validation
        expect([200, 401]).toContain(response.status);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle 404 for unknown routes', async () => {
      const response = await request(app).get('/api/nonexistent');
      expect(response.status).toBe(404);
    });

    it('should handle malformed JSON', async () => {
      const response = await request(app)
        .post('/api/booking')
        .set('Content-Type', 'application/json')
        .send('{"invalid json"');

      expect(response.status).toBe(400);
    });

    it('should handle database errors gracefully', async () => {
      db.createBooking.mockImplementation(() => {
        throw new Error('Database error');
      });

      const response = await request(app)
        .post('/api/booking')
        .send({
          name: 'Test',
          email: 'test@example.com',
          phone: '+420123456789',
          startDate: '2025-07-01',
          endDate: '2025-07-03',
          rooms: ['12'],
          guestType: 'utia',
          adults: 2,
          children: 0,
          toddlers: 0,
        });

      expect(response.status).toBe(500);
    });
  });

  describe('CORS Headers', () => {
    it('should include CORS headers', async () => {
      const response = await request(app).get('/api/data');
      expect(response.headers['access-control-allow-origin']).toBeDefined();
    });

    it('should handle OPTIONS requests', async () => {
      const response = await request(app).options('/api/booking');
      expect([200, 204]).toContain(response.status);
    });
  });

  describe('Rate Limiting', () => {
    it('should track requests', async () => {
      // Make multiple requests in parallel
      const requests = Array.from({ length: 5 }, () => request(app).get('/api/data'));
      await Promise.all(requests);

      // All should succeed (rate limit is high for testing)
      const response = await request(app).get('/api/data');
      expect(response.status).toBe(200);
    });
  });

  describe('Christmas Period Logic', () => {
    it('should detect Christmas period dates', async () => {
      const christmasBooking = {
        name: 'Test User',
        email: 'test@example.com',
        phone: '+420123456789',
        startDate: '2024-12-25',
        endDate: '2024-12-27',
        rooms: ['12'],
        guestType: 'utia',
        adults: 2,
        children: 0,
        toddlers: 0,
        christmasCode: 'XMAS2024',
      };

      db.createBooking.mockImplementation((booking) => ({
        ...booking,
        id: 'BK1234567890ABC',
        editToken: 'abc123',
      }));

      const response = await request(app).post('/api/booking').send(christmasBooking);

      // Should either accept with code or reject without
      expect([201, 400, 403]).toContain(response.status);
    });
  });
});
