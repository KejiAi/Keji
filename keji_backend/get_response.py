import os
from dotenv import load_dotenv
from openai import OpenAI
import json
import logging
import random
import re
from context_manager import MODEL_FOR_CHAT

# Configure logging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

load_dotenv()
food_data_path = os.path.join(os.path.dirname(__file__), 'foods.json')
keji_prompt_path = os.path.join(os.path.dirname(__file__), 'keji_prompt.txt')

logger.info("Keji AI Response Module initialized")

ENVIRONMENT = os.getenv("FLASK_ENV", "development").strip().lower()
IS_PRODUCTION = ENVIRONMENT == "production"

logger.info(f"Environment: {ENVIRONMENT} (production={IS_PRODUCTION})")

DUMMY_RESPONSES = [
    "Dev mode reply: I hear you loud and clear.",
    "Keji (sandbox) says hi!",
    "Just echoing back from dev mode.",
    "Testing response flowing fine.",
    "Still in dev mode, but I'm paying attention.",
    "Sandbox Keji is chilling. What's next?",
]


def _build_dummy_response(user_input):
    """
    Construct a lightweight dummy response for non-production environments.
    """
    snippet = user_input.strip() if user_input else ""
    if snippet and len(snippet) > 60:
        snippet = snippet[:57].rstrip() + "..."
    base = random.choice(DUMMY_RESPONSES)
    if snippet:
        return f"{base} (You said: {snippet})"
    return base

def _openai_in_thread(func):
    """Wrapper to run OpenAI calls in real threads (bypasses eventlet SSL)"""
    import eventlet.tpool
    return eventlet.tpool.execute(func)

def _get_openai_client():
    """Create OpenAI client in thread context (fresh SSL, no eventlet patch)"""
    return OpenAI()

def classify_llm(prompt, conversation_history=None, user_name=None, time_of_day=None, chat_style=None):
    """
    Classify user intent AND respond directly for chat intents.
    Uses keji_chat_prompt.txt for classification + chat responses.
    
    Args:
        prompt: The classification prompt with user input
        conversation_history: Optional list of last 10 conversation messages for context
        user_name: Optional user's name for personalization
        time_of_day: Optional time period for greetings
        chat_style: Optional language style preference (pure_english, more_english, pure_pidgin)
    
    Returns:
        str: JSON result with classification (and response for chat type)
    """
    if not IS_PRODUCTION:
        logger.debug("Non-production environment: skipping OpenAI classify call")
        return json.dumps({"type": "chat", "response": "Hey! I'm in dev mode. What's on your mind?"})

    logger.info("=" * 60)
    logger.info("CLASSIFY_LLM: Classifying intent + chat response")
    logger.info("=" * 60)
    
    # Load the chat classifier prompt
    chat_prompt_path = os.path.join(os.path.dirname(__file__), 'keji_chat_prompt.txt')
    try:
        with open(chat_prompt_path, 'r', encoding='utf-8') as f:
            system_prompt = f.read()
    except FileNotFoundError:
        logger.warning("keji_chat_prompt.txt not found, using fallback")
        system_prompt = "You are a classifier. Always respond in JSON format."
    
    # Add context to system prompt
    context_additions = []
    if user_name:
        context_additions.append(f"User's name: {user_name}")
    if time_of_day:
        context_additions.append(f"Time of day: {time_of_day}")
    if chat_style:
        context_additions.append(f"Chat style preference: {chat_style}")
    
    if context_additions:
        system_prompt += "\n\nCURRENT CONTEXT:\n" + "\n".join(context_additions)
    
    # Build messages array with conversation history
    messages = [{"role": "system", "content": system_prompt}]
    
    # Add conversation history if provided (last 10 messages for context)
    if conversation_history:
        recent_history = conversation_history[-10:] if len(conversation_history) > 10 else conversation_history
        logger.info(f"   Including {len(recent_history)} recent messages for classification context")
        
        for hist_msg in recent_history:
            messages.append(hist_msg)
    
    # Add the classification prompt
    messages.append({"role": "user", "content": prompt})
    
    logger.info(f"   Total messages: {len(messages)}")
    logger.info(f"   Chat style: {chat_style or 'not set'}")
    
    def _call():
        """Run in real thread with fresh OpenAI client"""
        try:
            client = _get_openai_client()
            response = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=messages
            )
            if response and hasattr(response, 'choices') and response.choices:
                content = response.choices[0].message.content
                return {"success": True, "content": content if content else ""}
            return {"error": "Invalid response from OpenAI API"}
        except Exception as e:
            logger.error(f"Error in classification API call: {str(e)}", exc_info=True)
            return {"error": str(e)}
    
    response_data = _openai_in_thread(_call)
    if not response_data or not isinstance(response_data, dict) or "error" in response_data:
        logger.error(f"Classification failed: {response_data.get('error', 'Unknown error') if isinstance(response_data, dict) else 'Invalid response'}")
        return json.dumps({"type": "chat", "response": "Hey! How can I help you today?"})
    
    result = response_data.get("content", "")
    logger.info(f"   Classification complete: {len(result)} chars")
    
    return result


