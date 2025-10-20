@echo off
REM Docker Setup Verification Script for PageDrift (Windows)
REM This script checks if your environment is properly configured for deployment

echo.
echo PageDrift Docker Setup Verification
echo =======================================
echo.

set ERRORS=0
set WARNINGS=0

REM Check Docker installation
echo 1. Checking Docker installation...
docker --version >nul 2>&1
if %errorlevel% equ 0 (
    docker --version
    echo [OK] Docker installed
) else (
    echo [ERROR] Docker is not installed
    set /a ERRORS+=1
)

echo.
echo 2. Checking Docker Compose installation...
docker compose version >nul 2>&1
if %errorlevel% equ 0 (
    docker compose version
    echo [OK] Docker Compose installed
) else (
    docker-compose --version >nul 2>&1
    if %errorlevel% equ 0 (
        docker-compose --version
        echo [OK] Docker Compose installed
    ) else (
        echo [ERROR] Docker Compose is not installed
        set /a ERRORS+=1
    )
)

echo.
echo 3. Checking environment configuration...
if exist .env (
    echo [OK] .env file exists
    
    echo.
    echo    Validating environment variables...
    
    REM Read and check critical variables
    findstr /C:"JWT_SECRET=" .env >nul 2>&1
    if %errorlevel% equ 0 (
        findstr /C:"your-super-secret-jwt-key-change-this" .env >nul 2>&1
        if %errorlevel% equ 0 (
            echo [ERROR] JWT_SECRET is using default value - must be changed!
            set /a ERRORS+=1
        ) else (
            findstr /C:"CHANGE-THIS-generate-with-openssl-rand-base64-32" .env >nul 2>&1
            if %errorlevel% equ 0 (
                echo [ERROR] JWT_SECRET is using default value - must be changed!
                set /a ERRORS+=1
            ) else (
                echo [OK] JWT_SECRET is configured
            )
        )
    ) else (
        echo [ERROR] JWT_SECRET is not set
        set /a ERRORS+=1
    )
    
    findstr /C:"MEILISEARCH_KEY=" .env >nul 2>&1
    if %errorlevel% equ 0 (
        findstr /C:"your-meilisearch-master-key-change-this" .env >nul 2>&1
        if %errorlevel% equ 0 (
            echo [ERROR] MEILISEARCH_KEY is using default value - must be changed!
            set /a ERRORS+=1
        ) else (
            echo [OK] MEILISEARCH_KEY is configured
        )
    ) else (
        echo [ERROR] MEILISEARCH_KEY is not set
        set /a ERRORS+=1
    )
    
    findstr /C:"MEILISEARCH_MASTER_KEY=" .env >nul 2>&1
    if %errorlevel% equ 0 (
        echo [OK] MEILISEARCH_MASTER_KEY is configured
    ) else (
        echo [ERROR] MEILISEARCH_MASTER_KEY is not set
        set /a ERRORS+=1
    )
    
    findstr /C:"DATABASE_URL=.*file:/app/data/db/" .env >nul 2>&1
    if %errorlevel% equ 0 (
        echo [OK] DATABASE_URL is configured for Docker
    ) else (
        echo [WARN] DATABASE_URL might not be configured for Docker
        set /a WARNINGS+=1
    )
    
    findstr /C:"MEILISEARCH_HOST=.*http://meilisearch:7700" .env >nul 2>&1
    if %errorlevel% equ 0 (
        echo [OK] MEILISEARCH_HOST is configured for Docker
    ) else (
        echo [WARN] MEILISEARCH_HOST might not be configured for Docker
        set /a WARNINGS+=1
    )
    
) else (
    echo [ERROR] .env file not found. Copy .env.docker or .env.example to .env
    set /a ERRORS+=1
)

echo.
echo 4. Checking Docker Compose configuration...
if exist docker-compose.yml (
    echo [OK] docker-compose.yml exists
) else (
    echo [ERROR] docker-compose.yml not found
    set /a ERRORS+=1
)

echo.
echo 5. Checking port availability...
netstat -ano | findstr ":3000" >nul 2>&1
if %errorlevel% equ 0 (
    echo [WARN] Port 3000 is already in use
    set /a WARNINGS+=1
) else (
    echo [OK] Port 3000 is available
)

netstat -ano | findstr ":7700" >nul 2>&1
if %errorlevel% equ 0 (
    echo [WARN] Port 7700 is already in use
    set /a WARNINGS+=1
) else (
    echo [OK] Port 7700 is available
)

echo.
echo 6. Checking data directories...
if exist data\ (
    echo [OK] ./data directory exists
) else (
    echo [OK] ./data directory will be created on first run
)

echo.
echo =======================================
echo Verification Summary
echo =======================================

if %ERRORS% equ 0 (
    if %WARNINGS% equ 0 (
        echo [OK] All checks passed!
        echo.
        echo You're ready to deploy! Run:
        echo   docker-compose up -d
    ) else (
        echo [WARN] %WARNINGS% warning(s) found
        echo.
        echo You can proceed, but review the warnings above.
        echo To deploy, run:
        echo   docker-compose up -d
    )
) else (
    echo [ERROR] %ERRORS% error(s) and %WARNINGS% warning(s) found
    echo.
    echo Please fix the errors above before deploying.
    echo.
    echo Quick fixes:
    echo   1. Copy environment file: copy .env.docker .env
    echo   2. Edit .env and update JWT_SECRET and MEILISEARCH keys
    echo   3. You can use any password generator or random string
    exit /b 1
)

echo.
echo For detailed deployment instructions, see:
echo   - DOCKER_DEPLOYMENT.md (comprehensive guide)
echo   - README.md (quick start)
echo.

