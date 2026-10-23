# Generates local credentials without logging them or overwriting an existing environment.
[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'
$environmentPath = Join-Path $PSScriptRoot '.env.local'
function New-LocalSecret {
    $randomBytes = New-Object byte[] 32
    $random = [Security.Cryptography.RandomNumberGenerator]::Create()
    try { $random.GetBytes($randomBytes) } finally { $random.Dispose() }
    return [BitConverter]::ToString($randomBytes).Replace('-', '').ToLowerInvariant()
}
$lines = [Collections.Generic.List[string]]::new()
if (Test-Path -LiteralPath $environmentPath) {
    $lines.AddRange([IO.File]::ReadAllLines($environmentPath))
} else {
    $databasePassword = New-LocalSecret
    $lines.AddRange([string[]]@('DEPLOYMENT_ID=local', 'POSTGRES_LOCAL_PORT=55432',
        "POSTGRES_PASSWORD=$databasePassword",
        "TEST_DATABASE_URL=postgresql://assistant:${databasePassword}@127.0.0.1:55432/assistant_test"))
}
if (-not ($lines | Where-Object { $_ -match '^MCP_DELEGATION_SECRET=' })) {
    $lines.Add('MCP_DELEGATION_SECRET=' + (New-LocalSecret))
}
if (-not ($lines | Where-Object { $_ -match '^PLATFORM_EXTENSIONS=' })) {
    $lines.Add('PLATFORM_EXTENSIONS=[{"moduleSpecifier":"@assistant/platform-host-navigation-extension","approval":{"id":"host-navigation","version":"1.0.0","manifestDigest":"0c8645da7bb1745266ad75c45b0136df9e9048b6785b4a224dc9097da5447377"}}]')
}
if (-not ($lines | Where-Object { $_ -match '^DEEPSEEK_API_KEY=' })) { $lines.Add('DEEPSEEK_API_KEY=') }
if (-not ($lines | Where-Object { $_ -match '^MODEL_NAME=' })) { $lines.Add('MODEL_NAME=deepseek-chat') }
[IO.File]::WriteAllLines($environmentPath, $lines, [Text.UTF8Encoding]::new($false))
Write-Host 'Local environment initialized; existing credentials preserved. Model settings may be supplied by repository .env.'
