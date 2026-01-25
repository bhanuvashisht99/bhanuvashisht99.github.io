#!/bin/bash

# ============================================================
# USDA Food Import Script
# Imports foods from sample data into Supabase
# ============================================================

set -e  # Exit on error

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$PROJECT_DIR/.env"

echo -e "${BLUE}🍎 USDA Food Import Script${NC}"
echo -e "${BLUE}================================${NC}\n"

# Load environment variables
if [ ! -f "$ENV_FILE" ]; then
    echo -e "${RED}❌ Error: .env file not found at $ENV_FILE${NC}"
    exit 1
fi

# Extract Supabase credentials from .env
SUPABASE_URL=$(grep NEXT_PUBLIC_SUPABASE_URL "$ENV_FILE" | cut -d '=' -f2)
SUPABASE_KEY=$(grep SUPABASE_SERVICE_ROLE_KEY "$ENV_FILE" | cut -d '=' -f2)

if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_KEY" ]; then
    echo -e "${RED}❌ Error: Supabase credentials not found in .env${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Loaded Supabase credentials${NC}"
echo -e "${BLUE}📍 Project URL: ${SUPABASE_URL}${NC}\n"

# Check if sample-foods.json exists
SAMPLE_FILE="$SCRIPT_DIR/sample-foods.json"
if [ ! -f "$SAMPLE_FILE" ]; then
    echo -e "${RED}❌ Error: sample-foods.json not found${NC}"
    exit 1
fi

# Count foods to import
FOOD_COUNT=$(jq 'length' "$SAMPLE_FILE")
echo -e "${BLUE}📊 Found ${FOOD_COUNT} foods to import${NC}\n"

# Import each food
SUCCESS_COUNT=0
FAIL_COUNT=0

echo -e "${YELLOW}⏳ Importing foods...${NC}\n"

# Read JSON array and process each food
jq -c '.[]' "$SAMPLE_FILE" | while read food; do
    name=$(echo "$food" | jq -r '.name')
    echo -e "${BLUE}Importing: ${name}${NC}"

    # Insert into Supabase
    response=$(curl -s -X POST \
        "${SUPABASE_URL}/rest/v1/foods" \
        -H "apikey: ${SUPABASE_KEY}" \
        -H "Authorization: Bearer ${SUPABASE_KEY}" \
        -H "Content-Type: application/json" \
        -H "Prefer: return=representation" \
        -d "$food")

    # Check if successful (response contains an id)
    if echo "$response" | jq -e '.[0].id' > /dev/null 2>&1; then
        echo -e "${GREEN}  ✅ Imported successfully${NC}\n"
        SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
    else
        echo -e "${RED}  ❌ Failed: $response${NC}\n"
        FAIL_COUNT=$((FAIL_COUNT + 1))
    fi
done

# Summary
echo -e "\n${BLUE}================================${NC}"
echo -e "${GREEN}✅ Import Complete!${NC}"
echo -e "${BLUE}📊 Summary:${NC}"
echo -e "   ${GREEN}✅ Successful: ${SUCCESS_COUNT}${NC}"
echo -e "   ${RED}❌ Failed: ${FAIL_COUNT}${NC}"
echo -e "${BLUE}================================${NC}\n"

echo -e "${YELLOW}💡 Next steps:${NC}"
echo -e "   1. Visit your Supabase dashboard to verify data"
echo -e "   2. Test food search in your nutrition dashboard"
echo -e "   3. Continue with food logging implementation\n"
