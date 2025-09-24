#!/bin/bash

# Kill any existing node processes
pkill -f "node server.js" 2>/dev/null

# Start the Node.js server on port 8080 (non-privileged port)
PORT=8080 npm start &

# Create a simple proxy script using socat if available
which socat > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "Starting socat proxy from port 80 to 8080..."
    sudo socat TCP-LISTEN:80,fork,reuseaddr TCP:localhost:8080 &
else
    echo "Server running on port 8080"
    echo "Access at http://chata.utia.cas.cz:8080"
fi

wait