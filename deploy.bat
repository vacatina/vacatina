@echo off
set "PATH=C:\Users\Madhusanka\.gemini\antigravity\scratch\tools\node\node-v22.14.0-win-x64;%PATH%"
cd /d "C:\Users\Madhusanka\.gemini\antigravity\scratch\vacatina"
node scripts\build.mjs
call npx vercel --prod --yes