def call_llm(
    prompt,
    keji_prompt_path=None,
    additional_context=None,
    conversation_history=None,
    chat_style=None,
    image_base64_data=None,
):
    """
    Call the LLM for RECOMMENDATIONS using keji_prompt.txt.
    This function focuses on generating food recommendations with the last 20 chats for context.
    
    Args:
        prompt: The recommendation request (includes budget/ingredients context)
        keji_prompt_path: Path to the Keji prompt file (defaults to global keji_prompt_path)
        additional_context: Dict with food options, budget, ingredients, etc.
        conversation_history: Last 20 messages for context
        chat_style: Language style preference (pure_english, more_english, pure_pidgin)
        image_base64_data: Optional list of dicts with 'base64' and 'mime_type' for vision API
    
    Returns:
        dict: Recommendation response with 'type', 'role', 'title', 'content', 'health'
    """
    if not IS_PRODUCTION:
        logger.info("Non-production environment: returning dummy LLM response")
        return {
            "type": "recommendation",
            "role": "assistant",
            "title": "Rice and Beans",
            "content": _build_dummy_response(prompt),
            "health": [{"label": "Energy", "description": "Dev mode response"}]
        }

    logger.info("=" * 60)
    logger.info("CALL_LLM: Generating recommendation")
    logger.info("=" * 60)
    
    if keji_prompt_path is None:
        keji_prompt_path = globals()['keji_prompt_path']
    
    with open(keji_prompt_path, "r", encoding="utf-8") as file:
        keji_prompt = file.read().strip()

    # Build context for the recommendation
    context_parts = []
    if chat_style:
        context_parts.append(f"Chat style: {chat_style}")
    
    # Add food context from additional_context
    context_payload = dict(additional_context or {})
    if context_payload:
        context_parts.append(f"Context: {json.dumps(context_payload, ensure_ascii=False)}")
    
    # Build the full prompt
    user_message = prompt
    if context_parts:
        user_message = "\n".join(context_parts) + "\n\n" + prompt
    
    logger.info(f"   Chat style: {chat_style or 'not set'}")
    logger.info(f"   Context keys: {list(context_payload.keys()) if context_payload else 'none'}")

    # Build messages array with last 20 conversation messages
    messages = [{"role": "system", "content": keji_prompt}]
    
    # Add conversation history (last 20 messages for recommendation context)
    if conversation_history:
        recent_history = conversation_history[-20:] if len(conversation_history) > 20 else conversation_history
        logger.info(f"   Including {len(recent_history)} messages for recommendation context")
        for hist_msg in recent_history:
            messages.append(hist_msg)
    
    # Use base64 data for vision API if provided, otherwise try to extract URLs from message
    has_images = False
    if image_base64_data and len(image_base64_data) > 0:
        # Use base64 data directly (preferred method)
        has_images = True
        logger.info(f"🖼️ Using {len(image_base64_data)} image(s) with base64 data for vision API")
        
        # Remove attachment markers from text, keep only the actual user message
        user_message = re.sub(r'\[Attachment:[^\]]*\]', '', user_message).strip()
        user_message = re.sub(r'^Uploaded image URLs:.*$', '', user_message, flags=re.MULTILINE).strip()
        
        # Build content array with text and base64 images
        user_content = [{"type": "text", "text": user_message}]
        for img_data in image_base64_data:
            base64_str = img_data.get("base64", "")
            mime_type = img_data.get("mime_type", "image/jpeg")
            # Format as data URI: data:image/<format>;base64,<BASE64_DATA>
            data_uri = f"data:{mime_type};base64,{base64_str}"
            user_content.append({
                "type": "image_url",
                "image_url": {"url": data_uri}
            })
        messages.append({"role": "user", "content": user_content})
        logger.debug(f"   User text: {user_message[:100]}...")
        logger.debug(f"   Image formats: {[img.get('mime_type') for img in image_base64_data]}")
    else:
        # Fallback: Try to extract image URLs from message text
        attachment_pattern = r'\[Attachment:[^\]]*->\s*(https?://[^\s\]]+)\]'
        matches = re.findall(attachment_pattern, user_message)
        
        if matches:
            has_images = True
            image_urls = matches
            logger.info(f"🖼️ Detected {len(image_urls)} image URL(s) in user message (fallback method)")
            logger.debug(f"Image URLs: {image_urls}")
            # Remove attachment markers from text
            user_message = re.sub(r'\[Attachment:[^\]]*\]', '', user_message).strip()
            user_message = re.sub(r'^Uploaded image URLs:.*$', '', user_message, flags=re.MULTILINE).strip()
            
            # Build content array with text and image URLs
            user_content = [{"type": "text", "text": user_message}]
            for img_url in image_urls:
                user_content.append({
                    "type": "image_url",
                    "image_url": {"url": img_url}
                })
            messages.append({"role": "user", "content": user_content})
            logger.debug(f"   User text: {user_message[:100]}...")
        else:
            # Regular text message (no images)
            messages.append({"role": "user", "content": user_message})
    
    logger.debug(f"Total context messages: {len(messages)}")

    def _call():
        """Run in real thread with fresh OpenAI client - extract all data before returning"""
        try:
            client = _get_openai_client()
            # Use gpt-4o for main chat (upgraded version, supports both text and vision)
            # gpt-4o-mini is used for summarization and classification (smaller tasks)
            model = MODEL_FOR_CHAT  # gpt-4o - upgraded version for main chat
            logger.info(f"📤 Calling OpenAI API with model: {model}, {len(messages)} messages")
            if has_images:
                logger.info(f"   Vision request with images")
            
            response = client.chat.completions.create(
                model=model,
                messages=messages
            )
            
            # Extract all needed data from response BEFORE returning (avoids greenlet issues)
            if not response or not hasattr(response, 'choices') or not response.choices:
                return {"error": "Invalid response from OpenAI API"}
            
            message = response.choices[0].message
            if not hasattr(message, 'content'):
                return {"error": "Message missing content attribute"}
            
            content = message.content
            if content is None:
                return {"error": "Response content is None"}
            
            # Return simple dict with extracted data (no complex objects)
            return {
                "success": True,
                "content": content.strip() if content else ""
            }
        except Exception as e:
            logger.error(f"Error in OpenAI API call: {str(e)}", exc_info=True)
            return {"error": str(e)}
    
    try:
        response_data = _openai_in_thread(_call)
        
        # Check if response is valid
        if not response_data or not isinstance(response_data, dict):
            logger.error("❌ No response data from OpenAI API")
            return {
                "type": "chat",
                "role": "assistant",
                "content": "Omo, something don happen for my side. Abeg try again?"
            }
        
        if "error" in response_data:
            logger.error(f"❌ Error in OpenAI API call: {response_data['error']}")
            return {
                "type": "chat",
                "role": "assistant",
                "content": "Omo, something don happen for my side. Abeg try again?"
            }
        
        if not response_data.get("success"):
            logger.error("❌ OpenAI API call was not successful")
            return {
                "type": "chat",
                "role": "assistant",
                "content": "Omo, something don happen for my side. Abeg try again?"
            }
        
        result = response_data.get("content", "")
        if not result or not result.strip():
            logger.error(f"❌ Empty response content")
            return {
                "type": "chat",
                "role": "assistant",
                "content": "Omo, something don happen for my side. Abeg try again?"
            }
        
        result = result.strip()
        logger.info(f"✅ LLM response received: {len(result)} chars")
        if has_images:
            logger.info(f"🖼️ Vision API response preview: {result[:200]}...")
        logger.debug("\n")
        
        # Strip markdown code blocks if present (OpenAI sometimes wraps JSON in ```json ... ```)
        if result.startswith('```'):
            # Find the closing ```
            lines = result.split('\n')
            # Remove first line if it's ```json or ```
            if lines[0].startswith('```'):
                lines = lines[1:]
            # Remove last line if it's ```
            if lines and lines[-1].strip() == '```':
                lines = lines[:-1]
            result = '\n'.join(lines).strip()
            logger.debug("Stripped markdown code blocks from response")
        
        # Parse JSON response
        try:
            parsed = json.loads(result)
            logger.info("Successfully parsed JSON response")
            logger.info(f"   Response type: {parsed.get('type', 'unknown')}")
            
            # Validate structure based on type
            response_type = parsed.get('type', 'unknown')
            
            if response_type == 'recommendation':
                # Validate recommendation structure
                if "type" in parsed and "role" in parsed and "title" in parsed and "content" in parsed:
                    logger.info(f"Recommendation: {parsed.get('title', 'N/A')}")
                     return parsed
                else:
                    logger.warning("Incomplete recommendation structure, using fallback")
                    logger.warning(f"   Missing fields - type: {'type' in parsed}, role: {'role' in parsed}, title: {'title' in parsed}, content: {'content' in parsed}")
                    return {
                        "type": "chat",
                        "role": "assistant",
                        "content": result
                    }
            else:
                # Validate chat structure
                if "type" in parsed and "role" in parsed and "content" in parsed:
                    return parsed
                else:
                    logger.warning("Incomplete JSON structure, using fallback")
                    # Fallback if structure is incomplete
                    return {
                        "type": "chat",
                        "role": "assistant",
                        "content": result
                    }
        except json.JSONDecodeError as e:
            logger.error(f"JSON parsing failed: {str(e)}")
            logger.error(f"   Raw response (first 500 chars): {result[:500]}")
            logger.error("   Using fallback chat response")
            logger.info("="*60 + "\n")
            # If LLM didn't return valid JSON, wrap it as chat
            return {
                "type": "chat",
                "role": "assistant",
                "content": result
            }
    except Exception as e:
        logger.error(f"Error calling OpenAI API: {str(e)}", exc_info=True)
        return {
            "type": "chat",
            "role": "assistant",
            "content": "Omo, something don happen for my side. Abeg try again?"
        }


