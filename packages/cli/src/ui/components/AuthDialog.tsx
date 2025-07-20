/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { Colors } from '../colors.js';
import { RadioButtonSelect } from './shared/RadioButtonSelect.js';
import { LoadedSettings, SettingScope } from '../../config/settings.js';
import { AuthType } from '@google/gemini-cli-core';
import { validateAuthMethod } from '../../config/auth.js';
import { CustomEndpointDialog } from './CustomEndpointDialog.js';

interface AuthDialogProps {
  onSelect: (authMethod: AuthType | undefined, scope: SettingScope) => void;
  settings: LoadedSettings;
  initialErrorMessage?: string | null;
}

function parseDefaultAuthType(
  defaultAuthType: string | undefined,
): AuthType | null {
  if (
    defaultAuthType &&
    Object.values(AuthType).includes(defaultAuthType as AuthType)
  ) {
    return defaultAuthType as AuthType;
  }
  return null;
}

export function AuthDialog({
  onSelect,
  settings,
  initialErrorMessage,
}: AuthDialogProps): React.JSX.Element {
  const [showCustomEndpointDialog, setShowCustomEndpointDialog] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(() => {
    if (initialErrorMessage) {
      return initialErrorMessage;
    }

    const defaultAuthType = parseDefaultAuthType(
      process.env.GEMINI_DEFAULT_AUTH_TYPE,
    );

    if (process.env.GEMINI_DEFAULT_AUTH_TYPE && defaultAuthType === null) {
      return (
        `Invalid value for GEMINI_DEFAULT_AUTH_TYPE: "${process.env.GEMINI_DEFAULT_AUTH_TYPE}". ` +
        `Valid values are: ${Object.values(AuthType).join(', ')}.`
      );
    }

    if (
      process.env.GEMINI_API_KEY &&
      (!defaultAuthType || defaultAuthType === AuthType.USE_GEMINI)
    ) {
      return 'Existing API key detected (GEMINI_API_KEY). Select "Gemini API Key" option to use it.';
    }

    // Third-party provider hints
    if (process.env.OPENAI_API_KEY && (!defaultAuthType || defaultAuthType === AuthType.USE_OPENAI)) {
      return 'OpenAI API key detected (OPENAI_API_KEY). Select "OpenAI API Key" option to use it.';
    }

    if (process.env.ANTHROPIC_API_KEY && (!defaultAuthType || defaultAuthType === AuthType.USE_ANTHROPIC)) {
      return 'Anthropic API key detected (ANTHROPIC_API_KEY). Select "Anthropic API Key" option to use it.';
    }

    if (process.env.CUSTOM_API_KEY && process.env.CUSTOM_ENDPOINT && (!defaultAuthType || defaultAuthType === AuthType.USE_CUSTOM)) {
      return 'Custom endpoint detected (CUSTOM_API_KEY & CUSTOM_ENDPOINT). Select "Custom Endpoint" option to use it.';
    }

    return null;
  });
  const items = [
    {
      label: 'Login with Google',
      value: AuthType.LOGIN_WITH_GOOGLE,
    },
    ...(process.env.CLOUD_SHELL === 'true'
      ? [
          {
            label: 'Use Cloud Shell user credentials',
            value: AuthType.CLOUD_SHELL,
          },
        ]
      : []),
    {
      label: 'Use Gemini API Key',
      value: AuthType.USE_GEMINI,
    },
    { label: 'Vertex AI', value: AuthType.USE_VERTEX_AI },
    { label: 'OpenAI API Key', value: AuthType.USE_OPENAI },
    { label: 'Anthropic API Key', value: AuthType.USE_ANTHROPIC },
    { label: 'Custom Endpoint', value: AuthType.USE_CUSTOM },
  ];

  const initialAuthIndex = items.findIndex((item) => {
    if (settings.merged.selectedAuthType) {
      return item.value === settings.merged.selectedAuthType;
    }

    const defaultAuthType = parseDefaultAuthType(
      process.env.GEMINI_DEFAULT_AUTH_TYPE,
    );
    if (defaultAuthType) {
      return item.value === defaultAuthType;
    }

    if (process.env.GEMINI_API_KEY) {
      return item.value === AuthType.USE_GEMINI;
    }

    // Auto-detect third-party providers
    if (process.env.OPENAI_API_KEY) {
      return item.value === AuthType.USE_OPENAI;
    }

    if (process.env.ANTHROPIC_API_KEY) {
      return item.value === AuthType.USE_ANTHROPIC;
    }

    if (process.env.CUSTOM_API_KEY && process.env.CUSTOM_ENDPOINT) {
      return item.value === AuthType.USE_CUSTOM;
    }

    return item.value === AuthType.LOGIN_WITH_GOOGLE;
  });

  const handleAuthSelect = (authMethod: AuthType) => {
    console.log('========== AUTH SELECT CALLED ==========');
    console.log(`Selected auth method: ${authMethod}`);
    console.log('=======================================');
    
    if (authMethod === AuthType.USE_CUSTOM) {
      console.log('🎯 SHOWING CUSTOM ENDPOINT DIALOG');
      setShowCustomEndpointDialog(true);
      setErrorMessage(null);
      return;
    }

    const error = validateAuthMethod(authMethod);
    if (error) {
      setErrorMessage(error);
    } else {
      setErrorMessage(null);
      onSelect(authMethod, SettingScope.User);
    }
  };

  const handleCustomEndpointComplete = (baseUrl: string, apiKey: string, selectedModel?: string) => {
    console.log('========== CUSTOM ENDPOINT COMPLETE CALLED ==========');
    console.log(`baseUrl: ${baseUrl}`);
    console.log(`apiKey: ${apiKey.substring(0, 8)}...`);
    console.log(`selectedModel: ${selectedModel}`);
    console.log('====================================================');
    
    // Set environment variables (for this session) - this is what actually matters
    process.env.CUSTOM_ENDPOINT = baseUrl;
    process.env.CUSTOM_API_KEY = apiKey;
    
    // Set the selected model if one was chosen, otherwise use a reasonable default
    if (selectedModel) {
      process.env.GEMINI_MODEL = selectedModel;
      console.log(`✅ Model set to: ${selectedModel}`);
    } else {
      // Fallback: if no model was selected, use a common one for custom endpoints
      process.env.GEMINI_MODEL = 'gpt-3.5-turbo';
      console.log(`⚠️  No model selected, using fallback: gpt-3.5-turbo`);
    }
    
    console.log('Set environment variables for custom endpoint:');
    console.log(`CUSTOM_ENDPOINT=${process.env.CUSTOM_ENDPOINT}`);
    console.log(`CUSTOM_API_KEY=${process.env.CUSTOM_API_KEY?.substring(0, 8)}...`);
    console.log(`GEMINI_MODEL=${process.env.GEMINI_MODEL}`);
    
    setShowCustomEndpointDialog(false);
    setErrorMessage(null);
    
    console.log('Calling onSelect with AuthType.USE_CUSTOM');
    console.log('========== ENVIRONMENT VARIABLES SET ==========');
    console.log(`Final check - CUSTOM_ENDPOINT: ${process.env.CUSTOM_ENDPOINT}`);
    console.log(`Final check - CUSTOM_API_KEY: ${process.env.CUSTOM_API_KEY?.substring(0, 8)}...`);
    console.log(`Final check - GEMINI_MODEL: ${process.env.GEMINI_MODEL}`);
    console.log('==============================================');
    
    onSelect(AuthType.USE_CUSTOM, SettingScope.User);
  };

  const handleCustomEndpointCancel = () => {
    setShowCustomEndpointDialog(false);
    setErrorMessage(null);
  };

  useInput((_input, key) => {
    if (key.escape) {
      // Prevent exit if there is an error message.
      // This means they user is not authenticated yet.
      if (errorMessage) {
        return;
      }
      if (settings.merged.selectedAuthType === undefined) {
        // Prevent exiting if no auth method is set
        setErrorMessage(
          'You must select an auth method to proceed. Press Ctrl+C twice to exit.',
        );
        return;
      }
      onSelect(undefined, SettingScope.User);
    }
  });

  if (showCustomEndpointDialog) {
    return (
      <CustomEndpointDialog
        onComplete={handleCustomEndpointComplete}
        onCancel={handleCustomEndpointCancel}
      />
    );
  }

  return (
    <Box
      borderStyle="round"
      borderColor={Colors.Gray}
      flexDirection="column"
      padding={1}
      width="100%"
    >
      <Text bold>Get started</Text>
      <Box marginTop={1}>
        <Text>How would you like to authenticate for this project?</Text>
      </Box>
      <Box marginTop={1}>
        <RadioButtonSelect
          items={items}
          initialIndex={initialAuthIndex}
          onSelect={handleAuthSelect}
          isFocused={true}
        />
      </Box>
      {errorMessage && (
        <Box marginTop={1}>
          <Text color={Colors.AccentRed}>{errorMessage}</Text>
        </Box>
      )}
      <Box marginTop={1}>
        <Text color={Colors.Gray}>(Use Enter to select)</Text>
      </Box>
      <Box marginTop={1}>
        <Text>Terms of Services and Privacy Notice for Gemini CLI</Text>
      </Box>
      <Box marginTop={1}>
        <Text color={Colors.AccentBlue}>
          {
            'https://github.com/google-gemini/gemini-cli/blob/main/docs/tos-privacy.md'
          }
        </Text>
      </Box>
    </Box>
  );
}
