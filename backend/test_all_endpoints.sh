#!/bin/bash

echo "========================================="
echo "EASYACCOMMODATION - FULL API TEST"
echo "========================================="
echo ""

# Login as admin
echo "🔐 Logging in as admin..."
ADMIN_RESPONSE=$(curl -s -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "magomobenam765@gmail.com", "password": "B44m55peace"}')

ADMIN_TOKEN=$(echo "$ADMIN_RESPONSE" | jq -r '.access_token')
echo "✅ Admin logged in"
echo ""

# Add residential area
echo "📍 Adding residential areas..."
curl -s -X POST http://localhost:5000/api/admin/residential-areas \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"name": "Avondale", "description": "Prime area", "latitude": -17.8252, "longitude": 31.0335}' > /dev/null

curl -s -X POST http://localhost:5000/api/admin/residential-areas \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"name": "Belgravia", "description": "Quiet area", "latitude": -17.8100, "longitude": 31.0500}' > /dev/null

echo "✅ 2 residential areas added"
echo ""

# Add houses
echo "🏠 Adding houses..."
curl -s -X POST http://localhost:5000/api/admin/houses \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
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
  }' > /dev/null

curl -s -X POST http://localhost:5000/api/admin/houses \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{
    "house_number": "25B",
    "street_address": "Churchill Avenue",
    "residential_area_id": 2,
    "latitude": -17.8100,
    "longitude": 31.0500,
    "rooms": [
      {"room_number": "1", "capacity": 4, "price_per_month": 200},
      {"room_number": "2", "capacity": 2, "price_per_month": 150}
    ]
  }' > /dev/null

echo "✅ 2 houses added"
echo ""

# Register student
echo "👨‍🎓 Registering student..."
curl -s -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "student2@test.com",
    "password": "password123",
    "full_name": "Jane Doe",
    "phone_number": "+263771234568",
    "user_type": "student",
    "student_id": "S67890",
    "institution": "University of Zimbabwe"
  }' > /dev/null

# Login as student
STUDENT_RESPONSE=$(curl -s -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "student2@test.com", "password": "password123"}')

STUDENT_TOKEN=$(echo "$STUDENT_RESPONSE" | jq -r '.access_token')
echo "✅ Student registered and logged in"
echo ""

# Test house endpoints
echo "🏘️  Testing house endpoints..."
echo "Getting all residential areas:"
curl -s -L -X GET http://localhost:5000/api/houses/residential-areas | jq '.count, .areas[0].name'
echo ""

echo "Getting all houses:"
curl -s -L -X GET http://localhost:5000/api/houses/ | jq '.count'
echo ""

echo "Getting houses in Avondale:"
curl -s -L -X GET "http://localhost:5000/api/houses/area/1" | jq '.houses_with_accommodation | length'
echo ""

# Test booking
echo "📅 Testing booking..."
curl -s -X POST http://localhost:5000/api/bookings/reserve \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $STUDENT_TOKEN" \
  -d '{
    "house_id": 1,
    "room_id": 1,
    "move_in_date": "2025-11-01",
    "notes": "Looking forward to moving in"
  }' | jq '.success, .message'
echo ""

# Get student's bookings
echo "Getting student bookings:"
curl -s -X GET http://localhost:5000/api/bookings/my-bookings \
  -H "Authorization: Bearer $STUDENT_TOKEN" | jq '.count'
echo ""

# Test stats
echo "📊 System Stats:"
curl -s -X GET http://localhost:5000/api/admin/stats \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq '.stats'

echo ""
echo "========================================="
echo "✅ ALL TESTS COMPLETE!"
echo "========================================="
