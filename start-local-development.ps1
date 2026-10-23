[CmdletBinding()]
param(
  [string]$McpRepository,
  [string]$DemoRepository,
  [switch]$IncludeProductB,
  [switch]$IncludeSdkHost,
  [switch]$SkipStandaloneWeb,
  [switch]$OpenBrowser,
  [switch]$DryRun
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$mainRepository = $PSScriptRoot
$repositoryParent = Split-Path $mainRepository -Parent
if ([string]::IsNullOrWhiteSpace($McpRepository)) {
  $McpRepository = Join-Path $repositoryParent "Deep-Agents-AI-Assistant-MCP"
}
if ([string]::IsNullOrWhiteSpace($DemoRepository)) {
  $DemoRepository = Join-Path $repositoryParent "Deep-Agents-AI-Assistant-Demo"
}

function ConvertTo-SingleQuotedPowerShellLiteral {
  param([Parameter(Mandatory)][string]$Value)

  return [string]::Concat("'", $Value.Replace("'", "''"), "'")
}

function Assert-RequiredPath {
  param(
    [Parameter(Mandatory)][string]$Path,
    [Parameter(Mandatory)][string]$Description
  )

  if (-not (Test-Path -LiteralPath $Path)) {
    throw "$Description does not exist: $Path"
  }
}

function Assert-PortAvailable {
  param([Parameter(Mandatory)][int]$Port)

  if (-not (Get-Command Get-NetTCPConnection -ErrorAction SilentlyContinue)) {
    return
  }

  $listener = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
  if ($null -ne $listener) {
    throw "TCP port $Port is already in use. Stop the existing process or change the local startup configuration."
  }
}

function Start-DevelopmentTerminal {
  param(
    [Parameter(Mandatory)][string]$Title,
    [Parameter(Mandatory)][string]$LogName,
    [Parameter(Mandatory)][string]$WorkingDirectory,
    [Parameter(Mandatory)][hashtable]$Environment,
    [Parameter(Mandatory)][string]$Command
  )

  $transcriptPath = Join-Path $script:logDirectory "$LogName.log"
  $titleLine = '$Host.UI.RawUI.WindowTitle = {0}' -f (ConvertTo-SingleQuotedPowerShellLiteral $Title)
  $workingDirectoryLine = 'Set-Location -LiteralPath {0}' -f (ConvertTo-SingleQuotedPowerShellLiteral $WorkingDirectory)
  $transcriptLine = 'Start-Transcript -LiteralPath {0} -Force | Out-Null' -f (ConvertTo-SingleQuotedPowerShellLiteral $transcriptPath)
  $lines = @(
    '$ErrorActionPreference = "Stop"',
    $titleLine,
    $workingDirectoryLine,
    $transcriptLine
  )

  foreach ($name in ($Environment.Keys | Sort-Object)) {
    $value = [string]$Environment[$name]
    $lines += '$env:{0} = {1}' -f $name, (ConvertTo-SingleQuotedPowerShellLiteral $value)
  }

  $lines += 'try {'
  $lines += "  & $Command"
  $lines += '  if ($LASTEXITCODE -ne 0) { Write-Host "Process exited with code $LASTEXITCODE" -ForegroundColor Red }'
  $lines += '} catch {'
  $lines += '  Write-Error $_'
  $lines += '} finally {'
  $lines += '  Stop-Transcript | Out-Null'
  $lines += '}'

  $generatedScript = $lines -join [Environment]::NewLine
  $parseErrors = $null
  [System.Management.Automation.Language.Parser]::ParseInput(
    $generatedScript,
    [ref]$null,
    [ref]$parseErrors
  ) | Out-Null
  if ($parseErrors.Count -gt 0) {
    throw "Generated child script for '$Title' is invalid: $($parseErrors[0].Message)"
  }
  if ($lines[2] -ne $workingDirectoryLine -or -not $generatedScript.Contains($Command)) {
    throw "Generated child script for '$Title' lost its working directory or command."
  }

  $encodedCommand = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($generatedScript))
  $decodedCommand = [Text.Encoding]::Unicode.GetString([Convert]::FromBase64String($encodedCommand))
  if ($decodedCommand -cne $generatedScript) {
    throw "Generated child script for '$Title' failed its encoded-command round trip."
  }
  Write-Verbose "Generated child script for '$Title':`n$generatedScript"

  if ($script:DryRun) {
    Write-Host "[dry-run] $Title -> $WorkingDirectory -> $Command -> $transcriptPath"
    return
  }

  Start-Process -FilePath $script:powerShellExecutable -ArgumentList @(
    "-NoLogo",
    "-NoExit",
    "-EncodedCommand",
    $encodedCommand
  ) | Out-Null
}

