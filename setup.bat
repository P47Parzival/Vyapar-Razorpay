@echo off
echo.
echo   ========================================
echo     Vyapar - Bounded Agentic Commerce Setup
echo   ========================================
echo.

:: 1. Check Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo ERROR: Node.js is required. Install from https://nodejs.org ^(v18+^)
    exit /b 1
)
for /f "tokens=1 delims=." %%a in ('node -v') do set NODE_VER=%%a
echo [1/5] Node.js detected

:: 2. Install dependencies
echo [2/5] Installing dependencies (all workspaces)...
call npm install
echo       Dependencies installed

:: 3. Environment file
if not exist .env (
    if exist .env.example (
        copy .env.example .env >nul
        echo [3/5] Created .env from .env.example
        echo.
        echo   WARNING: Open .env and fill in your credentials:
        echo     - RAZORPAY_KEY_ID      ^(test key from https://dashboard.razorpay.com^)
        echo     - RAZORPAY_KEY_SECRET   ^(test secret^)
        echo     - BEDROCK_API_KEY       ^(AWS Bedrock API key for AI agents^)
        echo.
    ) else (
        echo [3/5] WARNING: No .env.example found. Create .env manually.
    )
) else (
    echo [3/5] .env already exists
)

:: 4. MCP setup info
echo [4/5] MCP Server setup...
echo       To use Vyapar in Claude Desktop, add to your Claude config:
echo       %%APPDATA%%\Claude\claude_desktop_config.json
echo.
echo       "vyapar": {
echo         "command": "npx",
echo         "args": ["tsx", "packages/server/src/mcp-server/mcp-stdio.ts"],
echo         "cwd": "%cd%"
echo       }
echo.

:: 5. Start
echo [5/5] Starting Vyapar...
echo.
echo   Dashboard:  http://localhost:5173/dashboard
echo   Server API: http://localhost:3001
echo   MCP:        http://localhost:3001/mcp
echo.

call npm run dev
