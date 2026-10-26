@echo off
setlocal
echo ============================================================
echo  Storage Guardian - Install Dependencies
echo ============================================================
echo.

echo [1/3] Checking Node.js environment...
where node >nul 2>nul
if errorlevel 1 goto :NODE_NOT_FOUND

echo [2/3] Checking npm package manager...
where npm >nul 2>nul
if errorlevel 1 goto :NPM_NOT_FOUND

echo [3/3] Installing dependencies (npm install)...
echo.
call npm install
if errorlevel 1 goto :INSTALL_ERROR

echo.
echo ============================================================
echo [SUCCESS] Dependencies installed successfully!
echo You can now run dev.bat or test.bat.
echo ============================================================
goto :END

:NODE_NOT_FOUND
echo.
echo ============================================================
echo [ERROR] Node.js is not found. Please install Node.js from https://nodejs.org
echo ============================================================
goto :END

:NPM_NOT_FOUND
echo.
echo ============================================================
echo [ERROR] npm is not found in your system PATH.
echo ============================================================
goto :END

:INSTALL_ERROR
echo.
echo ============================================================
echo [ERROR] npm install encountered an error. Please check your network connection.
echo ============================================================
goto :END

:END
echo.
pause
endlocal
