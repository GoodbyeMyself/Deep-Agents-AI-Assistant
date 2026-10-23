# Operates Docker only. All pnpm builds must be performed by the user beforehand.
[CmdletBinding()]
param([ValidateSet('start', 'stop', 'status', 'logs')][string]$Action = 'status')
$ErrorActionPreference = 'Stop'
$repositoryRoot = Split-Path $PSScriptRoot -Parent
Push-Location $repositoryRoot
try {
    if ($Action -eq 'start') {
        & (Join-Path $PSScriptRoot 'initialize-local.ps1')
        foreach ($artifact in @('server/dist/server-main.js', 'web/index.html', 'embed/assistant-loader.js',
            'product-a-mcp/dist/http.js', 'product-a-demo/index.html', 'local-mcp-approval.json')) {
            if (-not (Test-Path -LiteralPath (Join-Path $PSScriptRoot "out/$artifact"))) {
                throw "Missing deploy artifact: $artifact. Run pnpm pack:local yourself first."
            }
        }
        $localConfig = [IO.File]::ReadAllLines((Join-Path $PSScriptRoot '.env.local'))
        $keyConfigured = ($localConfig | Where-Object { $_ -match '^(DEEPSEEK_API_KEY|OPENAI_API_KEY)=.+' }) -or
            (-not [string]::IsNullOrWhiteSpace($env:DEEPSEEK_API_KEY)) -or
            (-not [string]::IsNullOrWhiteSpace($env:OPENAI_API_KEY))
        if (-not $keyConfigured -and -not (Test-Path -LiteralPath '.env')) {
            throw 'Configure a model key in deploy/.env.local before starting; never send it in chat.'
        }
    }
    $composeArguments = @('compose')
    $composeArguments += @('--env-file', 'deploy/.env.local')
    if (Test-Path -LiteralPath '.env') { $composeArguments += @('--env-file', '.env') }
    $composeArguments += @('-f', 'deploy/docker-compose.postgres.yml',
        '-f', 'deploy/docker-compose.yml', '-f', 'deploy/docker-compose.local.yml')
    switch ($Action) {
        'start' { $composeArguments += @('up', '-d', '--build', '--wait', '--wait-timeout', '180') }
        'stop' { $composeArguments += @('stop') }
        'status' { $composeArguments += @('ps') }
        'logs' { $composeArguments += @('logs', '--tail', '100', 'agent-server', 'product-a-mcp') }
    }
    & docker @composeArguments
    if ($LASTEXITCODE -ne 0) { throw "Docker Compose $Action failed (exit $LASTEXITCODE)." }
    if ($Action -eq 'start') {
        Write-Host 'Demo: http://127.0.0.1:5411  Web: http://127.0.0.1:8080  Embed: http://127.0.0.1:5511'
    }
} finally { Pop-Location }
