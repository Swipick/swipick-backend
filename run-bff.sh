#!/bin/bash
# Script to run BFF service from correct working directory

# Build the service
cd apps/backend/bff
npx nest build

# Go back to root and run the service
cd ../../..
node apps/backend/bff/dist/main.js