def classify_intent(user_input, conversation_history=None, user_name=None, time_of_day=None, chat_style=None):
    """
    Classify user intent AND get response for chat in a single LLM call.
    
    Args:
        user_input: The user's current message
        conversation_history: Optional list of previous conversation messages
        user_name: Optional user's name for personalization
        time_of_day: Optional time period for greetings
        chat_style: Optional language style preference
    
    Returns:
        dict: Classification result with intent type (and response for chat)
    """
    if not IS_PRODUCTION:
        logger.info("Non-production environment: using dummy classifier (CHAT intent)")
        logger.info("="*60 + "\n")
        return {"type": "chat", "response": f"Dev mode response to: {user_input}"}

    logger.info("Classifying intent (single-call with response)...")
    logger.debug(f"Input: {len(user_input)} chars")
    
    prompt = f"""Classify this message and respond if it's chat (including decisions).

Current user message: "{user_input}"

Remember:
- budget: Return {{"type": "budget", "value": number}}
- ingredient: Return {{"type": "ingredient", "value": ["item1", "item2"]}}
- chat (or decision): Return {{"type": "chat", "response": "your_friendly_response"}}

Answer (JSON only):"""
    
    result = classify_llm(
        prompt, 
        conversation_history=conversation_history,
        user_name=user_name,
        time_of_day=time_of_day,
        chat_style=chat_style
    ).strip()
    
    # Strip markdown code blocks if present (OpenAI sometimes wraps JSON in ```json ... ```)
    if result.startswith('```'):
        lines = result.split('\n')
        if lines[0].startswith('```'):
            lines = lines[1:]
        if lines and lines[-1].strip() == '```':
            lines = lines[:-1]
        result = '\n'.join(lines).strip()
        logger.debug("Stripped markdown code blocks from classification response")
    
    try:
        parsed = json.loads(result)
        intent_type = parsed.get("type", "chat")
        
        if intent_type == "budget":
            logger.info(f"Intent: BUDGET (N{parsed.get('value', 0)})")
        elif intent_type == "ingredient":
            ingredients = parsed.get('value', [])
            logger.info(f"Intent: INGREDIENT ({', '.join(ingredients) if ingredients else 'none'})")
        else:
            response_preview = parsed.get('response', '')[:50]
            logger.info(f"Intent: CHAT (response: {response_preview}...)")
        
        logger.info("="*60 + "\n")
        return parsed
    except json.JSONDecodeError as e:
        logger.warning(f"Failed to parse intent JSON: {str(e)}")
        logger.warning(f"   Raw result: {result[:200]}...")
        logger.info("="*60 + "\n")
        # fallback: return chat with original message as response
        return {"type": "chat", "response": f"I didn't quite catch that. Could you rephrase?"}
    
