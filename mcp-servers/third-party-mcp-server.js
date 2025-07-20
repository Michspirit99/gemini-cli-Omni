#!/usr/bin/env node

// Example MCP Server for Third-Party Model Integration
// This is a conceptual example - you'd need to implement the full MCP protocol

const { createMCPServer } = require('@modelcontextprotocol/sdk');

const server = createMCPServer({
  name: "third-party-models",
  version: "1.0.0"
});

// Register tools that can call third-party APIs
server.registerTool({
  name: "call_openai",
  description: "Call OpenAI API with a prompt",
  parameters: {
    type: "object",
    properties: {
      prompt: { type: "string", description: "The prompt to send" },
      model: { type: "string", description: "OpenAI model to use", default: "gpt-4" }
    },
    required: ["prompt"]
  }
}, async (params) => {
  // Implementation would call OpenAI API
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: params.model || 'gpt-4',
      messages: [{ role: 'user', content: params.prompt }]
    })
  });
  
  const data = await response.json();
  return { content: data.choices[0].message.content };
});

server.registerTool({
  name: "call_custom_endpoint",
  description: "Call a custom AI endpoint",
  parameters: {
    type: "object",
    properties: {
      prompt: { type: "string", description: "The prompt to send" },
      endpoint: { type: "string", description: "Custom endpoint URL" }
    },
    required: ["prompt"]
  }
}, async (params) => {
  // Implementation would call your custom endpoint
  const endpoint = params.endpoint || process.env.CUSTOM_ENDPOINT;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: params.prompt })
  });
  
  const data = await response.json();
  return { content: data.response || data.text || data.content };
});

server.start(); 
