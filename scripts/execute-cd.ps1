$nodeDir = "C:\Users\Madhusanka\.gemini\antigravity\scratch\tools\node\node-v22.14.0-win-x64"
$npmDir = "C:\Users\Madhusanka\AppData\Roaming\npm"
$env:Path = "$nodeDir;$npmDir;$env:Path"

$env:GH_TOKEN = (& powershell -ExecutionPolicy Bypass -File C:\Users\Madhusanka\.gemini\antigravity\scratch\vacatina\scripts\get-token.ps1)
Set-Location "C:\Users\Madhusanka\.gemini\antigravity\scratch\vacatina"

& "$nodeDir\node.exe" scripts/cd-workflow.mjs "feat: implement and deploy complete 40 WebP card images across all 10 product categories"
