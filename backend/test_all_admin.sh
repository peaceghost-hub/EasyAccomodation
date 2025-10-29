#!/bin/bash

echo "🔐 Logging in as admin..."
RESPONSE=$(curl -s -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "magomobenam765@gmail.com", "password": "B44m55peace"}')

# Extract access token robustly using python JSON parsing
TOKEN=$(echo "$RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin).get('access_token',''))")
if [ -z "$TOKEN" ]; then
  echo "6A8 Failed to obtain access token! Response was:"
  echo "$RESPONSE" | python3 -m json.tool || echo "$RESPONSE"
  exit 1
fi

echo " Logged in! Token: ${TOKEN:0:50}..."
echo ""

echo "📍 Adding Avondale residential area..."
curl -s -X POST http://localhost:5000/api/admin/residential-areas \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"name": "Avondale", "description": "Prime area", "latitude": -17.8252, "longitude": 31.0335}' \
  | python3 -m json.tool
echo ""

echo "🏠 Adding a house..."
curl -s -X POST http://localhost:5000/api/admin/houses \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "house_number": "12A",
    "street_address": "King George Road",
    "residential_area_id": 1,
    "latitude": -17.8252,
    "longitude": 31.0335,
    "rooms": [
      {"room_number": "1", "capacity": 2, "price_per_month": 150},
      {"room_number": "2", "capacity": 1, "price_per_month": 100}
    ]
  }' | python3 -m json.tool
echo ""

echo "📊 Getting system stats..."
curl -s -X GET http://localhost:5000/api/admin/stats \
  -H "Authorization: Bearer $TOKEN" \
  | python3 -m json.tool

echo ""
echo "✅ All tests complete!"
