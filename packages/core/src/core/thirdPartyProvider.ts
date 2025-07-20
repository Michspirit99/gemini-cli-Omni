/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { ContentGeneratorConfig } from './contentGenerator.js';

/**
 * Third-party provider configuration and utilities
 */
export interface ThirdPartyConfig {
  provider: 'openai' | 'anthropic' | 'custom';
  apiKey: string;
  baseUrl: string;
  headers?: Record<string, string>;
}

/**
 * Creates a third-party provider configuration from the content generator config
 */
export function createThirdPartyConfig(config: ContentGeneratorConfig): ThirdPartyConfig | null {
  if (!config.provider || !config.baseUrl || !config.apiKey) {
    return null;
  }

  return {
    provider: config.provider as 'openai' | 'anthropic' | 'custom',
    apiKey: config.apiKey,
    baseUrl: config.baseUrl,
    headers: config.customHeaders,
  };
}

/**
 * Converts Gemini-style messages to OpenAI format
 */
export function convertToOpenAIFormat(prompt: string, systemPrompt?: string) {
  const messages: any[] = [];
  
  if (systemPrompt) {
    messages.push({ role: 'system', content: systemPrompt });
  }
  
  messages.push({ role: 'user', content: prompt });
  
  return messages;
}

/**
 * Converts Gemini-style messages to Anthropic format
 */
export function convertToAnthropicFormat(prompt: string, systemPrompt?: string) {
  const messages = [{ role: 'user', content: prompt }];
  
  return {
    messages,
    system: systemPrompt,
  };
}

/**
 * Makes a direct API call to a third-party provider
 */
export async function callThirdPartyAPI(
  config: ThirdPartyConfig,
  prompt: string,
  model: string,
  systemPrompt?: string,
  options?: {
    temperature?: number;
    maxTokens?: number;
    topP?: number;
  }
): Promise<string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...config.headers,
  };

  // Add provider-specific authentication
  if (config.provider === 'openai') {
    headers['Authorization'] = `Bearer ${config.apiKey}`;
  } else if (config.provider === 'anthropic') {
    headers['x-api-key'] = config.apiKey;
    headers['anthropic-version'] = '2023-06-01';
  } else {
    headers['Authorization'] = `Bearer ${config.apiKey}`;
  }

  let body: any;
  let endpoint: string;

  if (config.provider === 'openai') {
    endpoint = `${config.baseUrl}/chat/completions`;
    body = {
      model,
      messages: convertToOpenAIFormat(prompt, systemPrompt),
      temperature: options?.temperature ?? 0,
      max_tokens: options?.maxTokens,
      top_p: options?.topP,
    };
  } else if (config.provider === 'anthropic') {
    endpoint = `${config.baseUrl}/v1/messages`;
    const formatted = convertToAnthropicFormat(prompt, systemPrompt);
    body = {
      model,
      messages: formatted.messages,
      system: formatted.system,
      max_tokens: options?.maxTokens ?? 4096,
      temperature: options?.temperature ?? 0,
      top_p: options?.topP,
    };
  } else {
    // Custom provider - assume OpenAI-like format
    endpoint = `${config.baseUrl}/chat/completions`;
    body = {
      model,
      messages: convertToOpenAIFormat(prompt, systemPrompt),
      temperature: options?.temperature ?? 0,
      max_tokens: options?.maxTokens,
      top_p: options?.topP,
    };
  }

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`${config.provider} API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();

    // Extract response based on provider
    if (config.provider === 'openai' || config.provider === 'custom') {
      return data.choices?.[0]?.message?.content || '';
    } else if (config.provider === 'anthropic') {
      return data.content?.[0]?.text || '';
    }

    return '';
  } catch (error) {
    throw new Error(`Failed to call ${config.provider} API: ${error}`);
  }
}

/**
 * Utility to check if a model is a third-party model
 */
export function isThirdPartyModel(model: string): boolean {
  const thirdPartyPrefixes = ['gpt-', 'claude-', 'custom-'];
  return thirdPartyPrefixes.some(prefix => model.startsWith(prefix));
} 
