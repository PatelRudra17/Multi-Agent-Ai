@echo off
echo ==========================================
echo   Multi-Agent AI Website Builder
echo   Starting all services...
echo ==========================================

REM Check for .env
if not exist .env (
    echo.
    echo [!] No .env file found. Copying from .env.example...
    copy .env.example .env
    echo [!] You can add API keys in .env or via the Settings page in the UI.
    echo.
)

REM Check Python
where python >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Python is not installed or not in PATH.
    echo Please install Python 3.10+ from https://python.org
    pause
    exit /b 1
)

REM Check Node
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed or not in PATH.
    echo Please install Node.js 18+ from https://nodejs.org
    pause
    exit /b 1
)

REM Install backend dependencies
echo.
echo [1/2] Setting up Backend...
cd backend
pip install -r requirements.txt -q 2>nul
start "Backend" cmd /c "python main.py"
cd ..

REM Install frontend dependencies
echo [2/2] Setting up Frontend...
cd frontend
call npm install --silent 2>nul
start "Frontend" cmd /c "npm run dev"
cd ..

echo.
echo ==========================================
echo   Backend:  http://localhost:8000
echo   Frontend: http://localhost:3000
echo   API Docs: http://localhost:8000/docs
echo ==========================================
echo.
echo Add your API keys at: http://localhost:3000/settings
echo.
echo Close this window or press Ctrl+C to stop.
pause
