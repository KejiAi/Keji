"""
Standalone script to test OpenAI Vision API with an image.
Sends an image with the prompt "What do you see in the image?" and prints the response.
"""

import os
import base64
import mimetypes
from openai import OpenAI
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Initialize OpenAI client
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# ============================================
# CONFIGURATION - Update this path to your image
# ============================================
IMAGE_PATH = r"C:\Users\USER\Pictures\AA.jpg" # <-- Replace with actual image path
# ============================================


def encode_image_to_base64(image_path: str) -> tuple[str, str]:
    """
    Read an image file and encode it to base64.
    
    Returns:
        tuple: (base64_string, mime_type)
    """
    if not os.path.exists(image_path):
        raise FileNotFoundError(f"Image not found: {image_path}")
    
    # Get mime type
    mime_type, _ = mimetypes.guess_type(image_path)
    if not mime_type:
        mime_type = "image/jpeg"  # Default fallback
    
    # Read and encode
    with open(image_path, "rb") as image_file:
        base64_string = base64.b64encode(image_file.read()).decode("utf-8")
    
    return base64_string, mime_type


def analyze_image(image_path: str, prompt: str = "What do you see in the image?") -> str:
    """
    Send an image to OpenAI Vision API and get a response.
    
    Args:
        image_path: Path to the image file
        prompt: Question to ask about the image
    
    Returns:
        str: The AI's response
    """
    print(f"📷 Loading image: {image_path}")
    
    # Encode image to base64
    base64_image, mime_type = encode_image_to_base64(image_path)
    print(f"   Mime type: {mime_type}")
    print(f"   Base64 size: {len(base64_image)} characters")
    
    # Build the data URI
    data_uri = f"data:{mime_type};base64,{base64_image}"
    
    # Build the message with image
    messages = [
        {
            "role": "user",
            "content": [
                {
                    "type": "text",
                    "text": prompt
                },
                {
                    "type": "image_url",
                    "image_url": {
                        "url": data_uri
                    }
                }
            ]
        }
    ]
    
    print(f"\n🤖 Sending to OpenAI Vision API...")
    print(f"   Prompt: {prompt}")
    
    # Call OpenAI API
    response = client.chat.completions.create(
        model="gpt-4o",  # Vision-capable model
        messages=messages,
        max_tokens=1000
    )
    
    # Extract response
    reply = response.choices[0].message.content
    
    return reply


def main():
    """Main function to run the image analysis."""
    print("=" * 50)
    print("OpenAI Vision API Test")
    print("=" * 50)
    
    # Check if API key is set
    if not os.getenv("OPENAI_API_KEY"):
        print("❌ Error: OPENAI_API_KEY not found in environment variables")
        print("   Make sure you have a .env file with OPENAI_API_KEY=your_key")
        return
    
    # Check if image path is configured
    if IMAGE_PATH == r"C:\Users\USER\Pictures\AA.jpg":
        print("⚠️  Warning: Using placeholder image path")
        print("   Update IMAGE_PATH in this script to point to an actual image")
        print("")
        
        # For testing, you can also use a URL instead
        print("Alternatively, you can test with a URL:")
        test_with_url()
        return
    
    try:
        # Analyze the image
        response = analyze_image(IMAGE_PATH)
        
        print("\n" + "=" * 50)
        print("📝 AI Response:")
        print("=" * 50)
        print(response)
        print("=" * 50)
        
    except FileNotFoundError as e:
        print(f"❌ Error: {e}")
    except Exception as e:
        print(f"❌ Error calling OpenAI API: {e}")


def test_with_url():
    """Test with a sample image URL instead of a file."""
    print("Testing with a sample image URL...")
    
    # Sample image URL (a simple test image)
    sample_url = "https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/PNG_transparency_demonstration_1.png/300px-PNG_transparency_demonstration_1.png"
    sample_url = "https://res.cloudinary.com/drrj5v6nu/image/upload/v1766354803/keji/uploads/AA-f1f0ce5d.jpg"
    
    messages = [
        {
            "role": "user",
            "content": [
                {
                    "type": "text",
                    "text": "What do you see in the image?"
                },
                {
                    "type": "image_url",
                    "image_url": {
                        "url": sample_url
                    }
                }
            ]
        }
    ]
    
    try:
        print(f"\n🤖 Sending to OpenAI Vision API...")
        
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=messages,
            max_tokens=1000
        )
        
        reply = response.choices[0].message.content
        
        print("\n" + "=" * 50)
        print("📝 AI Response:")
        print("=" * 50)
        print(reply)
        print("=" * 50)
        
    except Exception as e:
        print(f"❌ Error calling OpenAI API: {e}")


if __name__ == "__main__":
    main()

