# VS Code Extensions Setup - Complete Guide

**Date:** January 28, 2026  
**Status:** ✅ Configuration ready for installation

---

## 📦 Recommended Extensions (20 Total)

### Group 1: Database & API Development (4 extensions)
- ✅ **SQLTools** - Database explorer and query tool
- ✅ **SQLTools PostgreSQL Driver** - PostgreSQL support
- ✅ **REST Client** - API testing in VS Code
- ✅ **Thunder Client** - Lightweight API client

### Group 2: TypeScript & React (1 extension)
- ✅ **Volar** - Advanced TypeScript/React support

### Group 3: Git & Version Control (2 extensions)
- ✅ **GitLens** - Git blame and history
- ✅ **Git Graph** - Visual commit history

### Group 4: Documentation & Code Quality (3 extensions)
- ✅ **Markdown All in One** - Enhanced markdown editing
- ✅ **Import Cost** - Bundle size analysis
- ✅ **Code Spell Checker** - Typo detection

### Group 5: Visual Enhancements (2 extensions)
- ✅ **Color Picker** - Visual color selection
- ✅ **Peacock** - Color-code workspace

### Already Recommended (8 extensions)
- PostgreSQL
- Supabase Edge Functions
- Tailwind CSS IntelliSense
- ESLint
- Prettier
- Error Lens
- Path Intellisense
- ES7+ React/Redux Snippets

---

## 🚀 Installation Instructions

### Option 1: Automatic Installation (Recommended)

1. Open your terminal in the project directory
2. Run the installation script:
   ```bash
   bash scripts/install-vscode-extensions.sh
   ```

3. Restart VS Code to load all extensions

### Option 2: Manual Installation via VS Code UI

1. Open VS Code
2. Press `Cmd+Shift+X` (Extensions)
3. Search for each extension ID and click "Install"

### Option 3: Copy-Paste Command

Open Terminal and run:
```bash
code --install-extension mtxr.sqltools \
     --install-extension mtxr.sqltools-driver-pg \
     --install-extension humao.rest-client \
     --install-extension rangav.vscode-thunder-client \
     --install-extension johnsoncodehk.volar \
     --install-extension eamodio.gitlens \
     --install-extension mhutchie.git-graph \
     --install-extension yzhang.markdown-all-in-one \
     --install-extension wix.vscode-import-cost \
     --install-extension streetsidesoftware.code-spell-checker \
     --install-extension anseki.vscode-color \
     --install-extension johnpapa.vscode-peacock
```

---

## 📋 Files Updated

### 1. `.vscode/extensions.json`
**Updated with:** All 20 recommended extensions  
**Purpose:** VS Code auto-suggests installation on workspace open

### 2. `.vscode/settings-recommended.json`
**New file** with optimized settings for:
- Prettier formatting
- ESLint auto-fix
- SQLTools configuration
- REST Client templates
- Tailwind CSS integration
- GitLens configuration
- And more...

### 3. `scripts/install-vscode-extensions.sh`
**New file** - Automated installation script

### 4. `docs/VSCODE_EXTENSIONS_GUIDE.md`
**New file** - Comprehensive guide with:
- Extension descriptions
- Installation groups
- Configuration details
- Tips & tricks

---

## ⚙️ Post-Installation Setup

### Step 1: SQLTools Database Connection
1. Open VS Code
2. Press `Cmd+Shift+P`
3. Type `SQLTools: Add New Connection`
4. Select PostgreSQL
5. Enter your Supabase connection details:
   - **Server:** aws-1-eu-west-1.pooler.supabase.com
   - **Port:** 6543 (or 5432 for transaction mode)
   - **Database:** postgres
   - **Username:** postgres
   - **Password:** [Your Supabase password]
6. Click "Test Connection"
7. Save connection

### Step 2: REST Client Configuration
1. Create `.env.rest` file in project root:
   ```
   @baseUrl = https://your-project.supabase.co
   @apiKey = your-supabase-api-key
   @token = your-jwt-token
   ```

2. Create `.http` files for testing:
   ```http
   @baseUrl = https://your-project.supabase.co
   @apiKey = your-api-key

   GET {{baseUrl}}/rest/v1/events
   apikey: {{@apiKey}}
   ```

### Step 3: Settings Integration
1. Copy recommended settings:
   ```bash
   cp .vscode/settings-recommended.json .vscode/settings.json
   ```
   
   OR merge manually into your existing `settings.json`

### Step 4: Apply Settings
- Restart VS Code
- Extensions will load automatically

---

