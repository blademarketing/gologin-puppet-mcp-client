#!/usr/bin/env node

/**
 * Flowise Client for GoLogin Puppet MCP Bridge
 *
 * This script acts as an MCP server from Flowise's perspective,
 * but forwards all requests to the HTTP bridge.
 */

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { ListToolsRequestSchema, CallToolRequestSchema } = require('@modelcontextprotocol/sdk/types.js');

// Configuration
const BRIDGE_URL = process.env.BRIDGE_URL || 'http://nirostools.com:3002';

class BridgeProxyServer {
    constructor() {
        this.server = new Server({
            name: 'gologin-puppet-bridge-proxy',
            version: '1.0.0',
        }, {
            capabilities: {
                tools: {},
            },
        });

        this.setupHandlers();
    }

    setupHandlers() {
        // Handle list tools request
        this.server.setRequestHandler(
            ListToolsRequestSchema,
            async () => {
                try {
                    const response = await fetch(`${BRIDGE_URL}/tools`);
                    const data = await response.json();

                    if (!data.success) {
                        throw new Error(data.error);
                    }

                    return { tools: data.tools };
                } catch (error) {
                    console.error('Error listing tools:', error);
                    return { tools: [] };
                }
            }
        );

        // Handle call tool request
        this.server.setRequestHandler(
            CallToolRequestSchema,
            async (request) => {
                try {
                    const { name, arguments: args } = request.params;

                    const response = await fetch(`${BRIDGE_URL}/tools/call`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            name,
                            arguments: args
                        })
                    });

                    const data = await response.json();

                    if (!data.success) {
                        return {
                            content: [{
                                type: 'text',
                                text: `Error: ${data.error}`
                            }],
                            isError: true
                        };
                    }

                    return data.result;
                } catch (error) {
                    console.error('Error calling tool:', error);
                    return {
                        content: [{
                            type: 'text',
                            text: `Error: ${error.message}`
                        }],
                        isError: true
                    };
                }
            }
        );
    }

    async run() {
        const transport = new StdioServerTransport();
        await this.server.connect(transport);
        console.error(`Bridge proxy connected to ${BRIDGE_URL}`);
    }
}

// Start the proxy server
const proxy = new BridgeProxyServer();
proxy.run().catch(console.error);
