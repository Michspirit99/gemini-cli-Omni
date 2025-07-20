# Third-Party Provider Support in Gemini CLI

This version of Gemini CLI has been extended to support third-party AI providers including OpenAI, Anthropic, and custom endpoints.

## 🎉 **NEW: Enhanced Authentication Screen**

The CLI now includes third-party providers directly in the initial authentication screen! No more workarounds needed.

When you run `gemini`, you'll see these options:
1. Login with Google
2. Use Gemini API Key
3. Vertex AI
4. **OpenAI API Key** ← NEW!
5. **Anthropic API Key** ← NEW! 
6. **Custom Endpoint** ← NEW!

### **Easy Setup Flow:**

**For Standard Providers (OpenAI, Anthropic):**
1. **Select your provider** (e.g., "OpenAI API Key")
2. **Follow the detailed instructions** shown on screen
3. **Set environment variables** as prompted
4. **Restart gemini** - that's it!

**For Custom Endpoints (NEW!):**
1. **Select "Custom Endpoint"**
2. **Enter Base URL** - Interactive prompt with validation (e.g., `https://api.hyprlab.io/v1`)
3. **Enter API Key** - Secure input with validation  
4. **Model Discovery** - Automatically discovers and shows available models
5. **Select Model** - Choose from discovered models or skip
6. **Automatic configuration** - Sets model as default, no environment variables needed!

The custom endpoint flow now includes **automatic model discovery** and **model selection** - completely seamless setup!

## Quick Start

### 1. Set Environment Variables

Set the appropriate API keys for the providers you want to use:

```bash
# For OpenAI
export OPENAI_API_KEY="sk-your-openai-key"

# For Anthropic
export ANTHROPIC_API_KEY="sk-ant-your-anthropic-key"

# For custom endpoints
export CUSTOM_API_KEY="your-custom-key"
export CUSTOM_ENDPOINT="https://your-custom-ai.com/v1"
```

### 2. Use Third-Party Models

You can now use third-party models by specifying them with the `--model` flag:

```bash
# Use OpenAI GPT-4
gemini --model gpt-4

# Use Anthropic Claude
gemini --model claude-3-5-sonnet-20241022

# Use a custom model (requires configuration in settings.json)
gemini --model custom-model-name
```

### 3. Interactive Configuration (NEW!)

Use the built-in `/config` command within the Gemini CLI:

```bash
# Start Gemini CLI
gemini

# Then use these commands inside the CLI:
/config                           # Show help and setup guide
/config show                      # Show current configuration
/config set openai apikey sk-your-key
/config set anthropic apikey sk-ant-your-key  
/config set custom baseurl https://your-endpoint.com/v1
/config set custom apikey your-custom-key
```

### 4. Configure in settings.json

For more advanced configuration, create a `.gemini/settings.json` file:

```json
{
  "thirdPartyProviders": {
    "openai": {
      "apiKey": "$OPENAI_API_KEY",
      "organization": "$OPENAI_ORG_ID"
    },
    "anthropic": {
      "apiKey": "$ANTHROPIC_API_KEY"
    },
    "custom": {
      "apiKey": "$CUSTOM_API_KEY",
      "baseUrl": "$CUSTOM_ENDPOINT",
      "headers": {
        "X-Custom-Header": "value"
      }
    }
  }
}
```

## Supported Models

### OpenAI Models
- `gpt-4`
- `gpt-4-turbo`
- `gpt-4o`
- `gpt-4o-mini`
- `gpt-3.5-turbo`

### Anthropic Models
- `claude-3-opus-20240229`
- `claude-3-sonnet-20240229`
- `claude-3-haiku-20240307`
- `claude-3-5-sonnet-20241022`
- `claude-3-5-haiku-20241022`

### Custom Models
Any model name can be used with custom endpoints. Configure the endpoint in your settings.json.

## How Third-Party Routing Works

When you specify a third-party model, the CLI automatically:

1. **Detects the provider** from the model name (e.g., `gpt-4` → OpenAI)
2. **Routes requests to the correct baseUrl**:
   - OpenAI: `https://api.openai.com/v1/chat/completions`
   - Anthropic: `https://api.anthropic.com/v1/messages`
   - Custom: `YOUR_CUSTOM_ENDPOINT/chat/completions`
