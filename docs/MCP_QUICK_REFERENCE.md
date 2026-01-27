# MCP Servers Quick Reference

## ✅ Currently Active Servers

### 1. **PostgreSQL/Supabase** 
- **Command:** `mcp-server-postgres <connection-string>`
- **Status:** ✅ WORKING
- **What it does:** Direct SQL access to your Supabase database
- **Best for:** 
  - Debugging database issues
  - Complex queries
  - Schema inspection
  - Migration testing

### 2. **Filesystem**
- **Command:** `mcp-server-filesystem /path/to/project`
- **Status:** ✅ INSTALLED & READY
- **What it does:** Safe read/write access to your project files
- **Best for:**
  - Exploring code structure
  - Updating configuration files
  - Reading documentation
  - Managing migrations

### 3. **Memory**
- **Command:** `mcp-server-memory`
- **Status:** ✅ INSTALLED & READY
- **What it does:** Persistent knowledge storage across sessions
- **Best for:**
  - Storing important URLs and patterns
  - Maintaining project conventions
  - Tracking architectural decisions
  - Knowledge base management

---

## 🔧 How to Use in VS Code Copilot

Your `antigravity/mcp.json` is configured. VS Code will automatically:
1. Start servers on demand
2. Make their tools available to Copilot
3. Stop them when not needed

No manual startup required!

---

## 📥 Next: Install Additional Servers

### Add Brave Search (Web Search)
```bash
npm install -g @modelcontextprotocol/server-brave
```
**Use Case:** Research event venues, verify scraper sources

### Add GitHub Integration
```bash
npm install -g @modelcontextprotocol/server-github
```
**Requires:** GitHub Personal Access Token
**Use Case:** Manage issues, PRs, and releases

### Add HTTP Fetch
```bash
npm install -g @modelcontextprotocol/server-fetch
```
**Use Case:** Test API endpoints, debug scrapers

---

## 🚨 Important Notes

- **PostgreSQL Password:** Currently hardcoded in mcp.json (consider moving to env vars)
- **Filesystem Sandbox:** Automatically restricted to `/Users/wesleykoot/LCL-Local`
- **Memory Storage:** Encrypted and session-specific
- **Performance:** All servers are lightweight and start on-demand

---

## 📊 Server Status Command

To check all installed MCP servers:
```bash
npm list -g @modelcontextprotocol/server-*
```

Expected output:
```
├── @modelcontextprotocol/server-filesystem@2026.1.14
├── @modelcontextprotocol/server-memory@2026.1.26
└── @modelcontextprotocol/server-postgres@0.6.2
```

---

## 🔗 Configuration File Location
- **Path:** `/Users/wesleykoot/LCL-Local/antigravity/mcp.json`
- **Format:** JSON with server definitions
- **Updated:** January 28, 2026
