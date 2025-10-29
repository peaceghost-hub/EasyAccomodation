#!/bin/bash

# EasyAccommodation - Quick Deployment Script
# This script helps you prepare your app for deployment

echo "🚀 EasyAccommodation Deployment Preparation"
echo "==========================================="
echo ""

# Check if git is initialized
if [ ! -d .git ]; then
    echo "📦 Initializing Git repository..."
    git init
    echo "✅ Git initialized"
else
    echo "✅ Git already initialized"
fi

# Check if .gitkeep exists
if [ ! -f backend/static/house_images/.gitkeep ]; then
    echo "📁 Creating .gitkeep for static directory..."
    mkdir -p backend/static/house_images
    touch backend/static/house_images/.gitkeep
    echo "✅ .gitkeep created"
else
    echo "✅ .gitkeep already exists"
fi

echo ""
echo "📝 Next Steps:"
echo "1. Create a GitHub repository at: https://github.com/new"
echo "2. Run these commands:"
echo ""
echo "   git add ."
echo "   git commit -m 'Initial commit for deployment'"
echo "   git remote add origin https://github.com/YOUR_USERNAME/EasyAccommodation.git"
echo "   git branch -M main"
echo "   git push -u origin main"
echo ""
echo "3. Follow the DEPLOYMENT_GUIDE.md for detailed instructions"
echo ""
echo "🎉 Repository is ready for deployment!"
