#!/bin/bash
# 🚀 Quick Deploy Script for TaxCore on Vercel
# Run this script to prepare your project for Vercel deployment

echo "🎯 TaxCore - Vercel Deployment Preparation"
echo "=========================================="
echo ""

# Step 1: Check if we're in the right directory
if [ ! -d "/app/src/frontend" ]; then
    echo "❌ Error: Frontend directory not found!"
    exit 1
fi

echo "✅ Step 1: Project structure verified"
echo ""

# Step 2: Navigate to frontend
cd /app/src/frontend

# Step 3: Install dependencies (if needed)
echo "📦 Step 2: Checking dependencies..."
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    yarn install
else
    echo "✅ Dependencies already installed"
fi
echo ""

# Step 4: Build the project to test
echo "🔨 Step 3: Testing build..."
yarn build
if [ $? -eq 0 ]; then
    echo "✅ Build successful!"
else
    echo "❌ Build failed. Please fix errors before deploying."
    exit 1
fi
echo ""

# Step 5: Create vercel.json configuration
echo "⚙️  Step 4: Creating Vercel configuration..."
cat > /app/vercel.json << 'EOF'
{
  "version": 2,
  "name": "taxcore",
  "buildCommand": "cd src/frontend && yarn build",
  "outputDirectory": "src/frontend/dist",
  "devCommand": "cd src/frontend && yarn dev",
  "framework": "vite",
  "regions": ["sin1"],
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ],
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        },
        {
          "key": "X-Frame-Options",
          "value": "DENY"
        },
        {
          "key": "X-XSS-Protection",
          "value": "1; mode=block"
        }
      ]
    }
  ]
}
EOF
echo "✅ Vercel configuration created"
echo ""

# Step 6: Create .vercelignore
echo "📝 Step 5: Creating .vercelignore..."
cat > /app/.vercelignore << 'EOF'
node_modules
.git
.env.local
.env.*.local
*.log
.DS_Store
src/backend
EOF
echo "✅ .vercelignore created"
echo ""

# Step 7: Instructions
echo "🎉 Preparation Complete!"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 NEXT STEPS TO DEPLOY ON VERCEL (FREE):"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "1️⃣  Push to GitHub (if not already):"
echo "    git add ."
echo "    git commit -m 'Ready for Vercel deployment'"
echo "    git push origin main"
echo ""
echo "2️⃣  Deploy to Vercel:"
echo "    • Visit: https://vercel.com/new"
echo "    • Sign in with GitHub (free account)"
echo "    • Click 'Import Git Repository'"
echo "    • Select your TaxCore repository"
echo "    • Click 'Deploy' (auto-detects settings)"
echo ""
echo "3️⃣  Your app will be live in 2 minutes at:"
echo "    https://taxcore-[random].vercel.app"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "💡 ALTERNATIVE: Deploy via Vercel CLI"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Install Vercel CLI:"
echo "    npm i -g vercel"
echo ""
echo "Deploy with one command:"
echo "    cd /app && vercel"
echo ""
echo "Follow prompts and your app deploys instantly!"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✨ Your app is ready for FREE, TRUSTED hosting!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