def get_foods_by_budget(budget):
    logger.debug("\n" + "-"*60)
    logger.debug(f"Searching foods within budget: N{budget}")
    logger.debug("-"*60)
    
    try:
        with open(food_data_path, 'r', encoding='utf-8') as file:
            foods = json.load(file)
        
        logger.debug(f"Total foods in database: {len(foods)}")
        
        # Filter foods where Price is less than or equal to the budget
        filtered_foods = [food for food in foods if food.get('Price', float('inf')) <= budget]
        
        logger.info(f"Found {len(filtered_foods)} foods within N{budget} budget")
        logger.debug("-"*60 + "\n")
        
        return filtered_foods
    except FileNotFoundError:
        logger.error(f"Food database not found: {food_data_path}")
        logger.debug("-"*60 + "\n")
        return []
    except json.JSONDecodeError:
        logger.error("Failed to parse food database JSON")
        logger.debug("-"*60 + "\n")
        return []

def get_meals_by_ingredients(ingredients):
    logger.debug("\n" + "-"*60)
    logger.debug(f"Searching meals with ingredients: {', '.join(ingredients)}")
    logger.debug("-"*60)
    
    try:
        with open(food_data_path, 'r', encoding='utf-8') as file:
            foods = json.load(file)

        logger.debug(f"Total foods in database: {len(foods)}")
        
        filtered_foods = []
        for food in foods:
            food_name = food.get('Food', '').lower()
            if any(ingredient.lower() in food_name for ingredient in ingredients):
                filtered_foods.append(food)

        logger.info(f"Found {len(filtered_foods)} meals matching ingredients")
        logger.debug("-"*60 + "\n")
        
        return filtered_foods
    except (FileNotFoundError, json.JSONDecodeError) as e:
        logger.error(f"Error loading food database: {str(e)}")
        logger.debug("-"*60 + "\n")
        return []


