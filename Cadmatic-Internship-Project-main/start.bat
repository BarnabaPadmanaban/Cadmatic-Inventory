@echo off
title Nuclear EMS Launcher
color 0B

echo.
echo  =============================================
echo     NUCLEAR EMS - Equipment Monitoring System
echo  =============================================
echo.

:: Check Node
node --version >nul 2>&1
IF %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js is not installed. Please install from https://nodejs.org
    pause
    exit /b 1
)
echo [OK] Node.js found

:: Backend setup
echo.
echo [1/4] Installing backend dependencies...
cd backend
IF NOT EXIST node_modules (
    call npm install
)

IF NOT EXIST .env (
    echo [WARN] .env not found - copying from .env.example
    copy .env.example .env
    echo [ACTION] Please edit backend\.env with your SQL Server credentials, then re-run this script.
    pause
    exit /b 1
)

echo [2/4] Running database migrations...
call node src/migrations/runMigrations.js
IF %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Migration failed. Check your DB_SERVER, DB_USER, DB_PASSWORD in backend\.env
    pause
    exit /b 1
)

echo [3/4] Starting backend server...
start "Nuclear EMS - Backend" cmd /k "npm run dev"

:: Frontend setup
cd ..\frontend
echo.
echo [4/4] Installing frontend dependencies...
IF NOT EXIST node_modules (
    call npm install
)

echo Starting React frontend...
start "Nuclear EMS - Frontend" cmd /k "npm start"

echo.
echo  =============================================
echo   Both servers are starting in new windows.
echo   Backend  -> http://localhost:5000
echo   Frontend -> http://localhost:3000
echo  =============================================
echo.
pause
