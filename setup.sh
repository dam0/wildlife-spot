#!/bin/bash

# Start SpacetimeDB server in the background
echo "Starting SpacetimeDB server..."
spacetime start &
SPACETIME_PID=$!

# Wait for server to start
sleep 5

# Publish the Rust module
echo "Publishing Rust module..."
cd whale-spotting
spacetime publish --project-path .
cd ..

# Start the frontend
echo "Starting frontend development server..."
cd whale-spotting-ui
npm run dev

# Clean up
trap "kill $SPACETIME_PID" EXIT
