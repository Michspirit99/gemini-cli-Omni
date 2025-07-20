/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { AuthType } from '@google/gemini-cli-core';
import { loadEnvironment } from './settings.js';

export const validateAuthMethod = (authMethod: string): string | null => {
  loadEnvironment();
  
  // Allow skipping validation for third-party providers if explicitly requested
  if (process.env.GEMINI_SKIP_AUTH_VALIDATION === 'true') {
    return null;
  }
  if (
    authMethod === AuthType.LOGIN_WITH_GOOGLE ||
    authMethod === AuthType.CLOUD_SHELL
  ) {
    return null;
  }

  if (authMethod === AuthType.USE_GEMINI) {
    if (!process.env.GEMINI_API_KEY) {
      return 'GEMINI_API_KEY environment variable not found. Add that to your environment and try again (no reload needed if using .env)!';
    }
    return null;
  }

  if (authMethod === AuthType.USE_VERTEX_AI) {
    const hasVertexProjectLocationConfig =
      !!process.env.GOOGLE_CLOUD_PROJECT && !!process.env.GOOGLE_CLOUD_LOCATION;
    const hasGoogleApiKey = !!process.env.GOOGLE_API_KEY;
    if (!hasVertexProjectLocationConfig && !hasGoogleApiKey) {
      return (
        'When using Vertex AI, you must specify either:\n' +
        '• GOOGLE_CLOUD_PROJECT and GOOGLE_CLOUD_LOCATION environment variables.\n' +
        '• GOOGLE_API_KEY environment variable (if using express mode).\n' +
        'Update your environment and try again (no reload needed if using .env)!'
      );
    }
    return null;
  }

  // Third-party provider support
  if (authMethod === AuthType.USE_OPENAI) {
    if (!process.env.OPENAI_API_KEY) {
      return (
        'Set your OpenAI API key:\n' +
        '\n' +
        'Windows (PowerShell):\n' +
        '  $env:OPENAI_API_KEY="sk-your-openai-key"\n' +
        '\n' +
        'macOS/Linux:\n' +
        '  export OPENAI_API_KEY="sk-your-openai-key"\n' +
        '\n' +
        'Get your API key from: https://platform.openai.com/api-keys\n' +
        'Then restart gemini.'
      );
    }
    return null;
  }

  if (authMethod === AuthType.USE_ANTHROPIC) {
    if (!process.env.ANTHROPIC_API_KEY) {
      return (
        'Set your Anthropic API key:\n' +
        '\n' +
        'Windows (PowerShell):\n' +
        '  $env:ANTHROPIC_API_KEY="sk-ant-your-anthropic-key"\n' +
        '\n' +
        'macOS/Linux:\n' +
        '  export ANTHROPIC_API_KEY="sk-ant-your-anthropic-key"\n' +
        '\n' +
        'Get your API key from: https://console.anthropic.com/\n' +
        'Then restart gemini.'
      );
    }
    return null;
  }

  if (authMethod === AuthType.USE_CUSTOM) {
    if (!process.env.CUSTOM_API_KEY || !process.env.CUSTOM_ENDPOINT) {
      return (
        'For custom endpoints, set these environment variables:\n' +
        '\n' +
        'Windows (PowerShell):\n' +
        '  $env:CUSTOM_API_KEY="your-api-key"\n' +
        '  $env:CUSTOM_ENDPOINT="https://your-ai-service.com/v1"\n' +
        '\n' +
        'macOS/Linux:\n' +
        '  export CUSTOM_API_KEY="your-api-key"\n' +
        '  export CUSTOM_ENDPOINT="https://your-ai-service.com/v1"\n' +
        '\n' +
        'Then restart gemini or use /config commands after authentication.'
      );
    }
    return null;
  }

  return 'Invalid auth method selected.';
};
