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

# Expose the port your app runs on
EXPOSE 3000

# Start the application
CMD ["yarn", "start"]