function Wait-ForHttpPages {
  param(
    [Parameter(Mandatory)][string[]]$Urls,
    [int]$TimeoutSeconds = 60
  )

  $ready = @()
  $pending = @($Urls)
  $deadline = [DateTime]::UtcNow.AddSeconds($TimeoutSeconds)

  while ($pending.Count -gt 0 -and [DateTime]::UtcNow -lt $deadline) {
    foreach ($url in @($pending)) {
      try {
        $response = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 1 -ErrorAction Stop
        if ([int]$response.StatusCode -ge 200 -and [int]$response.StatusCode -lt 500) {
          $ready += $url
          $pending = @($pending | Where-Object { $_ -ne $url })
          Write-Host "Ready: $url" -ForegroundColor Green
        }
      } catch {
        # The service is still starting. Its terminal and transcript contain the actionable error.
      }
    }

    if ($pending.Count -gt 0) {
      Start-Sleep -Milliseconds 500
    }
  }

  return @{
    Ready = @($ready)
    Pending = @($pending)
  }
}

$productAEntry = Join-Path $McpRepository "product-a-mcp\dist\stdio.js"
$productBEntry = Join-Path $McpRepository "product-b-mcp\dist\stdio.js"

Assert-RequiredPath -Path (Join-Path $mainRepository "package.json") -Description "Main repository"
Assert-RequiredPath -Path (Join-Path $mainRepository ".env") -Description "Main repository model configuration"
Assert-RequiredPath -Path (Join-Path $McpRepository "package.json") -Description "MCP repository"
Assert-RequiredPath -Path $productAEntry -Description "Built Product A MCP stdio entry"
if ($IncludeProductB) {
  Assert-RequiredPath -Path $productBEntry -Description "Built Product B MCP stdio entry"
}
Assert-RequiredPath -Path (Join-Path $DemoRepository "package.json") -Description "Demo repository"

if (-not (Get-Command pnpm.cmd -ErrorAction SilentlyContinue)) {
  throw "pnpm.cmd is not available in PATH. Install/enable pnpm before running this script."
}
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw "Node.js is not available in PATH. Install Node.js 22 or newer before running this script."
}

$powerShellExecutable = (Get-Process -Id $PID).Path
if (-not $powerShellExecutable) {
  throw "Unable to resolve the current PowerShell executable."
}

