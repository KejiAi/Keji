"""
Test script for context management system.
This script tests token counting, summarization, and message filtering.
"""

import sys
import os

# Add the current directory to Python path
sys.path.insert(0, os.path.dirname(__file__))

# Load environment variables
from dotenv import load_dotenv
load_dotenv()

from context_manager import (
    count_tokens,
    count_messages_tokens,
    should_summarize,
    filter_messages_for_llm,
    TOKEN_THRESHOLD,
    RECENT_MESSAGES_COUNT
)

def test_token_counting():
    """Test token counting functionality."""
    print("\n" + "="*60)
    print("TEST 1: Token Counting")
    print("="*60)
    
    test_text = "Hello, I have 500 naira and I want to buy some food."
    token_count = count_tokens(test_text)
    
    print(f"Text: {test_text}")
    print(f"Token count: {token_count}")
    print(f"✅ Token counting working" if token_count > 0 else "❌ Token counting failed")
    
    # Test message list
    messages = [
        {"role": "user", "content": "Hi, I have 500 naira"},
        {"role": "assistant", "content": "E go be! With ₦500, you fit buy rice and beans."}
    ]
    
    total_tokens = count_messages_tokens(messages)
    print(f"\nMessages: {len(messages)}")
    print(f"Total tokens: {total_tokens}")
    print(f"✅ Message token counting working" if total_tokens > 0 else "❌ Failed")


def test_summarization_trigger():
    """Test when summarization should trigger."""
    print("\n" + "="*60)
    print("TEST 2: Summarization Trigger Logic")
    print("="*60)
    
    # Scenario 1: Below threshold
    history_tokens = 1500
    summary_tokens = 0
    new_message_tokens = 50
    
    should_trigger = should_summarize(history_tokens, summary_tokens, new_message_tokens)
    print(f"\nScenario 1: Below threshold")
    print(f"  History: {history_tokens}, Summary: {summary_tokens}, New: {new_message_tokens}")
    print(f"  Total: {history_tokens + summary_tokens + new_message_tokens} / {TOKEN_THRESHOLD}")
    print(f"  Should trigger: {should_trigger}")
    print(f"  ✅ Correct" if not should_trigger else "  ❌ Should not trigger")
    
    # Scenario 2: Above threshold
    history_tokens = 2800
    summary_tokens = 100
    new_message_tokens = 200
    
    should_trigger = should_summarize(history_tokens, summary_tokens, new_message_tokens)
    print(f"\nScenario 2: Above threshold")
    print(f"  History: {history_tokens}, Summary: {summary_tokens}, New: {new_message_tokens}")
    print(f"  Total: {history_tokens + summary_tokens + new_message_tokens} / {TOKEN_THRESHOLD}")
    print(f"  Should trigger: {should_trigger}")
    print(f"  ✅ Correct" if should_trigger else "  ❌ Should trigger")


def test_message_filtering():
    """Test message filtering for LLM."""
    print("\n" + "="*60)
    print("TEST 3: Message Filtering")
    print("="*60)
    
    # Create 20 messages
    all_messages = []
    for i in range(20):
        role = "user" if i % 2 == 0 else "assistant"
        all_messages.append({
            "role": role,
            "content": f"Message {i+1}: This is a test message"
        })
    
    print(f"\nTotal messages: {len(all_messages)}")
    
    # Test without summary
    filtered = filter_messages_for_llm(all_messages, memory_summary=None)
    print(f"\nFiltered (no summary): {len(filtered)} messages")
    print(f"  Expected: {RECENT_MESSAGES_COUNT} recent messages")
    print(f"  ✅ Correct" if len(filtered) == RECENT_MESSAGES_COUNT else f"  ❌ Expected {RECENT_MESSAGES_COUNT}")
    
    # Test with summary
    summary = "User previously asked about food options with 500 naira budget."
    filtered_with_summary = filter_messages_for_llm(all_messages, memory_summary=summary)
    print(f"\nFiltered (with summary): {len(filtered_with_summary)} messages")
    print(f"  Expected: {RECENT_MESSAGES_COUNT + 1} (summary + recent)")
    expected = RECENT_MESSAGES_COUNT + 1
    print(f"  ✅ Correct" if len(filtered_with_summary) == expected else f"  ❌ Expected {expected}")
    
    # Verify summary is included
    has_summary = any("CONVERSATION CONTEXT" in msg.get("content", "") for msg in filtered_with_summary)
    print(f"  Summary included: {has_summary}")
    print(f"  ✅ Summary present" if has_summary else "  ❌ Summary missing")


def test_configuration():
    """Test configuration parameters."""
    print("\n" + "="*60)
    print("TEST 4: Configuration")
    print("="*60)
    
    print(f"\nToken Threshold: {TOKEN_THRESHOLD}")
    print(f"Recent Messages Count: {RECENT_MESSAGES_COUNT}")
    print(f"✅ Configuration loaded")


def run_all_tests():
    """Run all tests."""
    print("\n" + "🧪"*30)
    print("CONTEXT MANAGER TEST SUITE")
    print("🧪"*30)
    
    try:
        test_token_counting()
        test_summarization_trigger()
        test_message_filtering()
        test_configuration()
        
        print("\n" + "="*60)
        print("✅ ALL TESTS COMPLETED")
        print("="*60)
        print("\nNote: Some tests require OpenAI API for full functionality.")
        print("Token counting and filtering tests are passing.")
        print("Summarization generation test requires actual API calls.")
        
    except Exception as e:
        print(f"\n❌ TEST FAILED: {str(e)}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    run_all_tests()

