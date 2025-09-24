#!/bin/bash

# Startup script for Marianska Chata reservation system
# This script starts both Node.js server and nginx proxy

echo "Starting Marianska Chata Reservation System..."

# Kill any existing processes
pkill -f "node server" 2>/dev/null
~/nginx-local/nginx/sbin/nginx -s stop 2>/dev/null

echo "Cleaning up old processes..."
sleep 2

# Start Node.js server in background
echo "Starting Node.js server on port 3000..."
cd /home/marianska/marianska
npm start &
NODE_PID=$!

# Wait for Node.js to start
sleep 3

# Start nginx proxy
echo "Starting nginx proxy on port 8080..."
~/nginx-local/nginx/sbin/nginx -c ~/nginx-local/nginx/conf/nginx.conf

echo "========================================="
echo "Application is running!"
echo "Local access: http://localhost:8080"
echo "External access: http://chata.utia.cas.cz:8080"
echo "========================================="
echo ""
echo "To stop the application, run: ./stop.sh"
echo ""

# Keep the script running
wait $NODE_PID