def handle_user_input(user_input, user_name=None, conversation_history=None, time_of_day=None, chat_style=None, image_base64_data=None):
    """
    Handle user input, classify intent, and return appropriate structured response.
    
    NOTE: Classification and recommendation features only work when FLASK_ENV=production.
    In development/testing mode, returns dummy chat responses.
    
    Args:
        user_input: The user's message
        user_name: Optional user's name for personalization
        conversation_history: Optional list of previous messages for context
        time_of_day: Optional time period for time-based greetings
        image_base64_data: Optional list of dicts with 'base64' and 'mime_type' for vision API
    
    Returns:
        dict: Structured response (chat or recommendation)
    """
    if not IS_PRODUCTION:
        logger.info("Processing input in non-production mode (dummy response)")
        logger.info("   Classification and recommendations disabled - set FLASK_ENV=production to enable")
        return {
            "type": "chat",
            "role": "assistant",
            "content": _build_dummy_response(user_input)
        }

    logger.info(f"Processing input: {len(user_input)} chars")
    if image_base64_data:
        logger.info(f"   With {len(image_base64_data)} image(s) for vision API")
    
    logger.info("Step 1: Classifying intent (with chat response)...")
    intent = classify_intent(
        user_input, 
        conversation_history=conversation_history,
        user_name=user_name,
        time_of_day=time_of_day,
        chat_style=chat_style
    )
    intent_type = intent.get("type", "chat")
    logger.info(f"Step 2: Classification result: {intent_type}")

    if intent_type == "budget":
        budget = intent.get("value", 0)
        logger.info(f"Processing BUDGET intent: N{budget}")
        foods = get_foods_by_budget(budget)
        
        if not foods:
            logger.warning(f"No foods found within budget N{budget}")
            # No foods in budget - let Keji respond with empathy and humor
            context = {
                "budget": budget,
                "foods_available": [],
                "note": "Budget is too small for available options"
            }
            if chat_style:
                context["chat_style"] = chat_style
            prompt = f"User has ₦{budget} but no food options are available within their budget. Respond with empathy and humor."
            result = call_llm(
                prompt,
                additional_context=context,
                conversation_history=conversation_history,
                chat_style=chat_style,
            )
            logger.info("Low budget response generated")
            return result
        else:
            logger.info(f"{len(foods)} foods available for N{budget}")
            # Always pick ONE best recommendation
            context = {
                "budget": budget,
                "available_foods": foods,
                "note": f"These {len(foods)} food options are within the user's budget"
            }
            if chat_style:
                context["chat_style"] = chat_style
            
            # Always recommend ONE meal, regardless of how many options
            prompt = f"User has ₦{budget} to spend. Pick the BEST option from the {len(foods)} available foods and recommend it. Keep content SHORT (2-3 sentences max) with where to get it and a quick tip. Include health benefits."
            logger.debug(f"   Picking best from {len(foods)} options for RECOMMENDATION")
            
            result = call_llm(
                prompt,
                additional_context=context,
                conversation_history=conversation_history,
                chat_style=chat_style,
            )
            logger.info("Food recommendation generated")
            return result

    elif intent_type == "ingredient":
        ingredients = intent.get("value", [])
        if not isinstance(ingredients, list):
            ingredients = [ingredients] if ingredients else []
        logger.info(f"Processing INGREDIENT intent: {', '.join(ingredients) if ingredients else 'none'}")
        foods = get_meals_by_ingredients(ingredients)
        
        if not foods:
            logger.warning(f"No meals found with ingredients: {', '.join(ingredients)}")
            # No matching meals - let Keji be creative
            context = {
                "ingredients": ingredients,
                "meals_found": [],
                "note": "No exact matches in database"
            }
            if chat_style:
                context["chat_style"] = chat_style
            prompt = f"User has these ingredients: {', '.join(ingredients)}. No exact matches found. Suggest ONE creative meal idea they can make. Keep it SHORT (2-3 sentences)."
            result = call_llm(
                prompt,
                additional_context=context,
                conversation_history=conversation_history,
                chat_style=chat_style,
            )
            logger.info("Creative meal suggestions generated")
            return result
        else:
            logger.info(f"{len(foods)} meals found with ingredients")
            # Always pick ONE best recommendation
            context = {
                "ingredients": ingredients,
                "matching_meals": foods,
                "note": f"Found {len(foods)} meals that use these ingredients"
            }
            if chat_style:
                context["chat_style"] = chat_style
            
            # Always recommend ONE meal, regardless of how many options
            prompt = f"User has these ingredients: {', '.join(ingredients)}. Pick the BEST meal from the {len(foods)} options and recommend it. Keep content SHORT (2-3 sentences max) with a quick cooking tip. Include health benefits."
            logger.debug(f"   Picking best from {len(foods)} options for RECOMMENDATION")
            
            result = call_llm(
                prompt,
                additional_context=context,
                conversation_history=conversation_history,
                chat_style=chat_style,
            )
            logger.info("Ingredient-based recommendation generated")
            return result

    else:
        # General chat - response already generated by classify_intent
        logger.info("Processing CHAT intent (using classify response directly)")
        chat_response = intent.get("response", "Hey! How can I help you today?")
        logger.info(f"Chat response ready (no 2nd LLM call): {len(chat_response)} chars")
        
        # Return in the standard chat format
        return {
            "type": "chat",
            "role": "assistant",
            "content": chat_response
        }


