FROM node:18-bullseye

# Install system dependencies and build tools required for node-gyp and gl package
RUN apt-get update && apt-get install -y \
    # Build tools for node-gyp
    build-essential \
    python3 \
    python3-pip \
    python3-dev \
    make \
    g++ \
    # X11 and OpenGL libraries for gl package
    libxi-dev \
    libx11-dev \
    libxext-dev \
    libglu1-mesa-dev \
    libxss1 \
    libgconf-2-4 \
    # Virtual display for headless OpenGL
    xvfb \
    mesa-utils \
    # Additional dependencies
    pkg-config \
    ffmpeg \
    # Clean up
    && rm -rf /var/lib/apt/lists/*

# Create symlink for python (required by some build scripts)
RUN ln -s /usr/bin/python3 /usr/bin/python

# Set environment variables for node-gyp and headless gl
ENV DISPLAY=:99
ENV PYTHON=/usr/bin/python3

WORKDIR /app

# Copy package files first for better Docker layer caching
COPY package*.json ./
COPY yarn.lock* ./

# Install dependencies with verbose logging to see any issues
RUN yarn install --verbose

# Copy the rest of the application
COPY . .

# Create a startup script that sets up Xvfb and runs the app
RUN echo '#!/bin/bash\n\
# Start Xvfb in the background\n\
Xvfb :99 -screen 0 1024x768x24 > /dev/null 2>&1 &\n\
# Wait a moment for Xvfb to start\n\
sleep 2\n\
# Start the application\n\
exec yarn start\n\
' > /app/start.sh && chmod +x /app/start.sh

# Expose the port your app runs on
EXPOSE 3000

# Use the startup script
CMD ["/app/start.sh"]
