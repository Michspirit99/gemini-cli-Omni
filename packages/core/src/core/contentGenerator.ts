/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  CountTokensResponse,
  GenerateContentResponse,
  GenerateContentParameters,
  CountTokensParameters,
  EmbedContentResponse,
  EmbedContentParameters,
  GoogleGenAI,
} from '@google/genai';
import { createCodeAssistContentGenerator } from '../code_assist/codeAssist.js';
import { DEFAULT_GEMINI_MODEL, isThirdPartyModel, getModelConfig } from '../config/models.js';
import { Config } from '../config/config.js';
import { getEffectiveModel } from './modelCheck.js';
import { UserTierId } from '../code_assist/types.js';

/**
 * Interface abstracting the core functionalities for generating content and counting tokens.
 */
export interface ContentGenerator {
  generateContent(
    request: GenerateContentParameters,
  ): Promise<GenerateContentResponse>;

  generateContentStream(
    request: GenerateContentParameters,
  ): Promise<AsyncGenerator<GenerateContentResponse>>;

  countTokens(request: CountTokensParameters): Promise<CountTokensResponse>;

  embedContent(request: EmbedContentParameters): Promise<EmbedContentResponse>;

  getTier?(): Promise<UserTierId | undefined>;
}

export enum AuthType {
  LOGIN_WITH_GOOGLE = 'oauth-personal',
  USE_GEMINI = 'gemini-api-key',
  USE_VERTEX_AI = 'vertex-ai',
  CLOUD_SHELL = 'cloud-shell',
  USE_OPENAI = 'openai-api-key',
  USE_ANTHROPIC = 'anthropic-api-key',
  USE_CUSTOM = 'custom-endpoint',
}

export type ContentGeneratorConfig = {
  model: string;
  apiKey?: string;
  vertexai?: boolean;
  authType?: AuthType | undefined;
  proxy?: string | undefined;
  // Third-party provider configuration
  baseUrl?: string;
  provider?: 'google' | 'openai' | 'anthropic' | 'custom';
  customHeaders?: Record<string, string>;
};

