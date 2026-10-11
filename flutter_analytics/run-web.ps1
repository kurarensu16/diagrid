param([switch]$Build)
$ErrorActionPreference = 'Stop'
# Reuse the parent React app's public Supabase configuration without printing it.
$analyticsConfigPath = Join-Path $PSScriptRoot '..\.env'
$analyticsConfig = @{}
foreach ($line in Get-Content -LiteralPath $analyticsConfigPath) {
  if ($line -match '^\s*(VITE_SUPABASE_URL|VITE_SUPABASE_ANON_KEY)\s*=\s*(.*?)\s*$') {
    $analyticsConfig[$matches[1]] = $matches[2].Trim('"', "'")
  }
}
if (-not $analyticsConfig['VITE_SUPABASE_URL'] -or -not $analyticsConfig['VITE_SUPABASE_ANON_KEY']) {
  throw 'The parent .env must define VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'
}
$analyticsArguments = @(
  "--dart-define=SUPABASE_URL=$($analyticsConfig['VITE_SUPABASE_URL'])",
  "--dart-define=SUPABASE_ANON_KEY=$($analyticsConfig['VITE_SUPABASE_ANON_KEY'])"
)
Push-Location $PSScriptRoot
try {
  if ($Build) { & flutter build web @analyticsArguments }
  else { & flutter run -d chrome @analyticsArguments }
  if ($LASTEXITCODE -ne 0) { throw "Flutter exited with code $LASTEXITCODE." }
} finally { Pop-Location }
