# Flowise Integration Guide

## ✅ Bridge is Running!

Your GoLogin Puppet MCP Bridge is now running as a systemd service at:
- **URL**: `http://94.237.49.107:3002`
- **Status**: Check with `systemctl status gologin-mcp-bridge`
- **Logs**: View with `journalctl -u gologin-mcp-bridge -f`

## 🎯 Integration Options for Flowise

Since your Flowise is Dockerized on another server, here are your options:

---

### **Option 1: HTTP Custom Tool (Simplest)**

Use Flowise's HTTP Request node or custom function to call the bridge directly.

#### Create a Custom Tool in Flowise:

1. In Flowise, add a **Custom Tool** node
2. Configure it to call your bridge:

```javascript
// Tool Name: start_gologin_browser
// Tool Description: Start a GoLogin browser session

const apiKey = $apiKey; // From input
const profileId = $profileId; // From input

const response = await fetch('http://94.237.49.107:3002/tools/call', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        name: 'start_browser',
        arguments: { apiKey, profileId }
    })
});

const data = await response.json();
return JSON.stringify(data.result);
```

Repeat for each tool you need (navigate, screenshot, etc.)

---

### **Option 2: OpenAPI/Swagger Integration**

Create an OpenAPI spec and use Flowise's OpenAPI tool.

#### Step 1: Create `openapi.yaml` on the bridge server

```yaml
openapi: 3.0.0
info:
  title: GoLogin Puppet MCP API
  version: 1.0.0
servers:
  - url: http://94.237.49.107:3002
paths:
  /tools:
    get:
      summary: List available tools
      responses:
        '200':
          description: Success
  /tools/call:
    post:
      summary: Call a tool
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                name:
                  type: string
                arguments:
                  type: object
      responses:
        '200':
          description: Success
```

#### Step 2: In Flowise, use OpenAPI Chain

Configure the OpenAPI spec URL and let the agent discover tools automatically.

---

### **Option 3: MCP Proxy Client (Recommended for Full Integration)**

Install a client script inside the Flowise Docker container that connects to your bridge.

#### Step A: Copy client to Flowise container

```bash
# From your Flowise server
docker cp flowise-client.js <flowise-container-id>:/app/flowise-client.js
```

Or mount it as a volume in docker-compose.yml:

```yaml
volumes:
  - ./flowise-client.js:/app/flowise-client.js
```

#### Step B: Configure in Flowise CustomMCP

In the Flowise UI, add a CustomMCP node with:

```json
{
  "command": "node",
  "args": ["/app/flowise-client.js"],
  "env": {
    "BRIDGE_URL": "http://94.237.49.107:3002"
  }
}
```

---

### **Option 4: Direct HTTP API from Agent**

Give your agent direct access to make HTTP calls.

#### Example Prompt:

```
You have access to a browser automation API at http://94.237.49.107:3002

Available tools:
- start_browser: POST /tools/call with {"name":"start_browser","arguments":{"apiKey":"...","profileId":"..."}}
- navigate: POST /tools/call with {"name":"navigate","arguments":{"sessionId":"...","url":"..."}}
- screenshot: POST /tools/call with {"name":"screenshot","arguments":{"sessionId":"..."}}
- close_browser: POST /tools/call with {"name":"close_browser","arguments":{"sessionId":"..."}}

Use these to browse websites and gather information.

Task: Visit example.com and take a screenshot.
```

Then use Flowise's HTTP Request node in your flow.

---

## 📋 Complete Tool List

Your bridge exposes all 22 tools:

```bash
curl http://94.237.49.107:3002/tools | jq '.tools[].name'
```

Tools available:
- `start_browser` - Start a GoLogin browser
- `close_browser` - Close a browser session
- `list_sessions` - List active sessions
- `navigate` - Navigate to URL
- `go_back` - Go back
- `go_forward` - Go forward
- `reload` - Reload page
- `click` - Click element
- `type_text` - Type text
- `select_option` - Select dropdown
- `wait_for_selector` - Wait for element
- `screenshot` - Take screenshot
- `get_html` - Get HTML
- `get_text` - Get text
- `get_element_property` - Get property
- `get_page_title` - Get title
- `get_current_url` - Get URL
- `evaluate` - Execute JavaScript
- `query_selector_all` - Query multiple elements
- `scroll` - Scroll page
- `press_key` - Press key
- `hover` - Hover element