export function createContentGeneratorConfig(
  config: Config,
  authType: AuthType | undefined,
): ContentGeneratorConfig {
  const geminiApiKey = process.env.GEMINI_API_KEY || undefined;
  const googleApiKey = process.env.GOOGLE_API_KEY || undefined;
  const googleCloudProject = process.env.GOOGLE_CLOUD_PROJECT || undefined;
  const googleCloudLocation = process.env.GOOGLE_CLOUD_LOCATION || undefined;
  
  // Third-party provider environment variables
  const openaiApiKey = process.env.OPENAI_API_KEY || undefined;
  const anthropicApiKey = process.env.ANTHROPIC_API_KEY || undefined;
  const customEndpoint = process.env.CUSTOM_ENDPOINT || undefined;
  const customApiKey = process.env.CUSTOM_API_KEY || undefined;

  // Use runtime model from config if available, otherwise fallback to parameter or default
  const effectiveModel = config.getModel() || DEFAULT_GEMINI_MODEL;
  
  console.log('========== CONTENT GENERATOR ENVIRONMENT CHECK ==========');
  console.log(`authType: ${authType}`);
  console.log(`effectiveModel: ${effectiveModel}`);
  console.log(`customEndpoint: ${customEndpoint}`);
  console.log(`customApiKey: ${customApiKey ? `${customApiKey.substring(0, 8)}...` : 'undefined'}`);
  console.log('========================================================');

  // Auto-detect provider based on model if authType is not explicitly set
  let resolvedAuthType = authType;
  if (!authType && isThirdPartyModel(effectiveModel)) {
    const modelConfig = getModelConfig(effectiveModel);
    if (modelConfig) {
      switch (modelConfig.provider) {
        case 'openai':
          resolvedAuthType = AuthType.USE_OPENAI;
          break;
        case 'anthropic':
          resolvedAuthType = AuthType.USE_ANTHROPIC;
          break;
      }
    }
  }

  const contentGeneratorConfig: ContentGeneratorConfig = {
    model: effectiveModel,
    authType: resolvedAuthType,
    proxy: config?.getProxy(),
  };

  console.log(`Content generator config: model=${effectiveModel}, authType=${resolvedAuthType}`);

  // Auto-configure third-party provider settings based on model
  if (isThirdPartyModel(effectiveModel)) {
    const modelConfig = getModelConfig(effectiveModel);
    if (modelConfig) {
      contentGeneratorConfig.provider = modelConfig.provider;
      contentGeneratorConfig.baseUrl = modelConfig.baseUrl;
    }
  }

  // If we are using Google auth or we are in Cloud Shell, there is nothing else to validate for now
  if (
    resolvedAuthType === AuthType.LOGIN_WITH_GOOGLE ||
    resolvedAuthType === AuthType.CLOUD_SHELL
  ) {
    return contentGeneratorConfig;
  }

  if (resolvedAuthType === AuthType.USE_GEMINI && geminiApiKey) {
    contentGeneratorConfig.apiKey = geminiApiKey;
    contentGeneratorConfig.vertexai = false;
    contentGeneratorConfig.provider = 'google';
    getEffectiveModel(
      contentGeneratorConfig.apiKey,
      contentGeneratorConfig.model,
      contentGeneratorConfig.proxy,
    );

    return contentGeneratorConfig;
  }

  if (
    resolvedAuthType === AuthType.USE_VERTEX_AI &&
    (googleApiKey || (googleCloudProject && googleCloudLocation))
  ) {
    contentGeneratorConfig.apiKey = googleApiKey;
    contentGeneratorConfig.vertexai = true;
    contentGeneratorConfig.provider = 'google';

    return contentGeneratorConfig;
  }

  // Third-party provider configurations
  if (resolvedAuthType === AuthType.USE_OPENAI && openaiApiKey) {
    contentGeneratorConfig.apiKey = openaiApiKey;
    contentGeneratorConfig.provider = 'openai';
    contentGeneratorConfig.baseUrl = 'https://api.openai.com/v1';
    return contentGeneratorConfig;
  }

  if (resolvedAuthType === AuthType.USE_ANTHROPIC && anthropicApiKey) {
    contentGeneratorConfig.apiKey = anthropicApiKey;
    contentGeneratorConfig.provider = 'anthropic';
    contentGeneratorConfig.baseUrl = 'https://api.anthropic.com';
    return contentGeneratorConfig;
  }

  if (resolvedAuthType === AuthType.USE_CUSTOM && customApiKey && customEndpoint) {
    contentGeneratorConfig.apiKey = customApiKey;
    contentGeneratorConfig.provider = 'custom';
    contentGeneratorConfig.baseUrl = customEndpoint;
    return contentGeneratorConfig;
  }

  return contentGeneratorConfig;
}

export async function createContentGenerator(
  config: ContentGeneratorConfig,
  gcConfig: Config,
  sessionId?: string,
): Promise<ContentGenerator> {
  const version = process.env.CLI_VERSION || process.version;
  const httpOptions = {
    headers: {
      'User-Agent': `GeminiCLI/${version} (${process.platform}; ${process.arch})`,
    },
  };
  if (
    config.authType === AuthType.LOGIN_WITH_GOOGLE ||
    config.authType === AuthType.CLOUD_SHELL
  ) {
    return createCodeAssistContentGenerator(
      httpOptions,
      config.authType,
      gcConfig,
      sessionId,
    );
  }

  if (
    config.authType === AuthType.USE_GEMINI ||
    config.authType === AuthType.USE_VERTEX_AI
  ) {
    const googleGenAI = new GoogleGenAI({
      apiKey: config.apiKey === '' ? undefined : config.apiKey,
      vertexai: config.vertexai,
      httpOptions,
    });

    return googleGenAI.models;
  }

  // Handle third-party providers with actual routing to their endpoints
  if (
    config.authType === AuthType.USE_OPENAI ||
    config.authType === AuthType.USE_ANTHROPIC ||
    config.authType === AuthType.USE_CUSTOM
  ) {
    console.log(`Using ThirdPartyContentGenerator for auth type: ${config.authType}, model: ${config.model}`);
    const { ThirdPartyContentGenerator } = await import('./thirdPartyContentGenerator.js');
    return new ThirdPartyContentGenerator(config);
  }

  throw new Error(
    `Error creating contentGenerator: Unsupported authType: ${config.authType}`,
  );
}
