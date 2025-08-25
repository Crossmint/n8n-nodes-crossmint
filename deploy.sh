#!/bin/bash

echo "🔨 Building and linking n8n-nodes-crossmint..."
npm run build && npm link

if [ $? -eq 0 ]; then
    echo "✅ Build and link successful!"
    echo "🚀 Starting n8n with linked package..."
    cd ~/.n8n/custom
    npm link n8n-nodes-crossmint && npx n8n start
else
    echo "❌ Build or link failed!"
    exit 1
fi