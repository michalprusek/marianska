# Rezervační systém Chata Mariánská - Documentation Hub

## 📚 Documentation Navigation

- [API Documentation](./API.md) - Backend endpoints and data structures
- [Component Documentation](./COMPONENTS.md) - Frontend modules and UI components
- [Architecture Overview](./ARCHITECTURE.md) - System design and data flows
- [Deployment Guide](./DEPLOYMENT.md) - Installation and configuration
- [Business Rules](./BUSINESS_RULES.md) - Pricing, capacity, and booking logic
- [Security Documentation](./SECURITY.md) - Authentication and data protection

## 🚀 Quick Start

### Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Access at http://localhost:3000
```

### Production (Docker)

```bash
# Start services
docker-compose up -d

# Rebuild after changes
docker-compose down && docker-compose up --build -d
```

## 🏗️ Project Structure

```
marianska/
├── 📦 Server & Core
│   ├── server.js           # Express server with API endpoints
│   ├── data.js             # DataManager - business logic & storage
│   └── translations.js     # i18n support
│
├── 🎨 Frontend Pages
│   ├── index.html          # Public booking interface
│   ├── admin.html          # Admin dashboard
│   └── edit.html           # Booking edit interface
│
├── 🧩 JavaScript Modules
│   ├── js/
│   │   ├── booking-app.js      # Main orchestrator
│   │   ├── calendar.js         # Calendar component
│   │   ├── booking-form.js     # Form handling
│   │   ├── bulk-booking.js     # Multi-room booking
│   │   ├── single-room-booking.js # Single room mode
│   │   └── shared/             # Utility modules
│   │       ├── calendarUtils.js
│   │       ├── dateUtils.js
│   │       ├── idGenerator.js
│   │       ├── priceCalculator.js
│   │       └── validationUtils.js
│   │
│   └── admin.js            # Admin interface logic
│
├── 🎭 Styles
│   ├── styles.css          # Main styles
│   └── css/airbnb-calendar.css # Calendar styles
│
├── 📊 Data Storage
│   └── data/bookings.json  # Persistent booking data
│
└── 🔧 Configuration
    ├── docker-compose.yml  # Docker configuration
    ├── Dockerfile          # Container build
    └── package.json        # Dependencies & scripts
```

## 🔑 Key Features

### For Guests

- **Interactive Calendar** - Visual room availability with color coding
- **Smart Booking Form** - Two-step process with real-time validation
- **Multi-Room Selection** - Book multiple rooms in one transaction
- **Price Calculator** - Automatic pricing based on guest type and rooms
- **Edit Capability** - Modify bookings with secure token

### For Administrators

- **Comprehensive Dashboard** - Tabbed interface for all management tasks
- **Booking Management** - View, edit, and delete reservations
- **Date Blocking** - Block rooms for maintenance or special events
- **Christmas Period** - Special access control for peak season
- **Dynamic Pricing** - Configure prices for different guest types
- **Statistics** - Track occupancy, revenue, and trends

## 💼 Business Context

The system manages 9 rooms across 3 floors (26 beds total) for:

- **ÚTIA Employees** - Discounted rates
- **External Guests** - Standard rates
- **Christmas Period** - Access code restricted

## 🔗 Quick Links

- [View API Endpoints →](./API.md#endpoints)
- [Component Reference →](./COMPONENTS.md#modules)
- [Deployment Steps →](./DEPLOYMENT.md#installation)
- [Price Configuration →](./BUSINESS_RULES.md#pricing)
- [Security Features →](./SECURITY.md#features)

## 📝 License

Internal use for ÚTIA - All rights reserved
