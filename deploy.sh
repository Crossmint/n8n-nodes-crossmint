#!/bin/bash

# Crossmint n8n Node Deployment Script
# This script builds, links, and starts n8n with the Crossmint node

set -e  # Exit on any error

echo "🔨 Building and linking n8n-nodes-crossmint..."

# Step 1: Build and link the node package (current directory)
echo "Building package..."
npm run build

echo "Linking package..."
npm link

# Step 2: Link the package in n8n custom directory
echo "🔗 Linking in n8n custom directory..."
cd ~/.n8n/custom
npm link n8n-nodes-crossmint

# Step 3: Go back to project directory and start n8n
echo "🚀 Starting n8n..."
cd - > /dev/null
n8n start