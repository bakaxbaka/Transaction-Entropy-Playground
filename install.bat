
@echo off
echo ====================================
echo CryptoHunter Installation Script
echo ====================================
echo.

echo Checking Node.js installation...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Node.js is not installed!
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

echo Node.js version:
node --version
echo.

echo Checking npm installation...
npm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: npm is not installed!
    pause
    exit /b 1
)

echo npm version:
npm --version
echo.

echo Installing dependencies...
echo.
call npm install

if %errorlevel% neq 0 (
    echo.
    echo ERROR: Failed to install dependencies!
    pause
    exit /b 1
)

echo.
echo ====================================
echo Installation completed successfully!
echo ====================================
echo.
echo To start the application, run:
echo   npm run dev
echo.
pause