$productAServer = @{
  serverId = "product-a-mcp"
  serverEntry = $productAEntry.Replace("\", "/")
  approvals = @(
    @{
      toolName = "get_quality_trend"
      schemaDigest = "1e186399a946e06fc251f535634a99d0321b409c8c2eb190b97e3a397745812e"
      riskLevel = "read"
    },
    @{
      toolName = "list_table_sample_rows"
      schemaDigest = "03f9da7b21f7b939067086a0a4ce73fd4616a8775adab5521a1a4d01a5b8ec02"
      riskLevel = "read"
    },
    @{
      toolName = "get_table_metadata"
      schemaDigest = "2d2e31afa7ad70790db3d6be316135f46929f2cba0e16e1d06ebec2d41cf17ab"
      riskLevel = "read"
    },
    @{
      toolName = "search_data_assets"
      schemaDigest = "2036488ae65f79f663b176ba9c77c6534169df8d24b6e17b5f8f5a008b0fb761"
      riskLevel = "read"
    }
  )
}

$productBServer = @{
  serverId = "product-b-mcp"
  serverEntry = $productBEntry.Replace("\", "/")
  approvals = @(
    @{
      toolName = "list_open_work_orders"
      schemaDigest = "61548a2b7784e93e18fa8b5c58ba6d3535d7a1de443c8d853b7837b90778b4ee"
      riskLevel = "read"
    }
  )
}

$productAConfig = ConvertTo-Json -InputObject @($productAServer) -Depth 8 -Compress
$productBConfig = ConvertTo-Json -InputObject @($productBServer) -Depth 8 -Compress
$combinedConfig = ConvertTo-Json -InputObject @($productAServer, $productBServer) -Depth 8 -Compress
$productAPlatformExtensions = ConvertTo-Json -InputObject @(
  @{
    moduleSpecifier = "@assistant/platform-host-navigation-extension"
    approval = @{
      id = "host-navigation"
      version = "1.0.0"
      manifestDigest = "0c8645da7bb1745266ad75c45b0136df9e9048b6785b4a224dc9097da5447377"
    }
  }
) -Depth 6 -Compress

$ports = @(3411, 5511, 5411)
if (-not $SkipStandaloneWeb) {
  $ports += 5173
}
if ($IncludeProductB) {
  $ports += @(3412, 5512, 5412, 5174)
}
if ($IncludeSdkHost) {
  $ports += @(3310, 5314)
}
$ports | ForEach-Object { Assert-PortAvailable -Port $_ }

$runId = Get-Date -Format "yyyyMMdd-HHmmss"
$logDirectory = Join-Path $mainRepository "logs\local-development\$runId"
if (-not $DryRun) {
  New-Item -ItemType Directory -Path $logDirectory -Force | Out-Null
}

$serverBaseEnvironment = @{
  SERVER_HOST = "127.0.0.1"
  MCP_DEVELOPMENT_STDIO = "true"
  NODE_ENV = "development"
}

Start-DevelopmentTerminal -Title "Product A Agent Server + MCP" -LogName "product-a-agent-server" -WorkingDirectory $mainRepository -Environment ($serverBaseEnvironment + @{
  SERVER_PORT = "3411"
  DEPLOYMENT_ID = "local-product-a"
  MCP_SERVERS = $productAConfig
  PLATFORM_EXTENSIONS = $productAPlatformExtensions
}) -Command "pnpm.cmd dev:server"

if (-not $DryRun) {
  Write-Host "Waiting for Product A Agent Server on http://127.0.0.1:3411 ..." -ForegroundColor Cyan
  $agentReady = Wait-ForHttpPages -Urls @("http://127.0.0.1:3411/api/v1/openapi.json") -TimeoutSeconds 120
  if ($agentReady.Pending.Count -gt 0) {
    throw "Product A Agent Server did not become ready within 120 seconds. Check logs in $logDirectory\product-a-agent-server.log"
  }
}

Start-DevelopmentTerminal -Title "Product A Embed" -LogName "product-a-embed" -WorkingDirectory $mainRepository -Environment @{
  ASSISTANT_EMBED_PORT = "5511"
  ASSISTANT_API_TARGET = "http://127.0.0.1:3411"
  ASSISTANT_HOST_ORIGIN = "http://127.0.0.1:5411"
} -Command "pnpm.cmd dev:embed"

Start-DevelopmentTerminal -Title "Product A Demo" -LogName "product-a-demo" -WorkingDirectory $DemoRepository -Environment @{} -Command "pnpm.cmd dev:product-a"

if (-not $SkipStandaloneWeb) {
  Start-DevelopmentTerminal -Title "Standalone Assistant A" -LogName "standalone-assistant-a" -WorkingDirectory $mainRepository -Environment @{
    ASSISTANT_API_TARGET = "http://127.0.0.1:3411"
    ASSISTANT_WEB_PORT = "5173"
  } -Command "pnpm.cmd dev:web"
}

if ($IncludeProductB) {
  Start-DevelopmentTerminal -Title "Product B Agent Server + MCP" -LogName "product-b-agent-server" -WorkingDirectory $mainRepository -Environment ($serverBaseEnvironment + @{
    SERVER_PORT = "3412"
    DEPLOYMENT_ID = "local-product-b"
    MCP_SERVERS = $productBConfig
  }) -Command "pnpm.cmd dev:server"

  if (-not $DryRun) {
    Write-Host "Waiting for Product B Agent Server on http://127.0.0.1:3412 ..." -ForegroundColor Cyan
    $agentBReady = Wait-ForHttpPages -Urls @("http://127.0.0.1:3412/api/v1/openapi.json") -TimeoutSeconds 120
    if ($agentBReady.Pending.Count -gt 0) {
      throw "Product B Agent Server did not become ready within 120 seconds. Check logs in $logDirectory\product-b-agent-server.log"
    }
  }

  Start-DevelopmentTerminal -Title "Product B Embed" -LogName "product-b-embed" -WorkingDirectory $mainRepository -Environment @{
    ASSISTANT_EMBED_PORT = "5512"
    ASSISTANT_API_TARGET = "http://127.0.0.1:3412"
    ASSISTANT_HOST_ORIGIN = "http://127.0.0.1:5412"
  } -Command "pnpm.cmd dev:embed"

  Start-DevelopmentTerminal -Title "Product B Demo" -LogName "product-b-demo" -WorkingDirectory $DemoRepository -Environment @{} -Command "pnpm.cmd dev:product-b"

  if (-not $SkipStandaloneWeb) {
    Start-DevelopmentTerminal -Title "Standalone Assistant B" -LogName "standalone-assistant-b" -WorkingDirectory $mainRepository -Environment @{
      ASSISTANT_API_TARGET = "http://127.0.0.1:3412"
      ASSISTANT_WEB_PORT = "5174"
    } -Command "pnpm.cmd dev:web"
  }
}

if ($IncludeSdkHost) {
  Start-DevelopmentTerminal -Title "SDK Host Agent Server + A/B MCP" -LogName "sdk-host-agent-server" -WorkingDirectory $mainRepository -Environment ($serverBaseEnvironment + @{
    SERVER_PORT = "3310"
    DEPLOYMENT_ID = "local-sdk-host"
    MCP_SERVERS = $combinedConfig
  }) -Command "pnpm.cmd dev:server"

  Start-DevelopmentTerminal -Title "SDK Host Demo" -LogName "sdk-host-demo" -WorkingDirectory $DemoRepository -Environment @{} -Command "pnpm.cmd dev:sdk-host"
}

$urls = @("http://127.0.0.1:5411")
if (-not $SkipStandaloneWeb) {
  $urls += "http://127.0.0.1:5173"
}
if ($IncludeProductB) {
  $urls += "http://127.0.0.1:5412"
  if (-not $SkipStandaloneWeb) {
    $urls += "http://127.0.0.1:5174"
  }
}
if ($IncludeSdkHost) {
  $urls += "http://127.0.0.1:5314"
}

if ($DryRun) {
  Write-Host "Dry run passed. No process was started." -ForegroundColor Green
} else {
  Write-Host "Local development processes were started in separate PowerShell windows." -ForegroundColor Green
  Write-Host "Product A: Agent Server 3411, Embed 5511, Demo 5411" -ForegroundColor Cyan
  if (-not $SkipStandaloneWeb) {
    Write-Host "Standalone Web assistant: http://127.0.0.1:5173 (API -> 3411)" -ForegroundColor Cyan
  }
  if ($IncludeProductB) {
    Write-Host "Product B: Agent Server 3412, Embed 5512, Demo 5412" -ForegroundColor Cyan
  }
  Write-Host "Logs: $logDirectory" -ForegroundColor Cyan
}

if ($OpenBrowser -and -not $DryRun) {
  Write-Host "Waiting up to 60 seconds for pages..." -ForegroundColor Cyan
  $pageStatus = Wait-ForHttpPages -Urls $urls
  $pageStatus.Ready | ForEach-Object { Start-Process $_ }
  if ($pageStatus.Pending.Count -gt 0) {
    Write-Warning ("Pages not ready: " + ($pageStatus.Pending -join ", "))
    Write-Warning "Review the spawned terminals or transcripts in $logDirectory"
  }
}
Write-Host "Wait for each terminal to report ready, then open:" -ForegroundColor Cyan
$urls | ForEach-Object { Write-Host "  $_" }
Write-Host "Stop all services with Ctrl+C in each spawned terminal." -ForegroundColor Yellow
