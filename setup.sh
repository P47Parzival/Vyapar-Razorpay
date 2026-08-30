#!/usr/bin/env bash
set -e

echo ""
echo "  ╔══════════════════════════════════════════════╗"
echo "  ║   Vyapar — Bounded Agentic Commerce Setup    ║"
echo "  ╚══════════════════════════════════════════════╝"
echo ""

# ── 1. Check Node.js ──
if ! command -v node &>/dev/null; then
  echo "ERROR: Node.js is required. Install from https://nodejs.org (v18+)"
  exit 1
fi

NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
  echo "ERROR: Node.js v18+ required (found $(node -v))"
  exit 1
fi
echo "[1/5] Node.js $(node -v) ✓"

# ── 2. Install dependencies ──
echo "[2/5] Installing dependencies (all workspaces)..."
npm install --silent 2>/dev/null || npm install
echo "      Dependencies installed ✓"

# ── 3. Environment file ──
if [ ! -f .env ]; then
  if [ -f .env.example ]; then
    cp .env.example .env
    echo "[3/5] Created .env from .env.example"
    echo ""
    echo "  ⚠  IMPORTANT: Open .env and fill in your credentials:"
    echo "     - RAZORPAY_KEY_ID      (test key from https://dashboard.razorpay.com)"
    echo "     - RAZORPAY_KEY_SECRET   (test secret)"
    echo "     - BEDROCK_API_KEY       (AWS Bedrock API key for AI agents)"
    echo ""
    echo "  The dashboard UI works without these, but AI agents"
    echo "  and payment features require valid credentials."
    echo ""
  else
    echo "[3/5] WARNING: No .env.example found. Create .env manually."
  fi
else
  echo "[3/5] .env already exists ✓"
fi

# ── 4. Setup MCP for Claude Desktop (optional) ──
echo "[4/5] MCP Server setup..."

CLAUDE_CONFIG=""
if [ -n "$APPDATA" ]; then
  CLAUDE_CONFIG="$APPDATA/Claude/claude_desktop_config.json"
elif [ -d "$HOME/Library/Application Support/Claude" ]; then
  CLAUDE_CONFIG="$HOME/Library/Application Support/Claude/claude_desktop_config.json"
elif [ -d "$HOME/.config/Claude" ]; then
  CLAUDE_CONFIG="$HOME/.config/Claude/claude_desktop_config.json"
fi

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
# Convert to forward slashes for JSON on Windows
PROJECT_DIR_JSON=$(echo "$PROJECT_DIR" | sed 's/\\/\//g')

if [ -n "$CLAUDE_CONFIG" ]; then
  # Check if config dir exists
  CONFIG_DIR=$(dirname "$CLAUDE_CONFIG")
  if [ -d "$CONFIG_DIR" ]; then
    if [ -f "$CLAUDE_CONFIG" ]; then
      # Check if vyapar is already configured
      if grep -q "vyapar" "$CLAUDE_CONFIG" 2>/dev/null; then
        echo "      Vyapar MCP already configured in Claude Desktop ✓"
      else
        echo "      Claude Desktop config found at: $CLAUDE_CONFIG"
        echo ""
        echo "  To enable Vyapar as an MCP server in Claude Desktop,"
        echo "  add this to the \"mcpServers\" section of your config:"
        echo ""
        echo "    \"vyapar\": {"
        echo "      \"command\": \"npx\","
        echo "      \"args\": [\"tsx\", \"packages/server/src/mcp-server/mcp-stdio.ts\"],"
        echo "      \"cwd\": \"$PROJECT_DIR_JSON\""
        echo "    }"
        echo ""
      fi
    else
      echo "      Claude Desktop installed but no config found."
      echo "      Creating config with Vyapar MCP server..."
      cat > "$CLAUDE_CONFIG" << MCPEOF
{
  "mcpServers": {
    "vyapar": {
      "command": "npx",
      "args": ["tsx", "packages/server/src/mcp-server/mcp-stdio.ts"],
      "cwd": "$PROJECT_DIR_JSON"
    }
  }
}
MCPEOF
      echo "      Claude Desktop MCP config created ✓"
    fi
  else
    echo "      Claude Desktop not found — skipping MCP setup."
    echo "      (Install Claude Desktop to use in-app checkout)"
  fi
else
  echo "      Could not detect Claude Desktop config path — skipping."
fi

# ── 5. Start ──
echo "[5/5] Starting Vyapar..."
echo ""
echo "  ┌────────────────────────────────────────────┐"
echo "  │  Dashboard:  http://localhost:5173/dashboard│"
echo "  │  Server API: http://localhost:3001          │"
echo "  │  MCP:        http://localhost:3001/mcp      │"
echo "  └────────────────────────────────────────────┘"
echo ""

npm run dev
