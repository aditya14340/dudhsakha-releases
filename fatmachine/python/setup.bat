@echo off
setlocal EnableDelayedExpansion
:: DudhSakha Python Setup - Double-click to install all required libraries
title DudhSakha Python Setup
color 0A
echo.
echo  ============================================================
echo   DudhSakha  Python Environment Setup
echo   This installs all required Python libraries.
echo  ============================================================
echo.
echo  [Step 1/5]  Checking Python installation...
echo.
where python >nul 2>nul
if errorlevel 1 (
    color 0C
    echo.
    echo  [ERROR] Python is NOT installed on this computer!
    echo.
    echo  Download Python 3.8+ from: https://www.python.org/downloads/
    echo.
    echo  IMPORTANT: During install, check the box - Add Python to PATH
    echo.
    echo  After installing Python, run this setup.bat again.
    start https://www.python.org/downloads/
    goto :DONE_FAIL
)
python --version
echo.
echo  [Step 2/5]  Checking Python version...
echo.
python --version
echo    [OK] Version check passed
echo.
echo  [Step 3/5]  Upgrading pip...
echo.
python -m pip install --upgrade pip
if errorlevel 1 (
    echo    [WARN] pip upgrade had an issue - will continue anyway
) else (
    echo    [OK] pip is up to date
)
echo.
echo  [Check]  Testing internet connection to PyPI...
echo.
python -m pip index versions pip >nul 2>nul
if errorlevel 1 (
    color 0C
    echo    [ERROR] Cannot connect to PyPI ^(pypi.org^)!
    echo.
    echo    This computer cannot reach the internet or a firewall is blocking pip.
    echo.
    echo    SOLUTIONS:
    echo      1. Connect to the internet and run again
    echo      2. Disable antivirus/firewall temporarily and run again
    echo      3. If on office/company network - ask IT to allow pypi.org
    echo.
    goto :DONE_FAIL
)
echo    [OK] Internet connection OK - can reach PyPI
echo.
echo  [Step 4/5]  Installing required libraries...
echo    ^(Errors will be shown below if something fails^)
echo.
set FAIL=0
echo    ----------------------------------------
echo    [1/4] Installing pyserial...
echo    ----------------------------------------
python -m pip install pyserial
if errorlevel 1 ( set FAIL=1 & echo    [FAILED] pyserial ) else ( echo    [OK]     pyserial installed )
echo.
echo    ----------------------------------------
echo    [2/4] Installing customtkinter...
echo    ----------------------------------------
python -m pip install customtkinter
if errorlevel 1 ( set FAIL=1 & echo    [FAILED] customtkinter ) else ( echo    [OK]     customtkinter installed )
echo.
echo    ----------------------------------------
echo    [3/4] Installing edge-tts...
echo    ----------------------------------------
python -m pip install edge-tts
if errorlevel 1 ( set FAIL=1 & echo    [FAILED] edge-tts ) else ( echo    [OK]     edge-tts installed )
echo.
echo    ----------------------------------------
echo    [4/4] Installing pdfplumber...
echo    ----------------------------------------
python -m pip install pdfplumber
if errorlevel 1 ( set FAIL=1 & echo    [FAILED] pdfplumber ) else ( echo    [OK]     pdfplumber installed )
echo.
echo  [Step 5/5]  Verifying imports...
echo.
set VFAIL=0
python -c "import serial" 2>nul
if errorlevel 1 ( set VFAIL=1 & echo    [FAIL] pyserial - import error ) else ( echo    [OK]     pyserial )
python -c "import customtkinter" 2>nul
if errorlevel 1 ( set VFAIL=1 & echo    [FAIL] customtkinter - import error ) else ( echo    [OK]     customtkinter )
python -c "import edge_tts" 2>nul
if errorlevel 1 ( set VFAIL=1 & echo    [FAIL] edge-tts - import error ) else ( echo    [OK]     edge-tts )
python -c "import pdfplumber" 2>nul
if errorlevel 1 ( set VFAIL=1 & echo    [FAIL] pdfplumber - import error ) else ( echo    [OK]     pdfplumber )
echo.
if %FAIL%==1 goto :DONE_FAIL
if %VFAIL%==1 goto :DONE_FAIL
color 0A
echo  ============================================================
echo   ALL DONE - Setup Complete! App is ready to run.
echo  ============================================================
echo.
echo   Installed libraries:
echo     pyserial       - Fat machine + weight machine serial port
echo     customtkinter  - Fat machine UI window
echo     edge-tts       - Marathi/Hindi voice announcements ^(TTS^)
echo     pdfplumber     - PDF reading for farmer data
echo.
goto :DONE
:DONE_FAIL
color 0C
echo  ============================================================
echo   SETUP INCOMPLETE - One or more libraries failed.
echo  ============================================================
echo.
echo   Scroll UP in this window to see the exact error message.
echo.
echo   Most common fixes:
echo     1. Check internet connection - pip needs internet to download
echo     2. Disable antivirus / Windows Defender temporarily
echo     3. Right-click setup.bat - Run as Administrator
echo     4. Manually open CMD and run:
echo          pip install pyserial customtkinter edge-tts pdfplumber
echo.
:DONE
echo  Press any key to close...
pause >nul
color 07
endlocal
