/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export const DEFAULT_GEMINI_MODEL = 'gemini-2.5-pro';
export const DEFAULT_GEMINI_FLASH_MODEL = 'gemini-2.5-flash';
export const DEFAULT_GEMINI_EMBEDDING_MODEL = 'gemini-embedding-001';

// Third-party model definitions
export const OPENAI_MODELS = {
  'gpt-4': { baseUrl: 'https://api.openai.com/v1', provider: 'openai' as const },
  'gpt-4-turbo': { baseUrl: 'https://api.openai.com/v1', provider: 'openai' as const },
  'gpt-3.5-turbo': { baseUrl: 'https://api.openai.com/v1', provider: 'openai' as const },
  'gpt-4o': { baseUrl: 'https://api.openai.com/v1', provider: 'openai' as const },
  'gpt-4o-mini': { baseUrl: 'https://api.openai.com/v1', provider: 'openai' as const },
} as const;

export const ANTHROPIC_MODELS = {
  'claude-3-opus-20240229': { baseUrl: 'https://api.anthropic.com', provider: 'anthropic' as const },
  'claude-3-sonnet-20240229': { baseUrl: 'https://api.anthropic.com', provider: 'anthropic' as const },
  'claude-3-haiku-20240307': { baseUrl: 'https://api.anthropic.com', provider: 'anthropic' as const },
  'claude-3-5-sonnet-20241022': { baseUrl: 'https://api.anthropic.com', provider: 'anthropic' as const },
  'claude-3-5-haiku-20241022': { baseUrl: 'https://api.anthropic.com', provider: 'anthropic' as const },
} as const;

export const THIRD_PARTY_MODELS = {
  ...OPENAI_MODELS,
  ...ANTHROPIC_MODELS,
} as const;

export type ThirdPartyModelName = keyof typeof THIRD_PARTY_MODELS;

export function isThirdPartyModel(model: string): model is ThirdPartyModelName {
  return model in THIRD_PARTY_MODELS;
}

export function getModelConfig(model: string) {
  if (isThirdPartyModel(model)) {
    return THIRD_PARTY_MODELS[model];
  }
  return null;
}
