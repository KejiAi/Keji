# Keji AI Backend Logging Guide

## Overview

Comprehensive logging has been implemented across the Keji AI backend to facilitate debugging, monitoring, and understanding the application flow.

## Logging Levels Used

- **INFO**: Major events, milestones, and successful operations
- **DEBUG**: Detailed information for debugging (database queries, intermediate steps)
- **WARNING**: Unexpected but handled situations
- **ERROR**: Error conditions that need attention

## Log Format

```
%(asctime)s - %(name)s - %(levelname)s - %(message)s
```

Example: `2025-01-15 14:30:45,123 - get_response - INFO - 🚀 HANDLING USER INPUT`

## Visual Separators

To make logs easy to scan, we use:

- **Blue bars** (🔵) for Chat endpoint requests
- **Green bars** (🟢) for Accept recommendation requests
- **Yellow bars** (🟡) for History requests
- **Equal signs** (=) for major function calls
- **Dashes** (-) for helper function calls
- **Emojis** for quick visual identification

## Key Logging Points

### 1. `get_response.py`

#### Module Initialization

```
🚀 Keji AI Response Module Initialized
```

#### `handle_user_input()`

```
🟢 HANDLING USER INPUT
📥 Input: [user message]
👤 User: [username]
🎯 Intent Classification
💰 Processing BUDGET intent / 🥘 Processing INGREDIENT intent / 💬 Processing CHAT intent
✅ Response generated
```

#### `call_llm()`

```
🤖 Calling Keji AI LLM...
📄 Loading prompt from: [path]
👤 User name provided: [name]
📦 Additional context provided: [keys]
🔄 Sending request to OpenAI API...
✅ Successfully parsed JSON response
📌 Recommendation title: [title]
💊 Health benefits: [count] items
```

#### `classify_intent()`

```
🎯 Starting Intent Classification
🔍 Classifying user intent...
✅ Intent: BUDGET (₦500) / INGREDIENT (rice, beans) / CHAT
```

#### `get_foods_by_budget()`

```
💰 Searching foods within budget: ₦[amount]
📊 Total foods in database: [count]
✅ Found [count] foods within ₦[amount] budget
```

#### `get_meals_by_ingredients()`

```
🥘 Searching meals with ingredients: [list]
📊 Total foods in database: [count]
✅ Found [count] meals matching ingredients
```

### 2. `chat.py`

#### `/chat` Endpoint

```
🔵 NEW CHAT REQUEST
👤 User: [name] (ID: [id])
📝 Message: [message]
🔍 Finding or creating conversation...
✅ Created new conversation (ID: [id]) / Using existing conversation
💾 Saving user message to database...
📚 Gathering conversation history...
✅ Loaded [count] messages from history
🤖 Calling Keji AI...
✅ Received response from Keji AI
📌 Response type: RECOMMENDATION / 💬 Response type: CHAT
✅ Chat completed successfully
```

#### `/accept_recommendation` Endpoint

```
🟢 ACCEPT RECOMMENDATION REQUEST
👤 User: [name] (ID: [id])
📌 Recommendation: [title]
🔍 Finding latest conversation...
💾 Saving recommendation to database...
✅ Recommendation saved successfully
```

#### `/chat/history` Endpoint

```
🟡 CHAT HISTORY REQUEST
👤 User: [name] (ID: [id])
🔍 Finding latest conversation...
📚 Retrieving messages...
✅ Retrieved [count] messages
   User messages: [count]
   Bot messages: [count]
```

## Test Mode

Run the test mode to verify the entire system:

```bash
cd keji_backend
python get_response.py
```

This will execute 5 test cases:

1. Budget query with small amount
2. Budget query with Nigerian slang
3. Ingredient query
4. General chat greeting
5. Health-related query

Each test case logs the full flow from input to output.

## Reading the Logs

### Example Log Flow for Budget Query

```
🟢 🟢 🟢 [repeated]
🚀 HANDLING USER INPUT
🟢 🟢 🟢 [repeated]
📥 Input: I have 500 naira
👤 User: Tunde

============================================================
🎯 Starting Intent Classification
============================================================
🔍 Classifying user intent...
✅ Classification result: {"budget": 500}
✅ Intent: BUDGET (₦500)
============================================================

💰 Processing BUDGET intent: ₦500

------------------------------------------------------------
💰 Searching foods within budget: ₦500
------------------------------------------------------------
📊 Total foods in database: 150
✅ Found 12 foods within ₦500 budget
   Sample foods: ['Rice (1 cup)', 'Beans (1 cup)', 'Garri (1 derica)']
------------------------------------------------------------

✅ 12 foods available for ₦500

============================================================
🤖 Calling Keji AI LLM...
============================================================
📄 Loading prompt from: keji_prompt.txt
✅ Prompt loaded: 8542 characters
👤 User name provided: Tunde
📦 Additional context provided: ['budget', 'available_foods', 'note']
🔄 Sending request to OpenAI API...
📨 Raw LLM response: {"type":"recommendation",...}
✅ Successfully parsed JSON response
   Response type: recommendation
   📌 Recommendation title: Rice and Beans Combo
   💊 Health benefits: 3 items
============================================================

✅ Food recommendations generated
```

## Best Practices

1. **Use emojis consistently** for visual scanning
2. **Add newlines** between major sections for readability
3. **Log both success and failure paths**
4. **Include relevant data** (IDs, counts, snippets)
5. **Use appropriate log levels** (INFO for milestones, DEBUG for details)
6. **Truncate long strings** to avoid log bloat

## Troubleshooting

### Common Issues

1. **No logs appearing**: Check logging level is set to DEBUG in production
2. **Too many logs**: Adjust level to INFO or WARNING
3. **Logs hard to read**: Ensure console supports emoji and ANSI colors

### Filtering Logs

```bash
# Show only errors
python app.py 2>&1 | grep ERROR

# Show only Keji AI calls
python app.py 2>&1 | grep "🤖"

# Show only user inputs
python app.py 2>&1 | grep "📥"
```

## Future Enhancements

- Add request timing metrics
- Implement structured logging (JSON format)
- Add log rotation for production
- Create dashboard for log visualization
- Add performance profiling logs
