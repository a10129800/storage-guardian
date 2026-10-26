@echo off
setlocal
echo ============================================================
echo  Storage Guardian - Setup Test Sandbox
echo ============================================================
echo.
echo [INFO] Creating isolated test sandbox in %%TEMP%%\StorageGuardian-Sandbox...
echo.

node scripts/setupSandbox.js

if errorlevel 1 goto :SETUP_FAILED
goto :SETUP_PASSED

:SETUP_FAILED
echo.
echo ============================================================
echo [ERROR] Failed to create sandbox files.
echo ============================================================
goto :END

:SETUP_PASSED
echo.
echo ============================================================
echo [SUCCESS] Test sandbox is ready!
echo You can now select this folder in Storage Guardian GUI.
echo ============================================================
goto :END

:END
echo.
pause
endlocal
