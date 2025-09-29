# Mariánská Reservation System - Documentation Index

## 📖 Complete Documentation Map

### Quick Navigation

Use `Ctrl/Cmd + Click` to open links in new tabs

## 🏠 [Main Documentation Hub](./README.md)

The central entry point with project overview and quick start guides.

### Key Sections:

- Project structure overview
- Quick start instructions
- Feature highlights
- Technology stack

---

## 🔌 [API Documentation](./API.md)

Complete REST API reference for backend endpoints.

### Endpoints:

- [`GET /api/data`](./API.md#-get-all-data) - Retrieve all system data
- [`POST /api/data`](./API.md#-save-all-data) - Save complete data
- [`POST /api/booking`](./API.md#-create-booking) - Create new reservation
- [`PUT /api/booking/:id`](./API.md#-update-booking) - Update booking
- [`DELETE /api/booking/:id`](./API.md#-delete-booking) - Remove booking

### Data Structures:

- [Booking Object](./API.md#booking-object)
- [Blocked Date Object](./API.md#blocked-date-object)
- [Room Object](./API.md#room-object)
- [Settings Object](./API.md#settings-object)

---

## 🧩 [Component Documentation](./COMPONENTS.md)

Detailed documentation of all frontend and backend modules.

### Core Modules:

- [DataManager](./COMPONENTS.md#-datamanager-datajs) - Central data orchestrator
- [Calendar Component](./COMPONENTS.md#-calendar-component-jscalendarjs) - Interactive availability calendar
- [Booking Form](./COMPONENTS.md#-booking-form-jsbooking-formjs) - Two-step reservation form
- [Admin Dashboard](./COMPONENTS.md#-admin-dashboard-adminjs) - Management interface

### Shared Utilities:

- [Calendar Utils](./COMPONENTS.md#-calendar-utils-jssharedcalendarutilsjs)
- [Validation Utils](./COMPONENTS.md#-validation-utils-jssharedvalidationutilsjs)
- [Price Calculator](./COMPONENTS.md#-price-calculator-jssharedpricecalculatorjs)
- [ID Generator](./COMPONENTS.md#-id-generator-jssharedidgeneratorjs)
- [Date Utils](./COMPONENTS.md#-date-utils-jssharedddateutilsjs)

---

## 🏗️ [Architecture Documentation](./ARCHITECTURE.md)

System design, data flows, and technical architecture.

### Key Topics:

- [System Overview](./ARCHITECTURE.md#overview) - High-level architecture
- [Core Components](./ARCHITECTURE.md#core-components) - Backend and frontend layers
- [Data Flow](./ARCHITECTURE.md#data-flow) - Request/response patterns
- [State Management](./ARCHITECTURE.md#state-management) - Client and server state
- [Synchronization Strategy](./ARCHITECTURE.md#synchronization-strategy) - Online/offline modes
- [Security Architecture](./ARCHITECTURE.md#security-architecture) - Protection layers
- [Performance Optimizations](./ARCHITECTURE.md#performance-optimizations) - Speed improvements
- [Scalability Considerations](./ARCHITECTURE.md#scalability-considerations) - Growth planning
- [Deployment Architecture](./ARCHITECTURE.md#deployment-architecture) - Production setup

---

## 💼 [Business Rules](./BUSINESS_RULES.md)

Complete business logic documentation.

### Sections:

- [Room Configuration](./BUSINESS_RULES.md#-room-configuration) - Layout and capacity
- [Pricing Structure](./BUSINESS_RULES.md#-pricing-structure) - Guest type pricing
- [Christmas Period Rules](./BUSINESS_RULES.md#-christmas-period-rules) - Special access control
- [Booking Rules](./BUSINESS_RULES.md#-booking-rules) - Time constraints and modifications
- [Blocking Rules](./BUSINESS_RULES.md#-blocking-rules) - Admin controls
- [Guest Categories](./BUSINESS_RULES.md#-guest-categories) - ÚTIA vs External
- [Capacity Management](./BUSINESS_RULES.md#-capacity-management) - Occupancy limits
- [Business Process Flows](./BUSINESS_RULES.md#-business-process-flows) - Visual workflows

---

## 🚀 [Deployment Guide](./DEPLOYMENT.md)

Complete deployment and configuration instructions.

### Deployment Methods:

- [Docker Deployment](./DEPLOYMENT.md#-method-1-docker-deployment-recommended) - Containerized setup
- [Manual Deployment](./DEPLOYMENT.md#-method-2-manual-deployment) - Direct installation
- [Cloud Deployment](./DEPLOYMENT.md#-method-3-cloud-deployment) - AWS, Heroku, DigitalOcean

### Configuration:

- [SSL/HTTPS Setup](./DEPLOYMENT.md#-sslhttps-configuration) - Security certificates
- [Application Settings](./DEPLOYMENT.md#-configuration) - System configuration
- [Monitoring](./DEPLOYMENT.md#-monitoring) - Health checks and logging
- [Updates & Maintenance](./DEPLOYMENT.md#-updates--maintenance) - Upgrade procedures
- [Troubleshooting](./DEPLOYMENT.md#-troubleshooting) - Common issues

---

## 🔒 [Security Documentation](./SECURITY.md)

Security features, best practices, and incident response.

### Security Topics:

- [Security Overview](./SECURITY.md#-security-overview) - Protection layers
- [Features](./SECURITY.md#-features) - Input validation, sanitization
- [Access Control](./SECURITY.md#-access-control) - Token and admin auth
- [Data Protection](./SECURITY.md#-data-protection) - Password security
- [Network Security](./SECURITY.md#-network-security) - HTTPS and CORS
- [Rate Limiting](./SECURITY.md#-rate-limiting) - DDoS prevention
- [Session Management](./SECURITY.md#-session-management) - Secure sessions
- [Security Monitoring](./SECURITY.md#-security-monitoring) - Logging and detection
- [Incident Response](./SECURITY.md#-incident-response) - Response plan

---

## 🔍 Quick Reference

### File Locations

```
Project Root/
├── 📄 server.js              → Express server
├── 📄 data.js                → DataManager
├── 📄 index.html             → Public booking
├── 📄 admin.html             → Admin panel
├── 📄 edit.html              → Edit interface
├── 📂 js/                    → Frontend modules
├── 📂 css/                   → Stylesheets
├── 📂 data/                  → Data storage
└── 📂 docs/                  → This documentation
```

### Key Commands

```bash
# Development
npm run dev                   # Start dev server

# Production
docker-compose up -d          # Start containers
docker-compose logs -f        # View logs

# Maintenance
npm audit                     # Security check
docker-compose down && docker-compose up --build -d  # Update
```

### Important URLs

- **Public Booking**: http://localhost:3000
- **Admin Panel**: http://localhost:3000/admin.html
- **Edit Booking**: http://localhost:3000/edit.html?token=XXX
- **Health Check**: http://localhost:3000/health
- **API Base**: http://localhost:3000/api

### Default Credentials

⚠️ **Change in production!**

- Admin Password: `admin123`
- Christmas Codes: `XMAS2024`

---

## 📚 Documentation Standards

### Cross-References

All documentation files are interconnected with:

- Direct section links using anchors
- Related topics references
- Code examples with context
- Visual diagrams where helpful

### Maintenance

- Version: 1.0.0
- Last Updated: March 2024
- Review Cycle: Quarterly
- Feedback: docs@yourdomain.com

### Contributing

To update documentation:

1. Edit relevant `.md` file
2. Update cross-references
3. Verify all links work
4. Update INDEX.md if structure changes
5. Commit with clear message

---

## 🎯 Quick Tasks

### For Developers

1. Start here: [Architecture](./ARCHITECTURE.md)
2. Review: [Components](./COMPONENTS.md)
3. Deploy: [Deployment Guide](./DEPLOYMENT.md)

### For Administrators

1. Learn: [Business Rules](./BUSINESS_RULES.md)
2. Configure: [Deployment Settings](./DEPLOYMENT.md#-configuration)
3. Secure: [Security Guide](./SECURITY.md)

### For API Consumers

1. Reference: [API Documentation](./API.md)
2. Examples: [Data Structures](./API.md#data-structures)
3. Test: [API Testing](./API.md#testing)

---

## 📝 Notes

- All paths are relative to the documentation directory
- Use markdown viewers that support anchor links for best experience
- Documentation is generated but manually maintained
- Report issues or suggestions via project issue tracker
