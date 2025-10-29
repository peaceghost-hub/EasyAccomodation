#!/bin/bash

echo "🔐 Testing Authentication Flow..."
echo ""

# Login
echo "Step 1: Logging in..."
RESPONSE=$(curl -s -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "magomobenam765@gmail.com",
    "password": "B44m55peace"
  }')

echo "Login Response:"
echo "$RESPONSE" | python3 -m json.tool

# Extract token
TOKEN=$(echo "$RESPONSE" | python3 -c "import sys,json;print(json.load(sys.stdin).get('access_token',''))")

if [ -z "$TOKEN" ]; then
  echo "4 Failed to get token! Response was:"
  echo "$RESPONSE" | python3 -m json.tool || echo "$RESPONSE"
  exit 1
fi

echo ""
echo "✅ Token obtained: ${TOKEN:0:50}..."
echo ""

# Test profile
echo "Step 2: Testing /api/auth/profile..."
PROFILE_RESPONSE=$(curl -s -X GET http://localhost:5000/api/auth/profile \
  -H "Authorization: Bearer $TOKEN")

echo "Profile Response:"
echo "$PROFILE_RESPONSE" | python3 -m json.tool

echo ""

# Test admin endpoint
echo "Step 3: Testing /api/admin/residential-areas..."
ADMIN_RESPONSE=$(curl -s -X POST http://localhost:5000/api/admin/residential-areas \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Avondale",
    "description": "Prime residential area",
    "latitude": -17.8252,
    "longitude": 31.0335
  }')

echo "Admin Response:"
echo "$ADMIN_RESPONSE" | python3 -m json.tool

echo ""
echo "✅ Test complete!"
