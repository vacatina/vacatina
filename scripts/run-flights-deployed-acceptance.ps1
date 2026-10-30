$ErrorActionPreference = 'Stop'
$auth = Get-Content "$env:APPDATA\com.vercel.cli\Data\auth.json" -Raw | ConvertFrom-Json
$token = $auth.token
if (-not $token) { $token = $auth.accessToken }
$headers = @{ Authorization = "Bearer $token" }
$deployment = Invoke-RestMethod -Uri 'https://api.vercel.com/v13/deployments/dpl_ChwLz4tU3agQjmY1J9gFw5whjv7X?teamId=team_xj1N5ykrhBZsd1EAbEFvZU2v' -Headers $headers
$expected = '6054dc541a0b3a703bf39cdca714bc238b472dc3'
if ($deployment.gitSource.sha -ne $expected -or $deployment.readyState -ne 'READY') { throw 'Deployment SHA/status mismatch' }
Write-Output "Verified deployment=$($deployment.id) state=$($deployment.readyState) sha=$($deployment.gitSource.sha)"
$project = Invoke-RestMethod -Uri 'https://api.vercel.com/v9/projects/vacatina?teamId=team_xj1N5ykrhBZsd1EAbEFvZU2v' -Headers $headers
$env:VERCEL_BYPASS = ($project.protectionBypass.PSObject.Properties | Select-Object -First 1).Name
$env:PREVIEW_BASE = 'https://' + $deployment.url
$env:EXPECTED_SHA = $expected
$env:ACCEPTANCE_OUTPUT = Join-Path (Split-Path $PSScriptRoot) 'tmp\acceptance-trusted-results.json'
try { node (Join-Path $PSScriptRoot 'verify-flights-deployed-acceptance.mjs') } finally { Remove-Item Env:\VERCEL_BYPASS -ErrorAction SilentlyContinue }
