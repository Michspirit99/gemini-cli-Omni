/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';
import { Colors } from '../colors.js';
import { SettingScope } from '../../config/settings.js';
import { AuthType } from '@google/gemini-cli-core';

interface CustomEndpointDialogProps {
  onComplete: (baseUrl: string, apiKey: string, selectedModel?: string) => void;
  onCancel: () => void;
}

type Step = 'baseurl' | 'apikey' | 'validating' | 'models' | 'finalizing';

interface ModelInfo {
  id: string;
  object?: string;
  created?: number;
  owned_by?: string;
}

const isValidUrl = (url: string): boolean => {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
};

const isValidApiKey = (key: string): boolean => {
  return key.trim().length >= 8; // Basic validation
};

const discoverModels = async (baseUrl: string, apiKey: string): Promise<ModelInfo[]> => {
  try {
    // Clean base URL and construct models endpoint
    const cleanBaseUrl = baseUrl.replace(/\/$/, '');
    const modelsUrl = `${cleanBaseUrl}/models`;
    
    const response = await fetch(modelsUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    
    // Handle OpenAI-style response
    if (data.data && Array.isArray(data.data)) {
      return data.data;
    }
    
    // Handle direct array response
    if (Array.isArray(data)) {
      return data;
    }
    
    // Handle other formats - try to extract model list
    if (data.models && Array.isArray(data.models)) {
      return data.models;
    }
    
    return [];
  } catch (error) {
    console.error('Model discovery failed:', error);
    return [];
  }
};

export function CustomEndpointDialog({
  onComplete,
  onCancel,
}: CustomEndpointDialogProps): React.JSX.Element {
  const [step, setStep] = useState<Step>('baseurl');
  const [baseUrl, setBaseUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [inputValue, setInputValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [availableModels, setAvailableModels] = useState<ModelInfo[]>([]);
  const [selectedModelIndex, setSelectedModelIndex] = useState(0);
  const [modelDiscoveryFailed, setModelDiscoveryFailed] = useState(false);

  const handleSubmit = useCallback(async () => {
    if (step === 'baseurl') {
      if (!inputValue.trim()) {
        setError('Base URL is required');
        return;
      }
      
      if (!isValidUrl(inputValue.trim())) {
        setError('Please enter a valid URL (e.g., https://api.example.com/v1)');
        return;
      }

      setBaseUrl(inputValue.trim());
      setInputValue('');
      setError(null);
      setStep('apikey');
    } else if (step === 'apikey') {
      if (!inputValue.trim()) {
        setError('API key is required');
        return;
      }

      if (!isValidApiKey(inputValue.trim())) {
        setError('API key must be at least 8 characters long');
        return;
      }

      const apiKeyValue = inputValue.trim();
      setApiKey(apiKeyValue);
      setStep('validating');
      
      // Discover available models
      try {
        const models = await discoverModels(baseUrl, apiKeyValue);
        if (models.length > 0) {
          setAvailableModels(models);
          setSelectedModelIndex(0);
          setStep('models');
        } else {
          setModelDiscoveryFailed(true);
          setStep('finalizing');
          // Small delay to show the message, then complete
          setTimeout(() => {
            onComplete(baseUrl, apiKeyValue);
          }, 1500);
        }
      } catch (error) {
        setModelDiscoveryFailed(true);
        setStep('finalizing');
        // Small delay to show the error message, then complete
        setTimeout(() => {
          onComplete(baseUrl, apiKeyValue);
        }, 1500);
      }
    } else if (step === 'models') {
      if (availableModels.length > 0) {
        const selectedModel = availableModels[selectedModelIndex];
        console.log('========== MODEL SELECTION DEBUG ==========');
        console.log(`availableModels.length: ${availableModels.length}`);
        console.log(`selectedModelIndex: ${selectedModelIndex}`);
        console.log(`selectedModel:`, selectedModel);
        console.log(`selectedModel.id: ${selectedModel.id}`);
        console.log('==========================================');
        console.log('🚀 CALLING onComplete with model:', selectedModel.id);
        setStep('finalizing');
        // Call immediately instead of using timeout
        onComplete(baseUrl, apiKey, selectedModel.id);
      } else {
        console.log('========== NO MODELS AVAILABLE ==========');
        console.log('availableModels is empty, calling onComplete without model');
        console.log('=========================================');
        onComplete(baseUrl, apiKey);
      }
    }
  }, [step, inputValue, baseUrl, apiKey, availableModels, selectedModelIndex, onComplete]);

  const handleModelNavigation = useCallback((direction: 'up' | 'down' | 'pageup' | 'pagedown') => {
    if (availableModels.length === 0) return;
    
    const pageSize = 8; // Same as maxVisible in display
    
    if (direction === 'up') {
      setSelectedModelIndex(prev => 
        prev > 0 ? prev - 1 : availableModels.length - 1
      );
    } else if (direction === 'down') {
      setSelectedModelIndex(prev => 
        prev < availableModels.length - 1 ? prev + 1 : 0
      );
    } else if (direction === 'pageup') {
      setSelectedModelIndex(prev => 
        Math.max(0, prev - pageSize)
      );
    } else if (direction === 'pagedown') {
      setSelectedModelIndex(prev => 
        Math.min(availableModels.length - 1, prev + pageSize)
      );
    }
  }, [availableModels.length]);

  useInput((input, key) => {
    if (key.escape) {
      onCancel();
      return;
    }

    if (step === 'models') {
      if (key.upArrow) {
        handleModelNavigation('up');
        return;
      }
      if (key.downArrow) {
        handleModelNavigation('down');
        return;
      }
      if (key.pageUp) {
        handleModelNavigation('pageup');
        return;
      }
      if (key.pageDown) {
        handleModelNavigation('pagedown');
        return;
      }
      // Also support Ctrl+U and Ctrl+D for page navigation
      if (key.ctrl && input === 'u') {
        handleModelNavigation('pageup');
        return;
      }
      if (key.ctrl && input === 'd') {
        handleModelNavigation('pagedown');
        return;
      }
      if (key.return) {
        handleSubmit();
        return;
      }
      // Skip to final step without model selection
      if (key.tab) {
        setStep('finalizing');
        onComplete(baseUrl, apiKey);
        return;
      }
      return;
    }

    if (key.return) {
      handleSubmit();
      return;
    }

    if (key.backspace || key.delete) {
      setInputValue(prev => prev.slice(0, -1));
      setError(null);
      return;
    }

    if (input && !key.ctrl && !key.meta) {
      setInputValue(prev => prev + input);
      setError(null);
    }
  });

  const getPromptText = () => {
    switch (step) {
      case 'baseurl':
        return 'Enter the base URL for your custom endpoint:';
      case 'apikey':
        return 'Enter your API key:';
      case 'validating':
        return 'Validating credentials and discovering models...';
      case 'models':
        return 'Select a model to use (or press Tab to skip):';
      case 'finalizing':
        return modelDiscoveryFailed ? 
          'Model discovery failed, but endpoint is configured!' :
          'Configuration complete!';
      default:
        return '';
    }
  };

  const getPlaceholder = () => {
    switch (step) {
      case 'baseurl':
        return 'https://api.hyprlab.io/v1';
      case 'apikey':
        return 'hypr-lab-your-api-key-here';
      default:
        return '';
    }
  };

  const getHelpText = () => {
    switch (step) {
      case 'baseurl':
        return [
          'Examples:',
          '• https://api.hyprlab.io/v1',
          '• https://api.openai.com/v1',
          '• https://api.anthropic.com',
          '• https://your-service.com/api/v1',
          '',
          'Make sure to include the protocol (https://) and the correct path.',
        ];
      case 'apikey':
        return [
          'This is your authentication key for the API.',
          'It will be stored securely in your environment.',
          '',
          'Examples:',
          '• hypr-lab-1234567890abcdef... (HyprLab format)',
          '• sk-1234567890abcdef... (OpenAI format)',
          '• your-custom-api-key',
        ];
      case 'models':
        return [
          `Found ${availableModels.length} available models.`,
          'Use ↑/↓ arrow keys to navigate, PgUp/PgDn to jump.',
          `Currently viewing model ${selectedModelIndex + 1} of ${availableModels.length}.`,
          'Press Enter to select, Tab to skip model selection.',
        ];
      default:
        return [];
    }
  };

  if (step === 'validating' || step === 'finalizing') {
    return (
      <Box
        borderStyle="round"
        borderColor={Colors.AccentBlue}
        flexDirection="column"
        padding={1}
        width="100%"
      >
        <Text bold color={Colors.AccentBlue}>Custom Endpoint Configuration</Text>
        <Box marginTop={1}>
          <Text>
            {step === 'validating' ? '⏳' : '✅'} {getPromptText()}
          </Text>
        </Box>
        <Box marginTop={1}>
          <Text color={Colors.Gray}>Base URL: {baseUrl}</Text>
        </Box>
        <Box marginTop={1}>
          <Text color={Colors.Gray}>API Key: {'*'.repeat(Math.min(apiKey.length, 20))}</Text>
        </Box>
        {step === 'finalizing' && availableModels.length > 0 && (
          <Box marginTop={1}>
            <Text color={Colors.Gray}>Selected Model: {availableModels[selectedModelIndex]?.id}</Text>
          </Box>
        )}
      </Box>
    );
  }

  return (
    <Box
      borderStyle="round"
      borderColor={Colors.AccentBlue}
      flexDirection="column"
      padding={1}
      width="100%"
    >
      <Text bold color={Colors.AccentBlue}>Custom Endpoint Configuration</Text>
      
      <Box marginTop={1}>
        <Text>Step {step === 'baseurl' ? '1' : step === 'apikey' ? '2' : '3'} of 3</Text>
      </Box>

      <Box marginTop={1}>
        <Text>{getPromptText()}</Text>
      </Box>

      {step === 'apikey' && (
        <Box marginTop={1}>
          <Text color={Colors.Gray}>✓ Base URL: {baseUrl}</Text>
        </Box>
      )}

      {step === 'models' && (
        <Box marginTop={1} flexDirection="column">
          <Text color={Colors.Gray}>✓ Base URL: {baseUrl}</Text>
          <Text color={Colors.Gray}>✓ API Key: {'*'.repeat(Math.min(apiKey.length, 20))}</Text>
          <Box marginTop={1}>
            <Text bold>Available Models:</Text>
          </Box>
          <Box marginTop={1} flexDirection="column" marginLeft={2}>
            {(() => {
              const maxVisible = 8; // Number of visible models
              const halfVisible = Math.floor(maxVisible / 2);
              
              let startIndex = Math.max(0, selectedModelIndex - halfVisible);
              let endIndex = Math.min(availableModels.length, startIndex + maxVisible);
              
              // Adjust start if we're near the end
              if (endIndex - startIndex < maxVisible) {
                startIndex = Math.max(0, endIndex - maxVisible);
              }
              
              const visibleModels = availableModels.slice(startIndex, endIndex);
              const showTopEllipsis = startIndex > 0;
              const showBottomEllipsis = endIndex < availableModels.length;
              
              return (
                <>
                  {showTopEllipsis && (
                    <Text color={Colors.Gray}>... {startIndex} more above</Text>
                  )}
                  {visibleModels.map((model, visibleIndex) => {
                    const actualIndex = startIndex + visibleIndex;
                    const isSelected = actualIndex === selectedModelIndex;
                    return (
                      <Text key={`${model.id}-${actualIndex}`} color={isSelected ? Colors.AccentBlue : undefined}>
                        {isSelected ? '→ ' : '  '}{model.id}
                        {model.owned_by ? ` (${model.owned_by})` : ''}
                      </Text>
                    );
                  })}
                  {showBottomEllipsis && (
                    <Text color={Colors.Gray}>... and {availableModels.length - endIndex} more</Text>
                  )}
                </>
              );
            })()}
          </Box>
        </Box>
      )}

      {step !== 'models' && (
        <Box marginTop={1}>
          <Box>
            <Text color={Colors.AccentPurple}>{'> '}</Text>
            <Text>
              {inputValue || <Text color={Colors.Gray}>{getPlaceholder()}</Text>}
              <Text backgroundColor={Colors.AccentBlue}> </Text>
            </Text>
          </Box>
        </Box>
      )}

      {error && (
        <Box marginTop={1}>
          <Text color="red">❌ {error}</Text>
        </Box>
      )}

      <Box marginTop={1} flexDirection="column">
        {getHelpText().map((line, index) => (
          <Text key={index} color={Colors.Gray} dimColor>
            {line}
          </Text>
        ))}
      </Box>

      <Box marginTop={1}>
        <Text color={Colors.Gray}>
          {step === 'models' ? (
            <>Press <Text bold>↑/↓</Text> to navigate, <Text bold>PgUp/PgDn</Text> to jump, <Text bold>Enter</Text> to select, <Text bold>Tab</Text> to skip</>
          ) : (
            <>Press <Text bold>Enter</Text> to continue, <Text bold>Esc</Text> to cancel</>
          )}
        </Text>
      </Box>
    </Box>
  );
} 
