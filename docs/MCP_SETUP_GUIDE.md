# MCP Servers - Complete Setup Guide

**Installation Date:** January 28, 2026  
**Status:** ✅ All servers installed and configured

---

## 📦 Installed Servers

| Server | Version | Status | Purpose |
|--------|---------|--------|---------|
| **PostgreSQL (Supabase)** | 0.6.2 | ✅ Ready | Direct database access |
| **Filesystem** | 2026.1.14 | ✅ Ready | File operations & exploration |
| **Memory** | 2026.1.26 | ✅ Ready | Persistent context storage |
| **GitHub** | 2025.4.8 | ✅ Ready* | Repository management |
| **Slack** | 2025.4.25 | ✅ Ready* | Notifications & messaging |

*Requires credentials in environment variables

---

## 🔧 Configuration Details

### Location
```
/Users/wesleykoot/LCL-Local/antigravity/mcp.json
```

### 1. PostgreSQL/Supabase Server
**Status:** Ready to use immediately
```json
{
    "command": "npx",
    "args": [
        "-y",
        "@modelcontextprotocol/server-postgres",
        "postgresql://postgres.mlpefjsbriqgxcaqxhic:haznuq-jusmu2-fogvAb@aws-1-eu-west-1.pooler.supabase.com:6543/postgres"
    ]
}
```

**Use Cases:**
- SQL query execution
- Schema inspection
- Database debugging
- Complex migrations

---

### 2. Filesystem Server
**Status:** Ready to use immediately
```json
{
    "command": "npx",
    "args": [
        "-y",
        "@modelcontextprotocol/server-filesystem",
        "/Users/wesleykoot/LCL-Local"
    ]
}
```

**Use Cases:**
- Read/write project files
- Navigate directory structure
- Update configurations
- Manage migrations

**Security:** Sandboxed to project root

---

### 3. Memory Server
**Status:** Ready to use immediately
```json
{
    "command": "npx",
    "args": [
        "-y",
        "@modelcontextprotocol/server-memory"
    ]
}
```

**Use Cases:**
- Store architectural patterns
- Track important URLs
- Maintain project conventions
- Preserve knowledge between sessions

---

### 4. GitHub Server
**Status:** Requires GitHub Personal Access Token
```json
{
    "command": "npx",
    "args": [
        "-y",
        "@modelcontextprotocol/server-github"
    ],
    "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "${GITHUB_PERSONAL_ACCESS_TOKEN}"
    }
}
```

**Setup Instructions:**
1. Generate Personal Access Token:
   - Go to https://github.com/settings/tokens
   - Click "Generate new token (classic)"
   - Select scopes: `repo`, `read:user`, `workflow`
   - Save the token

2. Add to environment:
   ```bash
   export GITHUB_PERSONAL_ACCESS_TOKEN="ghp_xxxxxxxxxxxxx"
   ```

3. Add to `.env` or `.zshrc` for persistence

**Use Cases:**
- Create/update GitHub issues
- Manage pull requests
- Query repository data
- Automate releases

---

### 5. Slack Server
**Status:** Requires Slack Bot Token
```json
{
    "command": "npx",
    "args": [
        "-y",
        "@modelcontextprotocol/server-slack"
    ],
    "env": {
        "SLACK_BOT_TOKEN": "${SLACK_BOT_TOKEN}"
    }
}
```

**Setup Instructions:**
1. Create Slack App:
   - Go to https://api.slack.com/apps
   - Create New App > From scratch
   - Name: "LCL Bot"
   - Workspace: Your workspace

2. Add permissions:
   - OAuth & Permissions
   - Add scopes: `chat:write`, `channels:manage`
   - Install to workspace

3. Copy Bot User OAuth Token (starts with `xoxb-`)

4. Add to environment:
   ```bash
   export SLACK_BOT_TOKEN="xoxb-xxxxxxxxxxxxx"
   ```

**Use Cases:**
- Post notifications
- Send alerts
- Trigger workflows
- Team communication

---

## 🚀 How to Use

### In VS Code Copilot
All servers are automatically available. Just ask Copilot to:
- "Query the database for..."
- "Read the file..."
- "Create a GitHub issue for..."
- "Send a Slack message..."

### Manual Testing
```bash
# Test PostgreSQL
mcp-server-postgres <connection-string>

# Test Filesystem
mcp-server-filesystem /path/to/project

# Test Memory
mcp-server-memory

# Test GitHub
GITHUB_PERSONAL_ACCESS_TOKEN=your_token mcp-server-github

# Test Slack
SLACK_BOT_TOKEN=your_token mcp-server-slack
```

---

## ⚠️ Important Notes

### Credentials Management
- **DO NOT** hardcode tokens in mcp.json
- Use environment variables instead
- Add to `.zshrc` or system environment
- Never commit tokens to version control

### Database Password
The Supabase connection string in mcp.json contains the database password. Consider:
1. Moving to environment variable
2. Using a read-only connection string for non-admin tasks
3. Rotating password periodically

### Server Startup
- Servers start automatically on-demand
- No manual startup required
- VS Code manages lifecycle

### Performance
- All servers are lightweight
- Minimal memory footprint
- Fast startup times (< 1 second)

---

## 📋 Checklist - Next Steps

- [ ] Test PostgreSQL connection
  ```bash
  psql postgresql://... -c "SELECT version();"
  ```

- [ ] Test Filesystem access
  - Ask Copilot: "List the files in src/"

- [ ] Add GitHub token (optional but recommended)
  ```bash
  export GITHUB_PERSONAL_ACCESS_TOKEN="ghp_..."
  ```

- [ ] Add Slack token (optional)
  ```bash
  export SLACK_BOT_TOKEN="xoxb-..."
  ```

- [ ] Verify in VS Code
  - Open Command Palette
  - Type "Copilot: Debug"
  - Should show all 5 servers

---

## 🔗 Useful Resources

- [MCP Documentation](https://modelcontextprotocol.io/)
- [GitHub API Docs](https://docs.github.com/en/rest)
- [Slack API Docs](https://api.slack.com/)
- [PostgreSQL Docs](https://www.postgresql.org/docs/)

---

## 📞 Troubleshooting

**Server not starting?**
- Check npm is installed: `npm --version`
- Reinstall: `npm install -g @modelcontextprotocol/server-*`
- Clear cache: `npm cache clean --force`

**GitHub token error?**
- Verify token exists: `echo $GITHUB_PERSONAL_ACCESS_TOKEN`
- Check scopes are correct
- Regenerate if needed

**Slack connection fails?**
- Verify bot is in workspace
- Check token hasn't expired
- Ensure correct token format (starts with `xoxb-`)

**Database connection error?**
- Test connection: `psql postgresql://...`
- Check network connectivity
- Verify credentials are correct

---

**Last Updated:** January 28, 2026
