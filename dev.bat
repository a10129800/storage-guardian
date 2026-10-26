@echo off
setlocal
echo ============================================================
echo  Storage Guardian - Development Server
echo ============================================================
echo.

if not exist node_modules goto :INSTALL_DEPS
goto :START_DEV

:INSTALL_DEPS
echo [INFO] Dependencies not found. Installing node_modules...
echo.
call npm install
if errorlevel 1 goto :INSTALL_FAILED
echo.
echo [SUCCESS] Dependencies installed successfully!
echo.
goto :START_DEV

:INSTALL_FAILED
echo.
echo ============================================================
echo [ERROR] npm install failed. Please check network and Node.js.
echo ============================================================
goto :END

:START_DEV
echo [INFO] Starting Vite and Electron dev server...
echo.
call npm run dev
if errorlevel 1 goto :DEV_FAILED
goto :END

:DEV_FAILED
echo.
echo ============================================================
echo [INFO] Dev server stopped or encountered an error.
echo ============================================================
goto :END

:END
echo.
pause
endlocal
