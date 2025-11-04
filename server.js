#!/usr/bin/env node

/**
 * HTTP-to-stdio Bridge for GoLogin Puppet MCP
 *
 * This server exposes your local MCP server via HTTP so Flowise
 * running in Docker can access it remotely.
 */

const express = require('express');
const { spawn } = require('child_process');
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');
const { ListToolsResultSchema, CallToolResultSchema } = require('@modelcontextprotocol/sdk/types.js');

const app = express();
const PORT = process.env.PORT || 3001;

// Store active MCP client
let mcpClient = null;
let mcpProcess = null;

// Initialize MCP connection
async function initializeMCP() {
    if (mcpClient) {
        console.log('MCP client already initialized');
        return;
    }

    try {
        // Create transport (it will spawn the process internally)
        const transport = new StdioClientTransport({
            command: 'node',
            args: ['/tools/dev/gologin-puppet-mcp/dist/index.js']
        });

        // Create client
        mcpClient = new Client({
            name: 'flowise-bridge-client',
            version: '1.0.0'
        }, {
            capabilities: {}
        });

        // Connect
        await mcpClient.connect(transport);
        console.log('✅ MCP client connected successfully');
    } catch (error) {
        console.error('❌ Failed to initialize MCP:', error);
        throw error;
    }
}

app.use(express.json({ limit: '50mb' }));

// Enable CORS for Flowise
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

// Health check
app.get('/health', (_req, res) => {
    res.json({
        status: 'ok',
        mcpConnected: mcpClient !== null,
        timestamp: new Date().toISOString()
    });
});

// Serve the Flowise client script
app.get('/client.js', (_req, res) => {
    res.sendFile(__dirname + '/flowise-client.js');
});

// List available tools
app.get('/tools', async (_req, res) => {
    try {
        if (!mcpClient) {
            await initializeMCP();
        }

        const result = await mcpClient.request({
            method: 'tools/list'
        }, ListToolsResultSchema);

        res.json({
            success: true,
            tools: result.tools
        });
    } catch (error) {
        console.error('Error listing tools:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Call a tool
app.post('/tools/call', async (req, res) => {
    try {
        if (!mcpClient) {
            await initializeMCP();
        }

        const { name, arguments: args } = req.body;

        if (!name) {
            return res.status(400).json({
                success: false,
                error: 'Tool name is required'
            });
        }

        console.log(`📞 Calling tool: ${name}`);
        console.log('Arguments:', JSON.stringify(args, null, 2));

        const result = await mcpClient.request({
            method: 'tools/call',
            params: {
                name,
                arguments: args || {}
            }
        }, CallToolResultSchema);

        res.json({
            success: true,
            result: result
        });
    } catch (error) {
        console.error('Error calling tool:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            stack: error.stack
        });
    }
});

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down gracefully...');

    if (mcpProcess) {
        mcpProcess.kill();
    }

    process.exit(0);
});

// Start server
app.listen(PORT, '0.0.0.0', async () => {
    console.log(`🚀 GoLogin Puppet MCP Bridge running on http://0.0.0.0:${PORT}`);
    console.log(`📡 Initializing MCP connection...`);

    try {
        await initializeMCP();
        console.log('✅ Ready to receive requests from Flowise');
    } catch (error) {
        console.error('❌ Failed to initialize on startup:', error);
        console.log('⚠️  Will retry on first request');
    }
});
