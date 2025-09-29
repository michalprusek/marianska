# Code Style & Conventions

## JavaScript Conventions

- **ES6+ syntax** with modern JavaScript features
- **Camelcase naming** for variables and functions
- **Async/await** preferred over promises
- **Template literals** for string interpolation
- **Arrow functions** where appropriate

## Code Organization

- **Modular structure** with separate files for different concerns
- **Class-based** approach for main components (DatabaseManager, etc.)
- **Utility functions** separated into utils.js
- **Shared components** in js/shared/ directory

## Database Conventions

- **Snake_case** for database column names (start_date, end_date, guest_type)
- **Text-based dates** in YYYY-MM-DD format
- **Foreign key relationships** with CASCADE deletions
- **Prepared statements** for all database operations

## Frontend Structure

- **SPA architecture** with client-side routing
- **Event-driven** component communication
- **LocalStorage fallback** for offline capability
- **Responsive design** with mobile-first approach

## Security Patterns

- **Input validation** on both client and server
- **Prepared statements** to prevent SQL injection
- **Rate limiting** for API endpoints
- **Helmet.js** for security headers
- **bcrypt** for password hashing

## File Naming

- **Kebab-case** for HTML files (admin.html, edit.html)
- **Camelcase** for JavaScript files (bookingForm.js, dataManager.js)
- **Lowercase** for directories (js, css, data)
