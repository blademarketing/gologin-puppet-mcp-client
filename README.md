# GoLogin Puppet MCP Bridge

HTTP bridge for exposing the GoLogin Puppet MCP server to remote Flowise instances.

## Architecture

```
┌─────────────────┐
│ Flowise (Docker)│ <- Remote server
│  on Server B    │
└────────┬────────┘
         │ HTTP
         ↓
┌─────────────────┐
│  HTTP Bridge    │ <- This server (94.237.49.107:3001)
│   (Express)     │
└────────┬────────┘
         │ stdio
         ↓
┌─────────────────┐
│  GoLogin Puppet │ <- Local MCP server
│   MCP Server    │
└─────────────────┘
```

## Quick Start

### 1. Install Dependencies

```bash
cd /tools/dev/gologin-puppet-mcp-bridge
npm install
```

### 2. Start the Bridge Server

```bash
npm start
```

Or run in background:

```bash
nohup npm start > bridge.log 2>&1 &
```

Or with PM2:

```bash
pm2 start server.js --name gologin-mcp-bridge
pm2 save
```

### 3. Test the Bridge

```bash
# Check health
curl http://localhost:3001/health

# List available tools
curl http://localhost:3001/tools

# Call a tool (example)
curl -X POST http://localhost:3001/tools/call \
  -H "Content-Type: application/json" \
  -d '{
    "name": "list_sessions",
    "arguments": {}
  }'
```

## Using with Flowise

### Option 1: Direct HTTP API (Custom Integration)

In your Flowise flow, use a Custom Tool or API node to call:

**List Tools:**
```
GET http://94.237.49.107:3001/tools
```

**Call Tool:**
```
POST http://94.237.49.107:3001/tools/call
Body: {
  "name": "start_browser",
  "arguments": {
    "apiKey": "your-api-key",
    "profileId": "your-profile-id"
  }
}
```

### Option 2: MCP Client Wrapper (Recommended)

If your Flowise server can access this machine via HTTP, you can use the included client wrapper.

**On your Flowise server**, create this config in CustomMCP node:

```json
{
  "command": "npx",
  "args": ["-y", "mcp-remote-proxy@latest"],
  "env": {
    "BRIDGE_URL": "http://94.237.49.107:3001"
  }
}
```

Or if you want to install the flowise-client.js on the Flowise server:

```bash
# On Flowise server
curl -o /tmp/flowise-mcp-client.js http://94.237.49.107:3001/client.js

# Then in Flowise CustomMCP:
{
  "command": "node",
  "args": ["/tmp/flowise-mcp-client.js"],
  "env": {
    "BRIDGE_URL": "http://94.237.49.107:3001"
  }
}
```

### Option 3: Serve the Client Script

Add this endpoint to server.js to serve the client script:

```javascript
app.get('/client.js', (req, res) => {
    res.sendFile(__dirname + '/flowise-client.js');
});
```

Then Flowise can download and execute it.

## Configuration

### Environment Variables

- `PORT` - Bridge server port (default: 3001)
- `BRIDGE_URL` - For the client script (default: http://94.237.49.107:3001)

### Firewall

Make sure port 3001 is accessible from your Flowise server:

```bash
# Check if port is open
sudo ufw allow 3001/tcp

# Or with iptables
sudo iptables -A INPUT -p tcp --dport 3001 -j ACCEPT
```

## Example Workflow in Flowise

1. **Add Custom MCP node** with bridge configuration
2. **Select tools** you want (start_browser, navigate, screenshot, etc.)
3. **Connect to Agent** (ReAct Agent, OpenAI Functions Agent, etc.)
4. **Add Chat Model** (ChatOpenAI, ChatAnthropic, etc.)
5. **Test with prompt:**

```
Use the GoLogin browser tools to:
1. Start a browser session with my credentials
2. Navigate to https://example.com
3. Get the page title
4. Take a screenshot
5. Close the browser
```

## Monitoring

```bash
# View logs
tail -f bridge.log

# Or with PM2
pm2 logs gologin-mcp-bridge

# Check status
pm2 status
```

## Troubleshooting

### Bridge won't start

- Check if port 3001 is already in use: `lsof -i :3001`
- Check if MCP server path is correct
- Check logs for errors

### Flowise can't connect

- Test with curl from Flowise server: `curl http://94.237.49.107:3001/health`
- Check firewall rules
- Check if bridge is running: `pm2 status`

### Tools not loading

- Check bridge logs: `pm2 logs gologin-mcp-bridge`
- Test tools endpoint: `curl http://localhost:3001/tools`
- Restart bridge: `pm2 restart gologin-mcp-bridge`

## Security Notes

⚠️ **This bridge has no authentication!**

For production use, add:
- API key authentication
- Rate limiting
- IP whitelisting
- HTTPS/TLS

Example with basic auth:

```javascript
app.use((req, res, next) => {
    const apiKey = req.headers['x-api-key'];
    if (apiKey !== process.env.API_KEY) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
});
```
