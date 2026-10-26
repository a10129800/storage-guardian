@echo off
setlocal
echo ============================================================
echo  Storage Guardian - Automated Test Suite
echo ============================================================
echo.
echo [INFO] Running unit, security and sandbox integration tests...
echo.

node scripts/runAllTests.js

if errorlevel 1 goto :TEST_FAILED
goto :TEST_PASSED

:TEST_FAILED
echo.
echo ============================================================
echo [ERROR] Test suite failed! Please check error details above.
echo ============================================================
goto :TEST_END

:TEST_PASSED
echo.
echo ============================================================
echo [SUCCESS] All unit, security, and integration tests passed!
echo ============================================================
goto :TEST_END

:TEST_END
echo.
pause
endlocal
