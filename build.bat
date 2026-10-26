@echo off
setlocal
echo ============================================================
echo  Storage Guardian - Production Build
echo ============================================================
echo.

if not exist node_modules goto :INSTALL_DEPS
goto :START_BUILD

:INSTALL_DEPS
echo [INFO] Dependencies not found. Installing node_modules...
echo.
call npm install
if errorlevel 1 goto :BUILD_FAILED

:START_BUILD
echo [INFO] Building TypeScript and Vite production bundle...
echo.
call npm run build
if errorlevel 1 goto :BUILD_FAILED

echo.
echo ============================================================
echo [SUCCESS] Build completed! Output directories: dist and dist-electron
echo ============================================================
goto :END

:BUILD_FAILED
echo.
echo ============================================================
echo [ERROR] Build failed! Please check error logs above.
echo ============================================================
goto :END

:END
echo.
pause
endlocal
