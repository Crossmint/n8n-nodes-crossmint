#!/bin/bash

echo "🔨 Building n8n-nodes-crossmint..."
npm run build

if [ $? -eq 0 ]; then
    echo "✅ Build successful!"
    echo "📦 Installing package to n8n..."
    cd ~/.n8n
    npm install "file:$(pwd | sed 's|/.n8n||')/Documents/Crossmint/npm-n8n-nodes-crossmint/n8n-nodes-crossmint"
    
    if [ $? -eq 0 ]; then
        echo "🚀 Starting n8n..."
        NODE_NO_WARNINGS=1 npx n8n start
    else
        echo "❌ Package installation failed!"
        exit 1
    fi
else
    echo "❌ Build failed!"
    exit 1
fi