if __name__ == "__main__":
    # Test code for Keji AI
    print("\n" + "="*70)
    print("🧪 KEJI AI TEST MODE")
    print("="*70 + "\n")
    
    # Test cases
    test_cases = [
        {
            "input": "I have 500 naira, what can I eat?",
            "user_name": "Tunde",
            "description": "Budget query with small amount"
        },
        # {
        #     "input": "I get 2k, wetin I fit chop?",
        #     "user_name": "Amaka",
        #     "description": "Budget query with Nigerian slang"
        # },
        # {
        #     "input": "I have rice and beans at home",
        #     "user_name": "Chidi",
        #     "description": "Ingredient query"
        # },
        # {
        #     "input": "Good morning! How are you?",
        #     "user_name": "Fatima",
        #     "description": "General chat greeting"
        # },
        # {
        #     "input": "What can I eat if I have ulcer?",
        #     "user_name": "Bola",
        #     "description": "Health-related query"
        # }
    ]
    
    # Run each test case
    for i, test in enumerate(test_cases, 1):
        print(f"\n{'='*70}")
        print(f"TEST CASE {i}: {test['description']}")
        print(f"{'='*70}")
        print(f"User: {test['user_name']}")
        print(f"Input: {test['input']}")
        print(f"{'-'*70}\n")
        
        try:
            response = handle_user_input(test['input'], user_name=test['user_name'])
            
            print(f"\n{'='*70}")
            print("RESPONSE:")
            print(f"{'='*70}")
            print(f"Type: {response.get('type', 'N/A')}")
            print(f"Role: {response.get('role', 'N/A')}")
            
            if response.get('type') == 'recommendation':
                print(f"Title: {response.get('title', 'N/A')}")
                print(f"\nContent:\n{response.get('content', 'N/A')}")
                if response.get('health'):
                    print(f"\nHealth Benefits ({len(response['health'])}):")
                    for benefit in response['health']:
                        print(f"  • {benefit.get('label', 'N/A')}: {benefit.get('description', 'N/A')}")
            else:
                print(f"\nContent:\n{response.get('content', 'N/A')}")
            
            print(f"\n{'='*70}\n")
            
        except Exception as e:
            print(f"\nERROR: {str(e)}")
            print(f"{'='*70}\n")
            import traceback
            traceback.print_exc()
    
    print("\n" + "="*70)
    print("TEST MODE COMPLETE")
    print("="*70 + "\n")