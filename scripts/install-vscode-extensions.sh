#!/bin/bash

# VS Code Extensions Installation Script for LCL Project
# This script installs all recommended VS Code extensions

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║   Installing VS Code Extensions for LCL Project               ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Check if code CLI is available
if ! command -v code &> /dev/null; then
    echo "⚠️  VS Code CLI not found. Please add VS Code to PATH:"
    echo "   Or install via: https://code.visualstudio.com/docs/setup/mac"
    echo ""
    echo "Manual installation: Open VS Code and search for each extension ID"
    exit 1
fi

echo "Installing extensions..."
echo ""

# Group 1: Database & API Development
echo "📦 Group 1: Database & API Development..."
code --install-extension mtxr.sqltools
code --install-extension mtxr.sqltools-driver-pg
code --install-extension humao.rest-client
code --install-extension rangav.vscode-thunder-client
echo "✅ Group 1 complete"
echo ""

# Group 2: TypeScript & React
echo "📦 Group 2: TypeScript & React Enhancement..."
code --install-extension johnsoncodehk.volar
echo "✅ Group 2 complete"
echo ""

# Group 3: Git & Version Control
echo "📦 Group 3: Git & Version Control..."
code --install-extension eamodio.gitlens
code --install-extension mhutchie.git-graph
echo "✅ Group 3 complete"
echo ""

# Group 4: Documentation & Code Quality
echo "📦 Group 4: Documentation & Code Quality..."
code --install-extension yzhang.markdown-all-in-one
code --install-extension wix.vscode-import-cost
code --install-extension streetsidesoftware.code-spell-checker
echo "✅ Group 4 complete"
echo ""

# Group 5: Visual Enhancements
echo "📦 Group 5: Visual Enhancements..."
code --install-extension anseki.vscode-color
code --install-extension johnpapa.vscode-peacock
echo "✅ Group 5 complete"
echo ""

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║   ✅ All extensions installed successfully!                    ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
echo "Next steps:"
echo "1. Restart VS Code to load all extensions"
echo "2. Set up SQLTools connection to your Supabase database"
echo "3. Configure REST Client with your API endpoints"
echo ""
