# Conversation Context Management System

## Overview

This enhanced chat system implements intelligent conversation history management with automatic summarization, token-aware context filtering, and persistent memory storage. The system ensures efficient token usage when calling OpenAI APIs while maintaining full conversation history for frontend display.

## Key Features

### 1. **Full Conversation Persistence**

- All user and assistant messages are stored permanently in the database
- Frontend always receives complete conversation history for display
- No messages are deleted from storage

### 2. **Intelligent Memory Summarization**

- Older messages are automatically summarized when token limits approach
- Summaries are generated using OpenAI's GPT-4o-mini for cost efficiency
- Summaries capture key context: user preferences, dietary needs, budgets, and conversation flow

### 3. **Token-Aware Context Management**

- Monitors total token count (history + summary + new message)
- Automatically triggers summarization when threshold is exceeded (default: 3000 tokens)
- Prevents token overflow and API errors

### 4. **Smart Message Filtering for OpenAI**

When calling OpenAI, the system sends:

- System instruction (Keji's personality prompt)
- Memory summary (if exists) - compressed context from older messages
- Recent N message turns (default: 10 messages = last 5 user/bot exchanges)
- Current new user message

### 5. **Transparent Frontend Experience**

- Frontend continues to display all historical messages
- Users see the complete conversation without gaps
- Summarization happens transparently in the background

## Architecture

### Database Schema Updates

**Conversation Model** (`models.py`):

```python
class Conversation(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.now())
    memory_summary = db.Column(db.Text, nullable=True)  # Compressed summary
    pruned_count = db.Column(db.Integer, default=0)     # Messages summarized
    last_summary_at = db.Column(db.DateTime, nullable=True)  # Last summary time
    messages = db.relationship("Message", backref="conversation", lazy=True)
```

### Core Components

#### 1. **Context Manager** (`context_manager.py`)

**Token Counting:**

- Uses `tiktoken` library for accurate token counting
- Accounts for message structure overhead
- Model-specific tokenization (GPT-4 encoding)

**Summarization Logic:**

- Triggered when: `history_tokens + summary_tokens + new_message_tokens > THRESHOLD`
- Generates concise summaries (under 150-200 words)
- Builds upon existing summaries incrementally
- Uses low-temperature (0.3) for consistency

**Message Filtering:**

- Separates storage (full history) from API calls (filtered context)
- Includes memory summary as system context
- Keeps only recent N messages for API calls
- Configurable via environment variables

**Key Functions:**

```python
# Count tokens in text or messages
count_tokens(text, model="gpt-4") -> int
count_messages_tokens(messages) -> int

# Generate summary using OpenAI
generate_summary(messages, existing_summary=None) -> str

# Check if summarization should trigger
should_summarize(history_tokens, summary_tokens, new_message_tokens) -> bool

# Filter messages for OpenAI API
filter_messages_for_llm(all_messages, memory_summary, recent_count) -> list

# Main processing function
process_conversation_context(conversation, new_user_message, db_session) -> tuple

# Retrieve full history for frontend
get_full_history_for_frontend(conversation_id) -> list
```

#### 2. **Enhanced LLM Integration** (`get_response.py`)

**Updated `call_llm` function:**

```python
def call_llm(prompt, keji_prompt_path=None, user_name=None,
             additional_context=None, conversation_history=None):
    # Builds message array with:
    # 1. System prompt (Keji's personality)
    # 2. Conversation history (includes memory summary)
    # 3. Current user message
```

**Updated `handle_user_input` function:**

```python
def handle_user_input(user_input, user_name=None, conversation_history=None):
    # Passes conversation history to all intent handlers
    # Maintains context awareness across budget/ingredient/chat intents
```

#### 3. **Chat API Enhancements** (`chat.py`)

**Chat Endpoint Flow:**

```python
@chat_bp.route("/chat", methods=["POST"])
def chat():
    # 1. Find or create conversation
    # 2. Save user message to database
    # 3. Process conversation context (handles summarization)
    # 4. Call LLM with filtered context
    # 5. Save bot response
    # 6. Return response to frontend
```

**History Endpoint Updates:**

```python
@chat_bp.route("/chat/history", methods=["GET"])
def history():
    # Returns FULL conversation history for frontend display
    # Never filtered or truncated
    # Includes metadata: has_summary, summarized_count
```

## Configuration

### Environment Variables

Create or update `.env` file:

```bash
# Token threshold for triggering summarization
CHAT_TOKEN_THRESHOLD=3000

# Number of recent messages to keep in API calls
CHAT_RECENT_MESSAGES=10

# All existing environment variables...
OPENAI_API_KEY=your_api_key
SQLALCHEMY_DATABASE_URI=postgresql://...
```

### Configurable Parameters

In `context_manager.py`:

```python
TOKEN_THRESHOLD = 3000  # Trigger summarization threshold
RECENT_MESSAGES_COUNT = 10  # Recent messages to include in API calls
MODEL_FOR_SUMMARY = "gpt-4o-mini"  # Model for summarization (cheaper)
MODEL_FOR_CHAT = "gpt-5"  # Model for chat (main responses)
```

## Installation & Setup

### 1. Install Dependencies

```bash
cd keji_backend
.\venv\Scripts\activate  # Windows
# or
source venv/bin/activate  # Linux/Mac

pip install tiktoken
# Or install from requirements.txt
pip install -r requirements.txt
```

### 2. Run Database Migration

```bash
flask db migrate -m "add_conversation_memory_fields"
flask db upgrade
```

### 3. Verify Installation

Check that the new fields exist:

```bash
flask shell
>>> from models import Conversation
>>> c = Conversation.query.first()
>>> print(c.memory_summary, c.pruned_count, c.last_summary_at)
```

## Usage Examples

### Example 1: Normal Conversation (Below Threshold)

**User messages:**

1. "Hi, I have 500 naira"
2. "What can I buy?"

**System behavior:**

- Stores both messages in database
- Sends both messages + system prompt to OpenAI
- No summarization triggered (token count low)

### Example 2: Long Conversation (Above Threshold)

**User messages:** 20 messages exchanged

**System behavior:**

1. Token count exceeds 3000
2. Summarizes first 10 messages (oldest)
3. Sends to OpenAI:
   - System prompt
   - Summary of first 10 messages
   - Recent 10 messages
   - New message
4. Database still contains all 20+ messages
5. Frontend displays all 20+ messages

### Example 3: Continued Long Conversation

**User messages:** 30 messages total

**System behavior:**

1. Updates existing summary with messages 11-20
2. Keeps recent 10 messages (21-30)
3. Database contains all 30 messages
4. Frontend displays all 30 messages
5. OpenAI receives: summary + recent 10 + new message

## API Response Format

### Chat History Endpoint

**Request:**

```http
GET /chat/history
Authorization: <session_cookie>
```

**Response:**

```json
{
  "messages": [
    {
      "sender": "user",
      "text": "I have 500 naira",
      "timestamp": "2025-10-11T10:30:00"
    },
    {
      "sender": "bot",
      "text": "E go be! With ₦500, you fit buy...",
      "timestamp": "2025-10-11T10:30:05"
    }
  ],
  "has_summary": true,
  "summarized_count": 10
}
```

## Monitoring & Logging

The system includes comprehensive logging for debugging:

### Token Tracking Logs

```
🔢 Token breakdown:
   History: 2450
   Summary: 120
   New message: 45
   Total: 2615
✅ Token count within limits: 2615 / 3000
```

### Summarization Logs

```
⚠️  Token threshold exceeded: 3150 > 3000
🔄 Summarization will be triggered
🔄 Generating conversation summary...
📦 Summarizing 10 older messages
✅ Summary generated (115 tokens)
✅ Summary updated: 10 messages compressed
```

### Context Processing Logs

```
🧠 PROCESSING CONVERSATION CONTEXT
📊 Total messages in history: 15
📝 Existing summary: Yes
✂️  Previously summarized: 10 messages
📋 Filtering 15 messages for LLM...
✅ Filtered to 11 messages (summary: 1, recent: 10)
```

## Performance Considerations

### Token Savings

**Without Context Management:**

- 30 messages = ~2000 tokens
- Every API call sends all 2000 tokens
- Cost increases linearly with conversation length

**With Context Management:**

- 30 messages = ~2000 tokens in database
- API call sends: 150 (summary) + 500 (recent 10) = 650 tokens
- **~70% token reduction** for long conversations

### Summary Generation Cost

- Uses `gpt-4o-mini` (cheaper than main model)
- Summary only generated when threshold exceeded
- Incremental: builds on existing summary
- Typical cost: $0.0001 - $0.0005 per summary

### Database Impact

- Minimal: 3 additional columns per conversation
- `TEXT` field for summary (~200 words = 1KB)
- Negligible storage increase

## Testing

### Manual Testing

```python
# In Python/Flask shell
from app import db, app
from models import Conversation, Message, User
from context_manager import process_conversation_context

with app.app_context():
    # Get a test conversation
    conv = Conversation.query.first()

    # Simulate many messages
    for i in range(15):
        msg = Message(
            conversation_id=conv.id,
            sender="user" if i % 2 == 0 else "bot",
            text=f"Test message {i}"
        )
        db.session.add(msg)
    db.session.commit()

    # Process context
    filtered, summarized = process_conversation_context(
        conv,
        "New test message",
        db.session
    )

    print(f"Summarization occurred: {summarized}")
    print(f"Filtered messages: {len(filtered)}")
    print(f"Memory summary: {conv.memory_summary[:100]}...")
```

## Troubleshooting

### Issue: "ModuleNotFoundError: No module named 'tiktoken'"

**Solution:**

```bash
pip install tiktoken
```

### Issue: Token count seems incorrect

**Cause:** Different models use different tokenization

**Solution:** Ensure `count_tokens()` uses the same model as your API calls:

```python
count_tokens(text, model="gpt-4")  # Match your model
```

### Issue: Frontend not showing all messages

**Cause:** Frontend might be filtering messages

**Solution:** History endpoint always returns full messages. Check frontend rendering:

```javascript
// Frontend should render all messages from response
response.messages.forEach((msg) => renderMessage(msg));
```

### Issue: Summarization not triggering

**Check:**

1. Token threshold set correctly: `CHAT_TOKEN_THRESHOLD=3000`
2. Conversation has enough messages (> `RECENT_MESSAGES_COUNT`)
3. Check logs for token breakdown

## Future Enhancements

### Potential Improvements

1. **User-Specific Summaries**

   - Maintain separate summaries for different topics
   - Allow users to view/edit their conversation summaries

2. **Semantic Chunking**

   - Group related messages by topic
   - Summarize by topic rather than chronologically

3. **Multi-Turn Memory**

   - Track specific entities (foods, preferences, budgets) separately
   - Quick lookup without full history scan

4. **Summary Quality Metrics**

   - Evaluate summary relevance
   - A/B test different summarization prompts

5. **Configurable Strategies**
   - Per-user token thresholds
   - Different strategies for different conversation types

## API Reference

### Context Manager Functions

#### `count_tokens(text: str, model: str = "gpt-4") -> int`

Counts tokens in a text string.

#### `count_messages_tokens(messages: List[Dict]) -> int`

Counts tokens in a list of messages.

#### `generate_summary(messages: List[Dict], existing_summary: Optional[str] = None) -> str`

Generates a concise conversation summary.

#### `should_summarize(history_tokens: int, summary_tokens: int, new_message_tokens: int, threshold: int = TOKEN_THRESHOLD) -> bool`

Determines if summarization should be triggered.

#### `filter_messages_for_llm(all_messages: List[Dict], memory_summary: Optional[str] = None, recent_count: int = RECENT_MESSAGES_COUNT) -> List[Dict]`

Filters messages to send to OpenAI API.

#### `process_conversation_context(conversation: Conversation, new_user_message: str, db_session) -> Tuple[List[Dict], bool]`

Main function that processes conversation context and handles summarization.

#### `get_full_history_for_frontend(conversation_id: int) -> List[Dict]`

Retrieves complete conversation history for frontend display.

## Best Practices

1. **Regular Monitoring**

   - Monitor average token usage per conversation
   - Track summarization frequency
   - Review summary quality periodically

2. **Token Threshold Tuning**

   - Start with 3000 (recommended)
   - Adjust based on model limits and costs
   - Consider different thresholds for different users

3. **Summary Review**

   - Periodically review generated summaries
   - Ensure key information is retained
   - Refine summary prompts if needed

4. **Database Maintenance**

   - Conversations table grows with summaries
   - Consider archiving very old conversations
   - Monitor database size

5. **Testing**
   - Test with various conversation lengths
   - Verify frontend displays all messages
   - Confirm API calls use filtered context

## Support & Contribution

For issues, questions, or contributions:

1. Check logs for detailed error messages
2. Review configuration settings
3. Test with simple conversations first
4. Document any bugs with reproduction steps

## License

This enhancement is part of the Keji AI project and follows the same license as the main project.

---

**Last Updated:** October 11, 2025  
**Version:** 1.0.0  
**Authors:** Keji AI Development Team
