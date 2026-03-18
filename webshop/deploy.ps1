Write-Host '  ========================================' -ForegroundColor Green
Write-Host '      WEBSHOP Railway Deploy (Win)        ' -ForegroundColor Green
Write-Host '  ========================================' -ForegroundColor Green

if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
    Write-Host '-> GitHub CLI is required. Download at https://cli.github.com' -ForegroundColor Yellow
    exit 1
}
if (-not (Get-Command railway -ErrorAction SilentlyContinue)) {
    Write-Host '-> Railway CLI installing...' -ForegroundColor Yellow
    npm install -g @railway/cli
}

Write-Host '-> 1. GitHub Repo login and create...' -ForegroundColor Yellow
gh auth login
gh repo create webshop-platform --public --push --source=. --remote=origin

Write-Host '-> 2. Railway login...' -ForegroundColor Yellow
railway login
railway init --name webshop-platform

Write-Host '=== 3. Environment variables ===' -ForegroundColor Yellow
$JWT = Read-Host "ACCESS_JWT_SECRET (press Enter to auto-generate)"
if ([string]::IsNullOrWhiteSpace($JWT)) { $JWT = [guid]::NewGuid().ToString() }
railway variables set ACCESS_JWT_SECRET="$JWT"

$RJWT = Read-Host "REFRESH_JWT_SECRET (press Enter to auto-generate)"
if ([string]::IsNullOrWhiteSpace($RJWT)) { $RJWT = [guid]::NewGuid().ToString() }
railway variables set REFRESH_JWT_SECRET="$RJWT"

$SITOKEN = [guid]::NewGuid().ToString()
railway variables set SYSTEM_INTERNAL_TOKEN="$SITOKEN"
railway variables set NODE_ENV="production"
railway variables set PORT="4000"

$QUSER = Read-Host "QPAY_USERNAME (press Enter to skip)"
if (-not [string]::IsNullOrWhiteSpace($QUSER)) { railway variables set QPAY_USERNAME="$QUSER" }

$QPASS = Read-Host "QPAY_PASSWORD (press Enter to skip)"
if (-not [string]::IsNullOrWhiteSpace($QPASS)) { railway variables set QPAY_PASSWORD="$QPASS" }

Write-Host '-> Deploying to cloud... (Please wait approx 5 minutes)' -ForegroundColor Yellow
railway up --detach

Write-Host "  Done! Check your Railway dashboard for the live URL." -ForegroundColor Green
