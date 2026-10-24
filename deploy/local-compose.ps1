# Docker lifecycle only. Never builds sources or invokes pnpm.
[CmdletBinding()]
param([ValidateSet('start', 'stop', 'status', 'logs')][string]$Action = 'status',
      [ValidateSet('all', 'product-a', 'mcp', 'agents')][string]$Group = 'all')
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$demoRoot = if ($env:DEMO_REPO_PATH) { $env:DEMO_REPO_PATH } else { Join-Path $root '../Deep-Agents-AI-Assistant-Demo' }
$mcpRoot = if ($env:MCP_REPO_PATH) { $env:MCP_REPO_PATH } else { Join-Path $root '../Deep-Agents-AI-Assistant-MCP' }
$productDeploy = [IO.Path]::GetFullPath((Join-Path $demoRoot 'product-a/deploy'))
$mcpDeploy = [IO.Path]::GetFullPath((Join-Path $mcpRoot 'deploy'))
function Invoke-CheckedDocker([string[]]$Arguments) {
    & docker @Arguments
    if ($LASTEXITCODE -ne 0) { throw "Docker operation failed: $($Arguments[0])" }
}
if ($Action -eq 'start') {
    & (Join-Path $PSScriptRoot 'initialize-local.ps1')
    & (Join-Path $productDeploy 'initialize.ps1')
    & docker network inspect assistant-integration *> $null
    if ($LASTEXITCODE -ne 0) { Invoke-CheckedDocker -Arguments @('network', 'create', 'assistant-integration') }
}
$platformEnvironment = Join-Path $PSScriptRoot '.env.local'
$product = @('--project-name', 'assistant-product-a', '--env-file', (Join-Path $productDeploy '.env'), '-f', (Join-Path $productDeploy 'docker-compose.yml'))
$mcp = @('--project-name', 'assistant-mcp', '--env-file', $platformEnvironment, '-f', (Join-Path $mcpDeploy 'docker-compose.yml'))
$agents = @('--project-name', 'assistant-agents', '--env-file', $platformEnvironment)
if (Test-Path -LiteralPath (Join-Path $root '.env')) { $agents += @('--env-file', (Join-Path $root '.env')) }
$agents += @('-f', (Join-Path $PSScriptRoot 'docker-compose.postgres.yml'), '-f', (Join-Path $PSScriptRoot 'docker-compose.yml'), '-f', (Join-Path $PSScriptRoot 'docker-compose.local.yml'))
$groups = [ordered]@{'product-a'=$product; 'mcp'=$mcp; 'agents'=$agents}
$names = if ($Group -eq 'all') { @($groups.Keys) } else { @($Group) }
if ($Action -eq 'start') {
    if ($names -contains 'agents') {
        $identityArtifact = Join-Path $PSScriptRoot 'out/server/dist/modules/identity/http-profile-identity.js'
        if (-not (Test-Path -LiteralPath $identityArtifact)) { throw 'Build the updated platform with pnpm pack:local yourself first.' }
        $approvalPath = Join-Path $PSScriptRoot 'out/local-mcp-approval.json'
        if (-not (Test-Path -LiteralPath $approvalPath)) { throw 'The current MCP deployment approval artifact is missing.' }
        $approvedServers = @(Get-Content -LiteralPath $approvalPath -Raw | ConvertFrom-Json)
        if (-not $approvedServers.Count -or ($approvedServers | Where-Object { $_.authentication -ne 'current-user' })) {
            throw 'The deployment approval is stale; rebuild MCP and run pnpm pack:local yourself.'
        }
    }
    if (($names -contains 'mcp') -and -not (Test-Path -LiteralPath (Join-Path $mcpDeploy 'out/product-a-mcp/dist/http/business-auth.js'))) {
        throw 'Build the updated MCP with pnpm pack:product-a yourself first.'
    }
    if ($names -contains 'product-a') {
        $productRoot = Split-Path $productDeploy -Parent
        foreach ($frontend in @('govern', 'portal')) {
            if (-not (Test-Path -LiteralPath (Join-Path $productRoot "web/apps/$frontend/dist/index.html"))) {
                throw "Missing Product A $frontend frontend. Build it yourself first."
            }
        }
        foreach ($module in @('gateway','service/auth-center','service/bms-service','service/data-source','service/data-metadata','service/iot-device','service/iot-collection')) {
            $target = Join-Path $productRoot "microservice/$module/target"
            if (-not (Get-ChildItem -LiteralPath $target -Filter '*-SNAPSHOT.jar' -ErrorAction SilentlyContinue)) {
                throw "Missing Product A artifact for $module. Run Maven package first."
            }
        }
    }
}
if ($Action -eq 'stop') { [array]::Reverse($names) }
foreach ($name in $names) {
    $arguments = @('compose') + $groups[$name]
    switch ($Action) {
        'start' { $arguments += @('up', '-d', '--build', '--wait', '--wait-timeout', '300') }
        'stop' { $arguments += @('stop') }
        'status' { $arguments += @('ps') }
        'logs' { $arguments += @('logs', '--tail', '80') }
    }
    Invoke-CheckedDocker -Arguments $arguments
}
if ($Action -eq 'start') { Write-Host 'Product A: http://127.0.0.1:19001  Assistant: http://127.0.0.1:8080  Embed: http://127.0.0.1:5511' }