---

## 🔥 Example Flowise Flow

**Nodes:**
1. **Chat Trigger** - User input
2. **Custom Tool 1** (start_browser)
3. **Custom Tool 2** (navigate)
4. **Custom Tool 3** (screenshot)
5. **Custom Tool 4** (close_browser)
6. **Agent** (ReAct/OpenAI Functions)
7. **LLM** (ChatOpenAI/Anthropic)
8. **Response**

**Example conversation:**
```
User: "Can you visit BBC News and take a screenshot?"

Agent:
1. Calls start_browser with credentials
2. Gets sessionId
3. Calls navigate to bbc.co.uk
4. Calls screenshot
5. Calls close_browser
6. Returns: "I've taken a screenshot of BBC News"
```

---

## 🔐 Security Considerations

⚠️ **Your bridge has NO authentication right now!**

### To add API key auth:

1. Edit `/tools/dev/gologin-puppet-mcp-bridge/server.js`
2. Add middleware:

```javascript
app.use((req, res, next) => {
    const apiKey = req.headers['x-api-key'];
    if (apiKey !== process.env.API_KEY) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
});
```

3. Set environment in systemd:
```bash
sudo systemctl edit gologin-mcp-bridge
```

Add:
```ini
[Service]
Environment="API_KEY=your-secret-key-here"
```

4. Restart:
```bash
sudo systemctl restart gologin-mcp-bridge
```

---

## 🛠️ Management Commands

```bash
# Start service
sudo systemctl start gologin-mcp-bridge

# Stop service
sudo systemctl stop gologin-mcp-bridge

# Restart service
sudo systemctl restart gologin-mcp-bridge

# Check status
sudo systemctl status gologin-mcp-bridge

# View logs
sudo journalctl -u gologin-mcp-bridge -f

# View log file
tail -f /var/log/gologin-mcp-bridge.log
tail -f /var/log/gologin-mcp-bridge-error.log
```

---

## 🧪 Testing

### Test from command line:

```bash
# Health check
curl http://94.237.49.107:3002/health

# List tools
curl http://94.237.49.107:3002/tools | jq '.tools[].name'

# Call a tool
curl -X POST http://94.237.49.107:3002/tools/call \
  -H "Content-Type: application/json" \
  -d '{
    "name": "list_sessions",
    "arguments": {}
  }' | jq .
```

### Test from Flowise server:

```bash
# SSH into Flowise server
curl http://94.237.49.107:3002/health

# If this fails, check firewall rules
```

---

## 🐛 Troubleshooting

### Bridge not responding
```bash
sudo systemctl status gologin-mcp-bridge
sudo journalctl -u gologin-mcp-bridge -n 50
```

### Flowise can't reach bridge
```bash
# Test from Flowise server
curl http://94.237.49.107:3002/health

# Check firewall
sudo ufw status
sudo ufw allow 3002/tcp
```

### Tool calls failing
```bash
# Check MCP server is running
ps aux | grep gologin-puppet-mcp

# Check logs
tail -f /var/log/gologin-mcp-bridge-error.log
```

---

## 📊 Monitoring

The bridge logs all tool calls:

```bash
# Real-time monitoring
sudo journalctl -u gologin-mcp-bridge -f

# Filter for errors only
sudo journalctl -u gologin-mcp-bridge -p err

# Last hour
sudo journalctl -u gologin-mcp-bridge --since "1 hour ago"
```

---

## 🎉 You're All Set!

Your MCP bridge is running and ready to use with Flowise. Choose the integration option that works best for your setup and start automating!

**Next steps:**
1. Test the bridge from your Flowise server
2. Create your first Custom Tool or flow
3. Test with a simple browser automation task
4. Add authentication if needed
5. Scale as needed!
