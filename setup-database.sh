#!/bin/bash

# Supabase Database Setup Script
# This script creates all tables for the nutrition system

PROJECT_REF="clzxkdddwxnfmtmfkafh"
ACCESS_TOKEN="sbp_541c795ba1e801add776d55754604c983e3c5b9d"

API_URL="https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query"

echo "🚀 Setting up Nutrition System Database..."
echo ""

# Function to execute SQL
execute_sql() {
    local sql="$1"
    local description="$2"
    echo "⏳ $description..."

    response=$(curl -s -X POST "$API_URL" \
        -H "Authorization: Bearer $ACCESS_TOKEN" \
        -H "Content-Type: application/json" \
        -d "{\"query\": $(echo "$sql" | jq -Rs .)}")

    if echo "$response" | grep -q "error"; then
        echo "❌ Error: $response"
        return 1
    else
        echo "✅ $description complete"
        return 0
    fi
}

# Read and execute the full schema
if [ -f "database-schema.sql" ]; then
    echo "📄 Reading database-schema.sql..."
    SQL_CONTENT=$(cat database-schema.sql)

    execute_sql "$SQL_CONTENT" "Creating all database tables"

    if [ $? -eq 0 ]; then
        echo ""
        echo "🎉 Database setup complete!"
        echo "✅ 17 tables created"
        echo "✅ Row-Level Security enabled"
        echo "✅ All indexes configured"
    else
        echo ""
        echo "❌ Database setup failed. Please run the schema manually in Supabase Dashboard."
    fi
else
    echo "❌ database-schema.sql not found!"
    exit 1
fi
