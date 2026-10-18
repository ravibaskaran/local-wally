# Local Wally one-click updater
# ---------------------------------------------------------------------------
# Downloads the LATEST GitHub release and overlays its runtime files onto every
# installed Local Wally wallpaper folder it can find (installer and Microsoft
# Store layouts). Lively stores your customized values in its SaveData folder
# keyed by wallpaper id, so overlaying the files PRESERVES your settings -
# API keys, manual location, units, everything.
#
# Usage: double-click upgrade-local-wally.bat (this script is fetched fresh by
# the launcher, so it always runs the latest version).
# No admin rights needed. Safe to run repeatedly.

$ErrorActionPreference = 'Stop'
try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 } catch {}

$zipUrl = 'https://github.com/ravibaskaran/local-wally/releases/latest/download/local-wally.zip'
$tmpRoot = Join-Path $env:TEMP ('lw-upgrade-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
$zipPath = Join-Path $tmpRoot 'local-wally.zip'
$extract = Join-Path $tmpRoot 'files'

function Write-Step($msg)  { Write-Host $msg -ForegroundColor Cyan }
function Write-Warn2($msg) { Write-Host $msg -ForegroundColor Yellow }
function Write-Ok($msg)    { Write-Host $msg -ForegroundColor Green }

Write-Host ''
Write-Host '  Local Wally - one-click updater' -ForegroundColor White
Write-Host '  ================================' -ForegroundColor DarkGray
Write-Host ''

try {
    New-Item -ItemType Directory -Path $extract -Force | Out-Null

    Write-Step "Downloading the latest release..."
    Invoke-WebRequest -Uri $zipUrl -OutFile $zipPath -UseBasicParsing

    Write-Step "Extracting..."
    Expand-Archive -Path $zipPath -DestinationPath $extract -Force

    # Sanity: the package must be ours before we touch any installation.
    foreach ($required in @('index.html', 'js\app.js', 'js\api.js', 'css\style.css', 'LivelyInfo.json')) {
        if (-not (Test-Path (Join-Path $extract $required))) {
            throw "The downloaded package is missing '$required' - aborting without changes."
        }
    }

    # Find every installed Local Wally wallpaper. Discovery is CONTENT-BASED
    # because Lively 2.x names wallpaper folders by random id and the library
    # directory can be relocated (Settings.json -> WallpaperDir, e.g. to
    # another drive). v0.8.19.
    $roots = @()

    # 1. Relocated library: read WallpaperDir from Lively's Settings.json in
    #    both the Store and installer layouts.
    $settingsCandidates = @(
        (Join-Path $env:LOCALAPPDATA 'Lively Wallpaper\Settings.json')
    )
    $pkgsDir = Join-Path $env:LOCALAPPDATA 'Packages'
    if (Test-Path $pkgsDir) {
        Get-ChildItem $pkgsDir -Directory -Filter '12030rocksdanister.LivelyWallpaper*' -ErrorAction SilentlyContinue | ForEach-Object {
            $settingsCandidates += (Join-Path $_.FullName 'LocalCache\Local\Lively Wallpaper\Settings.json')
        }
    }
    foreach ($settingsFile in $settingsCandidates) {
        if (-not (Test-Path $settingsFile)) { continue }
        try {
            $settings = Get-Content $settingsFile -Raw | ConvertFrom-Json
            $wallpaperDir = $settings.WallpaperDir
            if ($wallpaperDir -and (Test-Path $wallpaperDir)) {
                $relocated = Join-Path $wallpaperDir 'wallpapers'
                if (Test-Path $relocated) { $roots += $relocated }
                $roots += $wallpaperDir
            }
        } catch {
            Write-Warn2 ('  Could not read ' + $settingsFile + ' - skipping.')
        }
    }

    # 2. The standard layouts (unrelocated installs).
    $installer = Join-Path $env:LOCALAPPDATA 'Lively Wallpaper\Library\wallpapers'
    if (Test-Path $installer) { $roots += $installer }
    $pkgs = Join-Path $env:LOCALAPPDATA 'Packages'
    if (Test-Path $pkgs) {
        Get-ChildItem $pkgs -Directory -Filter '12030rocksdanister.LivelyWallpaper*' -ErrorAction SilentlyContinue | ForEach-Object {
            $p = Join-Path $_.FullName 'LocalCache\Local\Lively Wallpaper\Library\wallpapers'
            if (Test-Path $p) { $roots += $p }
        }
    }
    $roots = $roots | Select-Object -Unique

    $targets = @()
    foreach ($root in $roots) {
        Get-ChildItem $root -Directory -ErrorAction SilentlyContinue | ForEach-Object {
            # Never touch a development checkout (contains .git / scratch).
            if ((Test-Path (Join-Path $_.FullName '.git')) -or (Test-Path (Join-Path $_.FullName 'scratch'))) { return }
            # Identity: our exact runtime layout. Specific enough on its own.
            $infoFile = Join-Path $_.FullName 'LivelyInfo.json'
            $appFile = Join-Path $_.FullName 'js\app.js'
            $apiFile = Join-Path $_.FullName 'js\api.js'
            $cssFile = Join-Path $_.FullName 'css\style.css'
            $indexFile = Join-Path $_.FullName 'index.html'
            if ((Test-Path $infoFile) -and (Test-Path $appFile) -and (Test-Path $apiFile) -and (Test-Path $cssFile) -and (Test-Path $indexFile)) {
                $targets += $_.FullName
            }
        }
    }
    $targets = $targets | Select-Object -Unique

    if ($targets.Count -eq 0) {
        Write-Warn2 'No installed Local Wally wallpaper was found.'
        Write-Host  'Import local-wally.zip into Lively first (drag & drop onto the Lively window),'
        Write-Host  'then run this updater again for future releases.'
        exit 1
    }

    $updated = 0
    foreach ($t in $targets) {
        Write-Step ("Updating: " + $t)
        try {
            Copy-Item -Path (Join-Path $extract '*') -Destination $t -Recurse -Force
            $updated++

            # Reconcile Lively's cached properties in SaveData so new settings appear in Customise
            $wpId = Split-Path $t -Leaf
            $newPropsFile = Join-Path $t 'LivelyProperties.json'
            if (Test-Path $newPropsFile) {
                $saveDataRoots = @()
                $libraryDir = Split-Path $t -Parent
                $parentDir = Split-Path $libraryDir -Parent
                if ($parentDir) {
                    $saveDataRoots += (Join-Path $parentDir 'SaveData\wpdata')
                }
                $saveDataRoots += (Join-Path $env:LOCALAPPDATA 'Lively Wallpaper\SaveData\wpdata')
                $pkgsDir = Join-Path $env:LOCALAPPDATA 'Packages'
                if (Test-Path $pkgsDir) {
                    Get-ChildItem $pkgsDir -Directory -Filter '12030rocksdanister.LivelyWallpaper*' -ErrorAction SilentlyContinue | ForEach-Object {
                        $saveDataRoots += (Join-Path $_.FullName 'LocalCache\Local\Lively Wallpaper\SaveData\wpdata')
                    }
                }
                foreach ($sRoot in ($saveDataRoots | Select-Object -Unique)) {
                    $wpDataDir = Join-Path $sRoot $wpId
                    if (Test-Path $wpDataDir) {
                        Get-ChildItem $wpDataDir -Directory -ErrorAction SilentlyContinue | ForEach-Object {
                            $savedPropsPath = Join-Path $_.FullName 'LivelyProperties.json'
                            if (Test-Path $savedPropsPath) {
                                try {
                                    $newJson = Get-Content $newPropsFile -Raw | ConvertFrom-Json
                                    $savedJson = Get-Content $savedPropsPath -Raw | ConvertFrom-Json
                                    $modified = $false
                                    foreach ($prop in $newJson.PSObject.Properties) {
                                        if (-not $savedJson.PSObject.Properties[$prop.Name]) {
                                            $savedJson | Add-Member -MemberType NoteProperty -Name $prop.Name -Value $prop.Value
                                            $modified = $true
                                        }
                                    }
                                    if ($modified) {
                                        $savedJson | ConvertTo-Json -Depth 10 | Set-Content $savedPropsPath -Encoding UTF8
                                        Write-Step ("  Synchronized new settings schema to Lively SaveData: " + $_.FullName)
                                    }
                                } catch {}
                            }
                        }
                    }
                }
            }
        } catch {
            Write-Warn2 ("  Could not update this copy: " + $_.Exception.Message)
            Write-Warn2 '  Tip: switch Lively to another wallpaper (or exit Lively), then run again.'
        }
    }

    Write-Host ''
    Write-Ok ("Done - updated {0} of {1} installation(s)." -f $updated, $targets.Count)
    Write-Host ''
    Write-Host 'Next: re-select your wallpaper in Lively (or restart Lively) to load the new version.'
    Write-Host 'Your settings are preserved - Lively keeps them per wallpaper.'
    Write-Host ''
} catch {
    Write-Warn2 ("Updater failed: " + $_.Exception.Message)
    exit 1
} finally {
    Remove-Item $tmpRoot -Recurse -Force -ErrorAction SilentlyContinue
}
