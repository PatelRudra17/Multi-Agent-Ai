#!/bin/bash

echo "=========================================="
echo "  Multi-Agent AI Website Builder"
echo "  Starting all services..."
echo "=========================================="

# Check for .env file
if [ ! -f .env ]; then
    echo ""
    echo "[!] No .env file found. Copying from .env.example..."
    cp .env.example .env
    echo "[!] You can add API keys in .env or via the Settings page in the UI."
    echo ""
fi

# Check Python
if ! command -v python3 &> /dev/null && ! command -v python &> /dev/null; then
    echo "[ERROR] Python is not installed. Please install Python 3.10+"
    exit 1
fi
PYTHON=$(command -v python3 || command -v python)

# Check Node
if ! command -v node &> /dev/null; then
    echo "[ERROR] Node.js is not installed. Please install Node.js 18+"
    exit 1
fi

# Start backend
echo ""
echo "[1/2] Starting Backend (FastAPI)..."
cd backend
pip install -r requirements.txt -q 2>/dev/null
$PYTHON main.py &
BACKEND_PID=$!
cd ..

# Start frontend
echo "[2/2] Starting Frontend (Next.js)..."
cd frontend
npm install --silent 2>/dev/null
npm run dev &
FRONTEND_PID=$!
cd ..

echo ""
echo "=========================================="
echo "  Backend:  http://localhost:8000"
echo "  Frontend: http://localhost:3000"
echo "  API Docs: http://localhost:8000/docs"
echo "=========================================="
echo ""
echo "Add your API keys at: http://localhost:3000/settings"
echo ""
echo "Press Ctrl+C to stop all services."

# Wait for both processes
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" SIGINT SIGTERM
wait
