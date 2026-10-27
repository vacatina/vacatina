$token = & powershell -ExecutionPolicy Bypass -File "C:\Users\Madhusanka\.gemini\antigravity\scratch\vacatina\scripts\get-token.ps1"
if ($token) {
    $remoteUrl = "https://x-access-token:" + $token.Trim() + "@github.com/vacatina/vacatina.git"
    git -C "C:\Users\Madhusanka\.gemini\antigravity\scratch\vacatina" push $remoteUrl main
} else {
    Write-Error "No GitHub token found in Credential Manager"
}
