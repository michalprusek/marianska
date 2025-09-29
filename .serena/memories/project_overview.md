# Project Overview - Mariánska Chata Reservation System

## Purpose

Rezervační systém Chata Mariánská - Mountain cabin reservation system with 9 rooms designed for ÚTIA employees and external guests. SPA implementation with Node.js/Express backend and SQLite database with LocalStorage fallback for offline mode.

## Tech Stack

- **Backend**: Node.js with Express.js
- **Database**: SQLite with better-sqlite3 (migrated from JSON storage)
- **Frontend**: Vanilla JavaScript SPA
- **Security**: bcrypt for password hashing, helmet for security headers, rate limiting
- **Development**: ESLint, Prettier, Husky for git hooks, nodemon for development

## Key Features

- Room booking system with calendar interface
- Admin management panel
- Christmas period restrictions with access codes
- Blocked dates management
- Price calculation for ÚTIA employees vs external guests
- Offline fallback with LocalStorage
- Docker deployment support

## Architecture

- **SQLite Database** with tables: bookings, booking_rooms, blocked_dates, settings, rooms, christmas_codes
- **Modular frontend** with separate JS files for different functionalities
- **Dual storage mode** - server-side SQLite with LocalStorage fallback
- **Security-first approach** with input validation and protection mechanisms
