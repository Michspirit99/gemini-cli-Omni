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
  Content,
  Part,
} from '@google/genai';
import { ContentGenerator, ContentGeneratorConfig } from './contentGenerator.js';

/**
 * Content generator for third-party providers that actually routes to their endpoints
 */
export class ThirdPartyContentGenerator implements ContentGenerator {
  private baseUrl: string;
  private apiKey: string;
  private provider: string;
  private customHeaders: Record<string, string>;

  constructor(config: ContentGeneratorConfig) {
    this.baseUrl = config.baseUrl!;
    this.apiKey = config.apiKey!;
    this.provider = config.provider!;
    this.customHeaders = config.customHeaders || {};
  }

  async generateContent(
    request: GenerateContentParameters,
  ): Promise<GenerateContentResponse> {
    const response = await this.makeThirdPartyRequest(request, false);
    return this.convertToGeminiFormat(response, request.model);
  }

  async generateContentStream(
    request: GenerateContentParameters,
  ): Promise<AsyncGenerator<GenerateContentResponse>> {
    const self = this;
    
    return (async function* () {
      const response = await self.makeThirdPartyRequest(request, true);
      
      if (response && response.body) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            const chunk = decoder.decode(value);
            const lines = chunk.split('\n').filter(line => line.trim());
            
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6);
                if (data === '[DONE]') break;
                
                try {
                  const parsed = JSON.parse(data);
                  yield self.convertToGeminiFormat(parsed, request.model);
                } catch (e) {
                  // Skip invalid JSON
                }
              }
            }
          }
        } finally {
          reader.releaseLock();
        }
      }
    })();
  }

  async countTokens(request: CountTokensParameters): Promise<CountTokensResponse> {
    // Simple estimation for third-party providers
    const text = this.extractTextFromRequest(request);
    const estimatedTokens = Math.ceil(text.length / 4); // Rough estimate
    
    return {
      totalTokens: estimatedTokens,
    };
  }

  async embedContent(request: EmbedContentParameters): Promise<EmbedContentResponse> {
    throw new Error(`Embeddings not yet implemented for provider: ${this.provider}`);
  }

  private async makeThirdPartyRequest(request: GenerateContentParameters, stream: boolean): Promise<any> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...this.customHeaders,
    };

    // Add provider-specific headers
    if (this.provider === 'openai') {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    } else if (this.provider === 'anthropic') {
      headers['x-api-key'] = this.apiKey;
      headers['anthropic-version'] = '2023-06-01';
    } else {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    const body = this.convertRequestToProviderFormat(request, stream);
    const url = this.getProviderEndpoint();

    // Debug logging
    console.log(`========== THIRD PARTY REQUEST ==========`);
    console.log(`URL: ${url}`);
    console.log(`Provider: ${this.provider}`);
    console.log(`Base URL: ${this.baseUrl}`);
    console.log(`Model: ${request.model}`);
    console.log(`Headers:`, JSON.stringify(headers, null, 2));
    console.log(`Request body:`, JSON.stringify(body, null, 2));
    console.log(`==========================================`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      console.log(`========== THIRD PARTY RESPONSE ==========`);
      console.log(`Status: ${response.status} ${response.statusText}`);
      console.log(`Headers:`, Object.fromEntries(response.headers.entries()));
      console.log(`==========================================`);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`========== API ERROR ==========`);
        console.error(`Status: ${response.status} ${response.statusText}`);
        console.error(`Error Response:`, errorText);
        console.error(`===============================`);
        throw new Error(`${this.provider} API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const result = await this.handleResponse(response, stream);
      console.log(`========== RESPONSE PROCESSED ==========`);
      console.log(`Response type:`, typeof result);
      console.log(`Response size:`, JSON.stringify(result).length, 'characters');
      console.log(`=======================================`);
      return result;
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error(`Request timeout after 30 seconds to ${url}`);
      }
      throw error;
    }
  }

  private async handleResponse(response: Response, stream: boolean): Promise<any> {
    if (stream) {
      return response;
    }

    return response.json();
  }

  private getProviderEndpoint(): string {
    // Ensure baseUrl doesn't end with trailing slash
    const cleanBaseUrl = this.baseUrl.replace(/\/$/, '');
    
    if (this.provider === 'openai') {
      return `${cleanBaseUrl}/chat/completions`;
    } else if (this.provider === 'anthropic') {
      return `${cleanBaseUrl}/v1/messages`;
    } else {
      // Custom provider - assume OpenAI-like format
      // Check if baseUrl already includes the path
      if (cleanBaseUrl.includes('/chat/completions')) {
        return cleanBaseUrl;
      }
      return `${cleanBaseUrl}/chat/completions`;
    }
  }

  private convertRequestToProviderFormat(request: GenerateContentParameters, stream: boolean): any {
    // Extract text from Gemini request - simplified for now
    const prompt = this.extractPromptFromRequest(request);
    const systemPrompt = this.extractSystemPromptFromRequest(request);
    
    if (this.provider === 'openai') {
      const messages: any[] = [];
      if (systemPrompt) {
        messages.push({ role: 'system', content: systemPrompt });
      }
      messages.push({ role: 'user', content: prompt });

      return {
        model: request.model,
        messages,
        stream,
        temperature: (request as any).generationConfig?.temperature || 0,
        max_tokens: (request as any).generationConfig?.maxOutputTokens,
        top_p: (request as any).generationConfig?.topP,
      };
    } else if (this.provider === 'anthropic') {
      const messages = [{ role: 'user', content: prompt }];
      
      return {
        model: request.model,
        messages,
        system: systemPrompt,
        stream,
        max_tokens: (request as any).generationConfig?.maxOutputTokens || 4096,
        temperature: (request as any).generationConfig?.temperature || 0,
        top_p: (request as any).generationConfig?.topP,
      };
    } else {
      // Custom provider - assume OpenAI-like format
      const messages: any[] = [];
      if (systemPrompt) {
        messages.push({ role: 'system', content: systemPrompt });
      }
      messages.push({ role: 'user', content: prompt });

      const requestBody = {
        model: request.model,
        messages,
        stream,
        temperature: (request as any).generationConfig?.temperature || 0.7,
        max_tokens: (request as any).generationConfig?.maxOutputTokens || 2048,
        top_p: (request as any).generationConfig?.topP || 1,
      };

      // Remove undefined values that might cause issues
      Object.keys(requestBody).forEach(key => {
        if ((requestBody as any)[key] === undefined) {
          delete (requestBody as any)[key];
        }
      });

      return requestBody;
    }
  }

  private convertToGeminiFormat(response: any, model: string): GenerateContentResponse {
    console.log(`========== CONVERTING RESPONSE ==========`);
    console.log(`Provider: ${this.provider}`);
    console.log(`Model: ${model}`);
    console.log(`Raw response:`, JSON.stringify(response, null, 2));
    console.log(`=========================================`);

    if (this.provider === 'openai' || this.provider === 'custom') {
      const choice = response.choices?.[0];
      if (!choice) {
        console.error(`No choices found in response:`, response);
        throw new Error(`No choices in ${this.provider} response`);
      }
      
      console.log(`First choice:`, JSON.stringify(choice, null, 2));
      
      const parts: Part[] = [];
      if (choice.message?.content) {
        parts.push({ text: choice.message.content });
      }
      
      const convertedResponse = {
        candidates: [{
          content: {
            parts,
            role: 'model',
          },
          finishReason: this.mapFinishReason(choice.finish_reason),
        }],
        usageMetadata: response.usage ? {
          promptTokenCount: response.usage.prompt_tokens,
          candidatesTokenCount: response.usage.completion_tokens,
          totalTokenCount: response.usage.total_tokens,
        } : undefined,
      } as GenerateContentResponse;

      console.log(`Converted to Gemini format:`, JSON.stringify(convertedResponse, null, 2));
      return convertedResponse;
    } else if (this.provider === 'anthropic') {
      const parts: Part[] = [];
      
      if (response.content) {
        for (const content of response.content) {
          if (content.type === 'text') {
            parts.push({ text: content.text });
          }
        }
      }
      
      return {
        candidates: [{
          content: {
            parts,
            role: 'model',
          },
          finishReason: this.mapFinishReason(response.stop_reason),
        }],
        usageMetadata: response.usage ? {
          promptTokenCount: response.usage.input_tokens,
          candidatesTokenCount: response.usage.output_tokens,
          totalTokenCount: response.usage.input_tokens + response.usage.output_tokens,
        } : undefined,
      } as GenerateContentResponse;
    }

    // Fallback
    return {
      candidates: [{
        content: {
          parts: [{ text: 'Error converting response' }],
          role: 'model',
        },
        finishReason: 'OTHER' as any,
      }],
    } as GenerateContentResponse;
  }

  private extractPromptFromRequest(request: GenerateContentParameters): string {
    // Simplified extraction - get the last user message
    if (typeof request.contents === 'string') {
      return request.contents;
    }
    
    if (Array.isArray(request.contents)) {
      for (let i = request.contents.length - 1; i >= 0; i--) {
        const content = request.contents[i];
        if (content && typeof content === 'object' && 'role' in content && content.role === 'user') {
          return this.extractTextFromContent(content);
        }
      }
    }
    
    return 'No prompt found';
  }

  private extractSystemPromptFromRequest(request: GenerateContentParameters): string | undefined {
    if (Array.isArray(request.contents)) {
      for (const content of request.contents) {
        if (content && typeof content === 'object' && 'role' in content && content.role === 'system') {
          return this.extractTextFromContent(content);
        }
      }
    }
    return undefined;
  }

  private extractTextFromContent(content: Content): string {
    if (!content.parts) return '';
    
    return content.parts
      .filter(part => part && typeof part === 'object' && 'text' in part)
      .map(part => (part as any).text)
      .join(' ');
  }

  private extractTextFromRequest(request: CountTokensParameters): string {
    if (typeof request.contents === 'string') {
      return request.contents;
    }
    
    if (Array.isArray(request.contents)) {
      return request.contents
        .filter(content => content && typeof content === 'object')
        .map(content => this.extractTextFromContent(content as Content))
        .join(' ');
    }
    
    return '';
  }

  private mapFinishReason(reason: string): any {
    switch (reason) {
      case 'stop':
      case 'end_turn':
        return 'STOP';
      case 'length':
      case 'max_tokens':
        return 'MAX_TOKENS';
      case 'tool_calls':
      case 'tool_use':
        return 'STOP';
      case 'content_filter':
        return 'SAFETY';
      default:
        return 'OTHER';
    }
  }
} 
