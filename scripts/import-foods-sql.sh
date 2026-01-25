#!/bin/bash

# ============================================================
# USDA Food Import Script (SQL Method)
# Imports foods via SQL execution (bypasses PostgREST cache)
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

echo -e "${BLUE}🍎 USDA Food Import Script (SQL Method)${NC}"
echo -e "${BLUE}================================${NC}\n"

# Load environment variables
if [ ! -f "$ENV_FILE" ]; then
    echo -e "${RED}❌ Error: .env file not found at $ENV_FILE${NC}"
    exit 1
fi

# Extract credentials from .env
SUPABASE_ACCESS_TOKEN=$(grep SUPABASE_ACCESS_TOKEN "$ENV_FILE" | cut -d '=' -f2)
PROJECT_ID="clzxkdddwxnfmtmfkafh"

if [ -z "$SUPABASE_ACCESS_TOKEN" ]; then
    echo -e "${RED}❌ Error: Supabase access token not found in .env${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Loaded Supabase credentials${NC}\n"

# Check if sample-foods.json exists
SAMPLE_FILE="$SCRIPT_DIR/sample-foods.json"
if [ ! -f "$SAMPLE_FILE" ]; then
    echo -e "${RED}❌ Error: sample-foods.json not found${NC}"
    exit 1
fi

# Count foods to import
FOOD_COUNT=$(jq 'length' "$SAMPLE_FILE")
echo -e "${BLUE}📊 Found ${FOOD_COUNT} foods to import${NC}\n"

# Import each food using SQL
SUCCESS_COUNT=0
FAIL_COUNT=0

echo -e "${YELLOW}⏳ Importing foods via SQL...${NC}\n"

# Read JSON array and process each food
jq -c '.[]' "$SAMPLE_FILE" | while read food; do
    name=$(echo "$food" | jq -r '.name')
    echo -e "${BLUE}Importing: ${name}${NC}"

    # Extract all fields
    name_aliases=$(echo "$food" | jq -c '.name_aliases')
    category=$(echo "$food" | jq -r '.category')
    serving_amount=$(echo "$food" | jq -r '.serving_amount')
    serving_unit=$(echo "$food" | jq -r '.serving_unit')
    calories=$(echo "$food" | jq -r '.calories')
    protein=$(echo "$food" | jq -r '.protein')
    carbs=$(echo "$food" | jq -r '.carbs')
    fats=$(echo "$food" | jq -r '.fats')
    fiber=$(echo "$food" | jq -r '.fiber // 0')
    sugar=$(echo "$food" | jq -r '.sugar // 0')
    sodium=$(echo "$food" | jq -r '.sodium // 0')
    cholesterol=$(echo "$food" | jq -r '.cholesterol // 0')
    allergens=$(echo "$food" | jq -c '.allergens // []')
    dietary_tags=$(echo "$food" | jq -c '.dietary_tags // []')
    source=$(echo "$food" | jq -r '.source')
    verified=$(echo "$food" | jq -r '.verified')

    # Get optional micronutrients
    vitamin_a=$(echo "$food" | jq -r '.vitamin_a // "NULL"')
    vitamin_c=$(echo "$food" | jq -r '.vitamin_c // "NULL"')
    vitamin_d=$(echo "$food" | jq -r '.vitamin_d // "NULL"')
    calcium=$(echo "$food" | jq -r '.calcium // "NULL"')
    iron=$(echo "$food" | jq -r '.iron // "NULL"')
    potassium=$(echo "$food" | jq -r '.potassium // "NULL"')
    vitamin_b6=$(echo "$food" | jq -r '.vitamin_b6 // "NULL"')
    folate=$(echo "$food" | jq -r '.folate // "NULL"')
    magnesium=$(echo "$food" | jq -r '.magnesium // "NULL"')
    phosphorus=$(echo "$food" | jq -r '.phosphorus // "NULL"')
    vitamin_k=$(echo "$food" | jq -r '.vitamin_k // "NULL"')
    vitamin_b12=$(echo "$food" | jq -r '.vitamin_b12 // "NULL"')
    selenium=$(echo "$food" | jq -r '.selenium // "NULL"')
    vitamin_e=$(echo "$food" | jq -r '.vitamin_e // "NULL"')
    glycemic_index=$(echo "$food" | jq -r '.glycemic_index // "NULL"')

    # Build SQL INSERT statement
    sql="INSERT INTO foods (name, name_aliases, category, serving_amount, serving_unit, calories, protein, carbs, fats, fiber, sugar, sodium, cholesterol, vitamin_a, vitamin_c, vitamin_d, calcium, iron, potassium, vitamin_b6, folate, magnesium, phosphorus, vitamin_k, vitamin_b12, selenium, vitamin_e, glycemic_index, allergens, dietary_tags, source, verified) VALUES ('${name}', '${name_aliases}'::text[], '${category}', ${serving_amount}, '${serving_unit}', ${calories}, ${protein}, ${carbs}, ${fats}, ${fiber}, ${sugar}, ${sodium}, ${cholesterol}, ${vitamin_a}, ${vitamin_c}, ${vitamin_d}, ${calcium}, ${iron}, ${potassium}, ${vitamin_b6}, ${folate}, ${magnesium}, ${phosphorus}, ${vitamin_k}, ${vitamin_b12}, ${selenium}, ${vitamin_e}, ${glycemic_index}, '${allergens}'::text[], '${dietary_tags}'::text[], '${source}', ${verified});"

    # Execute SQL via Management API
    response=$(curl -s -X POST \
        "https://api.supabase.com/v1/projects/${PROJECT_ID}/database/query" \
        -H "Authorization: Bearer ${SUPABASE_ACCESS_TOKEN}" \
        -H "Content-Type: application/json" \
        -d "{\"query\": \"$sql\"}")

    # Check if successful
    if echo "$response" | jq -e '.result' > /dev/null 2>&1; then
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
echo -e "   2. Wait 60 seconds for PostgREST cache to refresh"
echo -e "   3. Test food search in your nutrition dashboard\n"