## 🔑 Extension Highlights

### SQLTools + PostgreSQL
- **Browse database schema**
- **Run SQL queries inline**
- **See results in VS Code**
- **Perfect for Supabase exploration**

### REST Client
- **No external tool needed**
- **API requests in `.http` files**
- **History and variables**
- **Perfect for API testing**

### GitLens
- **See who changed each line**
- **Inline commit info**
- **Git blame integration**
- **VS Code status bar integration**

### Volar
- **Better TypeScript IntelliSense**
- **React component type hints**
- **Improved auto-completion**
- **Template literal support**

---

## 📊 Comparison: Before vs After

| Capability | Before | After |
|-----------|--------|-------|
| Database exploration | External tool needed | Built-in SQLTools |
| API testing | Postman required | REST Client in VS Code |
| Git history | Git CLI | Visual git graph |
| Code quality | ESLint + Prettier | + Import Cost + Spell Check |
| TypeScript support | Basic | Enhanced with Volar |
| Bundle optimization | Manual | Import Cost analysis |
| Documentation | Basic | Markdown enhanced |

---

## 🎯 Extension Priority & Recommendation

### Must Have (Install First)
1. **SQLTools** + **PostgreSQL Driver** - Essential for database work
2. **REST Client** - Essential for API testing
3. **Volar** - Better TypeScript support
4. **GitLens** - Git integration

### Should Have (Install Second)
1. **Git Graph** - Better history visualization
2. **Markdown All in One** - Documentation
3. **Code Spell Checker** - Code quality
4. **Import Cost** - Bundle optimization

### Nice to Have (Install Optional)
1. **Peacock** - Visual workspace organization
2. **Color Picker** - Faster CSS/Tailwind workflow
3. **Thunder Client** - Alternative to REST Client

---

## 🆘 Troubleshooting

### Extensions not installing?
```bash
# Update npm
npm install -g npm@latest

# Clear VS Code cache
rm -rf ~/.vscode

# Try installation again
bash scripts/install-vscode-extensions.sh
```

### SQLTools connection failing?
- Check PostgreSQL driver is installed
- Verify connection string is correct
- Check network connectivity to Supabase
- Ensure username/password are correct

### REST Client not working?
- Create `.http` file with correct syntax
- Check environment variables are set
- Verify API endpoint is accessible

### GitLens showing old info?
- Git might be loading, wait a moment
- Try `Command+Shift+P` → `GitLens: Open File Blame`

---

## 📚 Quick Reference

### VS Code Command Shortcuts

| Command | Shortcut | Extension |
|---------|----------|-----------|
| SQLTools: Add Connection | `Cmd+Shift+P` → SQLTools | SQLTools |
| Git Blame | `Cmd+Shift+P` → Blame | GitLens |
| Git Graph | `Cmd+Shift+P` → Git Graph | Git Graph |
| REST Client Request | `Ctrl+Alt+R` | REST Client |
| Color Picker | `Cmd+Shift+P` → Color | Color Picker |

---

## ✅ Checklist

### Installation Phase
- [ ] Read this guide
- [ ] Review extensions in docs/VSCODE_EXTENSIONS_GUIDE.md
- [ ] Run `bash scripts/install-vscode-extensions.sh`
- [ ] Restart VS Code

### Configuration Phase
- [ ] Set up SQLTools connection
- [ ] Create `.env.rest` file
- [ ] Create sample `.http` file
- [ ] Review `.vscode/settings-recommended.json`
- [ ] Merge settings into `.vscode/settings.json`

### Verification Phase
- [ ] Test SQLTools connection
- [ ] Test REST Client request
- [ ] Verify GitLens is working
- [ ] Check all extensions in `Cmd+Shift+X`

### Optimization Phase
- [ ] Configure Peacock colors
- [ ] Set up spell checker exceptions
- [ ] Configure REST Client variables
- [ ] Customize keyboard shortcuts

---

## 🔗 Resources

- [SQLTools Documentation](https://vscode-sqltools.mteixeira.dev/)
- [REST Client Documentation](https://github.com/Huachao/vscode-restclient)
- [GitLens Documentation](https://www.gitkraken.com/gitlens)
- [Volar Documentation](https://github.com/johnsoncodehk/volar)
- [VS Code Extension Marketplace](https://marketplace.visualstudio.com/)

---

## 📝 Notes

- All extensions are free and open-source
- Some have optional premium features (GitLens Pro, etc.)
- Settings file can be customized per project
- Sync extensions across devices via Settings Sync

---

**Last Updated:** January 28, 2026