3. **Converts request formats** between Gemini format and provider-specific formats
4. **Handles authentication** with provider-specific headers
5. **Converts responses back** to Gemini format for seamless integration

### Request Flow Example
```
User: gemini --model gpt-4 --prompt "Hello"
  ↓
CLI detects: OpenAI provider
  ↓
Routes to: https://api.openai.com/v1/chat/completions
  ↓
Sends: {"model": "gpt-4", "messages": [{"role": "user", "content": "Hello"}]}
  ↓
Receives OpenAI response and converts to Gemini format
  ↓
Returns to user
```

## Features

### ✅ Supported Features
- **Direct API routing** to third-party baseUrls (not proxied through Google)
- Text generation and conversation
- Streaming responses 
- Token counting (estimated for third-party providers)
- Temperature, top_p, and max_tokens configuration
- Provider-specific authentication (Bearer tokens, API keys)
- Request/response format conversion

### 🚧 Limitations
- Embeddings not yet implemented for third-party providers
- Token counting is estimated (not exact)
- Function/tool calling conversion in progress
- Some provider-specific features may not be available

## Examples

### Basic Usage
```bash
# Start a conversation with GPT-4
gemini --model gpt-4

# Use Claude for a specific prompt
gemini --model claude-3-5-sonnet-20241022 --prompt "Explain quantum computing"
```

### With Environment Variables
```bash
# Set up environment
export OPENAI_API_KEY="sk-your-key"
export ANTHROPIC_API_KEY="sk-ant-your-key"

# Use different models
gemini --model gpt-4o
gemini --model claude-3-5-haiku-20241022
```

### Custom Endpoint Example
```bash
export CUSTOM_API_KEY="your-key"
export CUSTOM_ENDPOINT="https://your-ai-service.com/v1"

# Configure in settings.json with custom model mapping
# Then use:
gemini --model your-custom-model
```

## Troubleshooting

### Authentication Errors
- Ensure your API keys are correctly set
- Check that environment variables are exported in your current shell
- Verify your API keys have the necessary permissions

### Model Not Found
- Check that the model name is exactly as specified in the supported models list
- For custom models, ensure they're properly configured in settings.json

### Connection Issues
- Verify your internet connection
- Check if the provider's API is accessible from your network
- For custom endpoints, ensure the URL is correct and accessible

## Migration from Google-only Version

If you're migrating from the original Google-only version:

1. Your existing Gemini API keys and configurations will continue to work
2. Add third-party provider configurations as needed
3. Use the `--model` flag to switch between providers
4. All existing tools and features continue to work with third-party providers

## 🎯 **Complete Configuration Summary**

### **How to Set BaseURL & API Key - 4 Methods:**

| Method | When to Use | Commands |
|--------|-------------|----------|
| **1. Interactive CLI** | First-time setup, user-friendly | `/config set openai apikey sk-key` |
| **2. Environment Variables** | Development, automation | `export OPENAI_API_KEY="sk-key"` |
| **3. settings.json** | Team settings, advanced config | Edit `.gemini/settings.json` |
| **4. Auto-Detection** | Just works! | `gemini --model gpt-4` |

### **Interactive Configuration (In Gemini CLI Menu):**
```bash
gemini              # Start CLI
/config             # Show configuration help  
/config show        # Display current settings
/config set openai apikey YOUR_KEY
/config set custom baseurl https://your-ai.com/v1
```

### **User Can Provide BaseURL & API Key:**
- ✅ **Yes!** Users can provide both baseURL and API key
- ✅ **Interactive:** Use `/config` commands inside CLI
- ✅ **Environment:** Set `CUSTOM_ENDPOINT` and `CUSTOM_API_KEY`
- ✅ **File-based:** Configure in `.gemini/settings.json`

### **Real Request Routing:**
- **OpenAI models** → `https://api.openai.com/v1/chat/completions`
- **Anthropic models** → `https://api.anthropic.com/v1/messages`  
- **Custom models** → `YOUR_CUSTOM_BASEURL/chat/completions`

## Contributing

This implementation provides a foundation for third-party provider support. Contributions are welcome for:

- Additional provider support
- Improved token counting
- Provider-specific optimizations
- Enhanced error handling
- Embedding support for third-party providers 
