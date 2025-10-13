# API Documentation

## Base Configuration

- **Development**: `http://localhost:3000/api`
- **Production**: `/api`
- **Data Format**: JSON
- **Authentication**: None (public endpoints)
- **CORS**: Enabled for all origins

## Endpoints

### 📊 Get All Data

**GET** `/api/data`

Retrieves complete system data including bookings, blocked dates, and settings.

**Response** `200 OK`

```json
{
  "bookings": [...],
  "blockedDates": [...],
  "settings": {
    "adminPassword": "string",
    "christmasAccessCodes": ["string"],
    "christmasPeriod": {
      "start": "YYYY-MM-DD",
      "end": "YYYY-MM-DD"
    },
    "rooms": [...],
    "prices": {...}
  }
}
```

---

### 💾 Save All Data

**POST** `/api/data`

Overwrites complete system data. Used for admin operations and sync.

**Request Body**

```json
{
  "bookings": [...],
  "blockedDates": [...],
  "settings": {...}
}
```

**Response** `200 OK`

```json
{
  "success": true
}
```

---

### ➕ Create Booking

**POST** `/api/booking`

Creates a new reservation with auto-generated ID and edit token.

**Request Body**

```json
{
  "name": "Jan Novák",
  "email": "jan@example.com",
  "phone": "+420123456789",
  "company": "Firma s.r.o.",
  "address": "Hlavní 123",
  "city": "Praha",
  "zip": "12345",
  "ico": "12345678", // Optional
  "dic": "CZ12345678", // Optional
  "startDate": "2024-03-15",
  "endDate": "2024-03-17",
  "rooms": ["12", "13"],
  "guestType": "utia", // "utia" or "external"
  "adults": 2,
  "children": 1,
  "toddlers": 0,
  "totalPrice": 1500,
  "notes": "Special requests"
}
```

**Response** `200 OK`

```json
{
  "id": "BK1234567890ABC",
  "editToken": "abc123def456",
  "createdAt": "2024-03-01T10:00:00.000Z"
}
```

---

### 📝 Update Booking

**PUT** `/api/booking/:id`

Updates an existing booking. Requires valid booking ID.

**URL Parameters**

- `id` - Booking ID (e.g., BK1234567890ABC)

**Request Body**

```json
{
  "name": "Updated Name",
  "endDate": "2024-03-18"
  // Any fields to update
}
```

**Response** `200 OK`

```json
{
  "success": true,
  "booking": {
    // Updated booking object
  }
}
```

**Error** `404 Not Found`

```json
{
  "error": "Booking not found"
}
```

---

### 🗑️ Delete Booking

**DELETE** `/api/booking/:id`

Removes a booking from the system.

**URL Parameters**

- `id` - Booking ID

**Response** `200 OK`

```json
{
  "success": true
}
```

**Error** `404 Not Found`

```json
{
  "error": "Booking not found"
}
```

## Data Structures

### Booking Object

```typescript
interface Booking {
  id: string; // Format: "BK" + timestamp + random
  name: string;
  email: string;
  phone: string;
  company?: string;
  address: string;
  city: string;
  zip: string;
  ico?: string; // 8 digits
  dic?: string; // Format: CZ12345678
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  rooms: string[]; // Room IDs
  guestType: 'utia' | 'external';
  adults: number;
  children: number;
  toddlers: number;
  totalPrice: number;
  notes?: string;
  editToken: string; // For booking modifications
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}
```

### Blocked Date Object

```typescript
interface BlockedDate {
  date: string; // YYYY-MM-DD
  roomId?: string; // Optional, null = all rooms
  reason: string;
  blockageId: string; // Format: "BLK" + timestamp
  blockedAt: string; // ISO 8601
}
```

### Room Object

```typescript
interface Room {
  id: string; // e.g., "12", "23", "44"
  name: string; // Display name
  type: 'small' | 'large'; // Room category
  beds: number; // Bed capacity
}
```

### Settings Object

```typescript
interface Settings {
  adminPassword: string;
  christmasAccessCodes: string[];
  christmasPeriod: {
    start: string; // YYYY-MM-DD
    end: string; // YYYY-MM-DD
  };
  rooms: Room[];
  prices: {
    utia: {
      small: PriceConfig;
      large: PriceConfig;
    };
    external: {
      small: PriceConfig;
      large: PriceConfig;
    };
  };
}
```

### Price Configuration

```typescript
interface PriceConfig {
  base: number; // Base price per night
  adult: number; // Additional adult price
  child: number; // Child price (3-18 years)
}
```

## Error Handling

All endpoints return consistent error responses:

**400 Bad Request**

```json
{
  "error": "Invalid request data",
  "details": "Specific validation error"
}
```

**404 Not Found**

```json
{
  "error": "Resource not found"
}
```

**500 Internal Server Error**

```json
{
  "error": "Internal server error",
  "message": "Error details (dev only)"
}
```

## Rate Limiting

No rate limiting is currently implemented. Consider adding for production:

- 100 requests per minute per IP
- 10 booking creations per hour per IP

## Caching

Client-side caching via DataManager:

- 5-minute cache for GET operations
- Automatic sync every 30 seconds
- LocalStorage fallback for offline mode

## Security Considerations

1. **No Authentication**: Add JWT or session auth for production
2. **Input Validation**: Implement server-side validation
3. **SQL Injection**: Not applicable (JSON file storage)
4. **XSS Protection**: Sanitize all user inputs
5. **HTTPS**: Required for production deployment

## Testing

```bash
# Get all data
curl http://localhost:3000/api/data

# Create booking
curl -X POST http://localhost:3000/api/booking \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","email":"test@example.com",...}'

# Update booking
curl -X PUT http://localhost:3000/api/booking/BK123 \
  -H "Content-Type: application/json" \
  -d '{"name":"Updated Name"}'

# Delete booking
curl -X DELETE http://localhost:3000/api/booking/BK123
```

## Future Enhancements

- [ ] Add authentication middleware
- [ ] Implement request validation
- [ ] Add pagination for large datasets
- [ ] Create webhook notifications
- [ ] Add API versioning (/api/v1/)
- [ ] Implement rate limiting
- [ ] Add OpenAPI/Swagger documentation
