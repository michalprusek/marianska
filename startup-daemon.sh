#!/bin/bash

# Daemon startup script for Marianska Chata reservation system

# Kill any existing processes
pkill -f "node server" 2>/dev/null
~/nginx-local/nginx/sbin/nginx -s stop 2>/dev/null

sleep 2

# Start Node.js server in background
cd /home/marianska/marianska
nohup npm start > /home/marianska/marianska/logs/node.log 2>&1 &

# Wait for Node.js to start
sleep 3

# Start nginx proxy
~/nginx-local/nginx/sbin/nginx -c ~/nginx-local/nginx/conf/nginx.conf

exit 0