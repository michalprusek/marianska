#!/bin/bash

# Stop script for Marianska Chata reservation system

echo "Stopping Marianska Chata Reservation System..."

# Stop nginx
~/nginx-local/nginx/sbin/nginx -s stop 2>/dev/null
echo "Nginx stopped"

# Stop Node.js server
pkill -f "node server" 2>/dev/null
echo "Node.js server stopped"

echo "All services stopped successfully"