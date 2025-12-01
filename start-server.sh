#!/bin/bash

# ETH Wallet MS - Local Development Server Startup Script

echo "=========================================="
echo "ETH Wallet MS - Starting Development Server"
echo "=========================================="
echo ""

# Check if PHP is installed
if ! command -v php &> /dev/null; then
    echo "❌ PHP is not installed. Please install PHP first."
    echo "   Run: brew install php"
    exit 1
fi

# Check if MySQL is running
if ! brew services list | grep -q "mysql.*started"; then
    echo "⚠️  MySQL is not running. Starting MySQL..."
    brew services start mysql
    sleep 3
fi

# Get the project directory
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

# Check if bwapi folder exists
if [ ! -d "bwapi" ]; then
    echo "❌ bwapi folder not found. Please ensure the project is set up correctly."
    exit 1
fi

echo "✅ PHP version: $(php -v | head -n 1)"
echo "✅ Project directory: $PROJECT_DIR"
echo ""
echo "Starting PHP development server..."
echo "Frontend will be available at: http://localhost:8000"
echo "API will be available at: http://localhost:8000/bwapi/"
echo ""
echo "Press Ctrl+C to stop the server"
echo "=========================================="
echo ""

# Start PHP built-in server
php -S localhost:8000

