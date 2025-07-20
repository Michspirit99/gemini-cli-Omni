/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { MessageActionReturn, SlashCommand } from './types.js';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

export const configCommand: SlashCommand = {
  name: 'config',
  description: 'configure third-party providers (OpenAI, Anthropic, custom endpoints)',
  action: (context, args): MessageActionReturn => {
    const subCommand = args?.trim().split(' ')[0]?.toLowerCase();

    if (subCommand === 'show' || subCommand === 'list') {
      return showCurrentConfig(context);
    }

    if (subCommand === 'set') {
      const parts = args?.trim().split(' ');
      if (parts && parts.length >= 4) {
        const provider = parts[1]?.toLowerCase();
        const key = parts[2]?.toLowerCase();
        const value = parts.slice(3).join(' ');
        return setConfigValue(context, provider, key, value);
      }
    }
    
    // Default: show help
    return showConfigHelp();
  },
};

function showConfigHelp(): MessageActionReturn {
  const helpText = `
## Third-Party Provider Configuration

### Quick Setup Commands:
\`\`\`bash
# Set OpenAI API key
/config set openai apikey sk-your-openai-key

# Set Anthropic API key  
/config set anthropic apikey sk-ant-your-anthropic-key

# Set custom endpoint
/config set custom baseurl https://your-ai-service.com/v1
/config set custom apikey your-custom-key

# Show current configuration
/config show
\`\`\`

### Environment Variables (Alternative):
\`\`\`bash
export OPENAI_API_KEY="sk-your-key"
export ANTHROPIC_API_KEY="sk-ant-your-key"
export CUSTOM_ENDPOINT="https://your-endpoint.com/v1"
export CUSTOM_API_KEY="your-key"
\`\`\`

### Usage:
\`\`\`bash
# Use third-party models
gemini --model gpt-4 --prompt "Hello"
gemini --model claude-3-5-sonnet-20241022 --prompt "Hello" 
\`\`\`

### Supported Models:
- **OpenAI**: gpt-4, gpt-4o, gpt-4-turbo, gpt-3.5-turbo
- **Anthropic**: claude-3-5-sonnet-20241022, claude-3-opus-20240229
- **Custom**: Any model name (configure endpoint first)
`;

  return {
    type: 'message',
    messageType: 'info',
    content: helpText,
  };
}

function showCurrentConfig(context: any): MessageActionReturn {
  const envVars = {
    'OPENAI_API_KEY': process.env.OPENAI_API_KEY ? '***set***' : 'not set',
    'ANTHROPIC_API_KEY': process.env.ANTHROPIC_API_KEY ? '***set***' : 'not set', 
    'CUSTOM_ENDPOINT': process.env.CUSTOM_ENDPOINT || 'not set',
    'CUSTOM_API_KEY': process.env.CUSTOM_API_KEY ? '***set***' : 'not set',
  };

  let configFile = 'No .gemini/settings.json found';
  try {
    const settingsPath = path.join(process.cwd(), '.gemini', 'settings.json');
    if (fs.existsSync(settingsPath)) {
      const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
      if (settings.thirdPartyProviders) {
        configFile = `Found settings.json with providers: ${Object.keys(settings.thirdPartyProviders).join(', ')}`;
      } else {
        configFile = 'settings.json exists but no thirdPartyProviders configured';
      }
    }
  } catch (error) {
    configFile = 'Error reading settings.json';
  }

  const configText = `
## Current Third-Party Configuration

### Environment Variables:
- **OPENAI_API_KEY**: ${envVars.OPENAI_API_KEY}
- **ANTHROPIC_API_KEY**: ${envVars.ANTHROPIC_API_KEY}
- **CUSTOM_ENDPOINT**: ${envVars.CUSTOM_ENDPOINT}
- **CUSTOM_API_KEY**: ${envVars.CUSTOM_API_KEY}

### Configuration File:
- **Settings**: ${configFile}

### Current Model:
- **Active Model**: ${context.services.config?.getModel() || 'Unknown'}

### Quick Setup:
Use \`/config\` to see setup commands or set environment variables directly.
`;

  return {
    type: 'message',
    messageType: 'info',
    content: configText,
  };
}

function setConfigValue(context: any, provider: string, key: string, value: string): MessageActionReturn {
  if (!['openai', 'anthropic', 'custom'].includes(provider)) {
    return {
      type: 'message',
      messageType: 'error',
      content: `Invalid provider: ${provider}. Use: openai, anthropic, or custom`,
    };
  }

  // For simplicity, we'll provide instructions rather than direct file modification
  const instructions = getSetupInstructions(provider, key, value);
  
  return {
    type: 'message',
    messageType: 'info',
    content: instructions,
  };
}

function getSetupInstructions(provider: string, key: string, value: string): string {
  const envVarMap: Record<string, string> = {
    'openai-apikey': 'OPENAI_API_KEY',
    'anthropic-apikey': 'ANTHROPIC_API_KEY', 
    'custom-apikey': 'CUSTOM_API_KEY',
    'custom-baseurl': 'CUSTOM_ENDPOINT',
  };

  const envVar = envVarMap[`${provider}-${key}`];
  
  if (envVar) {
    return `
## Configuration Instructions

### Option 1: Set Environment Variable
\`\`\`bash
export ${envVar}="${value}"
\`\`\`

### Option 2: Add to .gemini/settings.json
\`\`\`json
{
  "thirdPartyProviders": {
    "${provider}": {
      "${key === 'apikey' ? 'apiKey' : 'baseUrl'}": "${value}"
    }
  }
}
\`\`\`

### Next Steps:
1. Restart your terminal (for environment variables)
2. Discover models: \`/config models ${provider}\`
3. Test with: \`gemini --model ${provider === 'openai' ? 'gpt-4' : provider === 'anthropic' ? 'claude-3-5-sonnet-20241022' : 'your-model'}\`
`;
  }

  return `
## Invalid Configuration

Valid combinations:
- \`/config set openai apikey YOUR_KEY\`
- \`/config set anthropic apikey YOUR_KEY\`
- \`/config set custom apikey YOUR_KEY\`
- \`/config set custom baseurl YOUR_ENDPOINT\`

Available commands:
- \`/config models <provider>\` - Discover available models
- \`/config show\` - Show current configuration
`;
} 
