# Local Wally - OneDrive Device Code Sign-In Helper
# ---------------------------------------------------------------------------
# Authenticates your personal OneDrive account using Microsoft Entra ID
# Device Authorization Grant (RFC 8628).
# No secrets, passwords, or location data are ever transmitted or stored.

$ErrorActionPreference = 'Stop'
try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 } catch {}

$clientId = 'd50ca740-c83f-4d1b-b616-12c519384f0c'
$scope = 'Files.ReadWrite offline_access'
$deviceCodeEndpoint = 'https://login.microsoftonline.com/common/oauth2/v2.0/devicecode'
$tokenEndpoint = 'https://login.microsoftonline.com/common/oauth2/v2.0/token'

Write-Host ''
Write-Host '  Local Wally: OneDrive Cloud Sign-In' -ForegroundColor Cyan
Write-Host '  ===================================' -ForegroundColor DarkGray
Write-Host ''

try {
    Write-Host 'Requesting device authentication code from Microsoft...' -ForegroundColor Yellow
    $body = @{
        client_id = $clientId
        scope     = $scope
    }
    $resp = Invoke-RestMethod -Uri $deviceCodeEndpoint -Method Post -Body $body -ContentType 'application/x-www-form-urlencoded'

    $userCode = $resp.user_code
    $deviceCode = $resp.device_code
    $interval = [Math]::Max(2, [int]($resp.interval))
    $verificationUri = if ($resp.verification_uri) { $resp.verification_uri } else { 'https://microsoft.com/devicelogin' }

    # Copy code to clipboard
    try {
        Set-Clipboard -Value $userCode
        Write-Host "  Code: $userCode (Copied to clipboard!)" -ForegroundColor Green
    } catch {
        Write-Host "  Code: $userCode" -ForegroundColor Green
    }

    Write-Host "  Opening browser to: $verificationUri" -ForegroundColor White
    Start-Process $verificationUri

    Write-Host ''
    Write-Host 'Please complete the following steps in your browser:' -ForegroundColor Cyan
    Write-Host "  1. Paste code $userCode into the Microsoft sign-in page." -ForegroundColor Gray
    Write-Host '  2. Sign in with your personal Microsoft account.' -ForegroundColor Gray
    Write-Host '  3. Click Accept to permit Local Wally settings synchronization.' -ForegroundColor Gray
    Write-Host ''
    Write-Host 'Waiting for authorization...' -ForegroundColor Yellow

    $deadline = (Get-Date).AddSeconds([int]($resp.expires_in))
    $authRecord = $null

    while ((Get-Date) -lt $deadline) {
        Start-Sleep -Seconds $interval
        $tokenBody = @{
            grant_type  = 'urn:ietf:params:oauth:grant-type:device_code'
            client_id   = $clientId
            device_code = $deviceCode
        }

        try {
            $tokenResp = Invoke-RestMethod -Uri $tokenEndpoint -Method Post -Body $tokenBody -ContentType 'application/x-www-form-urlencoded'
            if ($tokenResp.access_token) {
                $expiresAt = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() + ([int]($tokenResp.expires_in) * 1000)
                $authRecord = @{
                    accessToken  = $tokenResp.access_token
                    refreshToken = $tokenResp.refresh_token
                    expiresAt    = $expiresAt
                    tokenType    = if ($tokenResp.token_type) { $tokenResp.token_type } else { 'Bearer' }
                    scope        = if ($tokenResp.scope) { $tokenResp.scope } else { $scope }
                }
                break
            }
        } catch {
            $errText = $_.ErrorDetails.Message
            if ($errText -match 'authorization_pending') {
                Write-Host '.' -NoNewline -ForegroundColor DarkGray
                continue
            } elseif ($errText -match 'slow_down') {
                $interval += 5
                continue
            } elseif ($errText -match 'expired_token') {
                throw 'Device sign-in code has expired. Please run this script again.'
            } elseif ($errText -match 'access_denied') {
                throw 'Sign-in was cancelled by the user.'
            } else {
                Write-Host '.' -NoNewline -ForegroundColor DarkGray
                continue
            }
        }
    }

    Write-Host ''
    if (-not $authRecord) {
        throw 'Timed out waiting for sign-in approval.'
    }

    Write-Host ''
    Write-Host 'Sign-in successful! Microsoft tokens received.' -ForegroundColor Green

    # Save to onedrive_tokens.json in wallpaper directories
    $json = $authRecord | ConvertTo-Json -Depth 5
    $targetPaths = @(
        (Join-Path $PSScriptRoot '..\onedrive_tokens.json'),
        (Join-Path $PSScriptRoot 'onedrive_tokens.json'),
        'E:\utils\lively\wallpapers\ubvvowpx.ym4\onedrive_tokens.json',
        'E:\utils\lively\SaveData\wpdata\ubvvowpx.ym4\1\onedrive_tokens.json'
    )

    foreach ($tp in $targetPaths) {
        try {
            $parent = Split-Path $tp -Parent
            if (Test-Path $parent) {
                Set-Content -Path $tp -Value $json -Encoding UTF8
                Write-Host "  Saved token cache: $tp" -ForegroundColor DarkGray
            }
        } catch {}
    }

    Write-Host ''
    Write-Host 'OneDrive is now connected! Local Wally will automatically synchronize.' -ForegroundColor Green
    Write-Host ''
} catch {
    Write-Host ''
    Write-Host "Authentication failed: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ''
    exit 1
}
