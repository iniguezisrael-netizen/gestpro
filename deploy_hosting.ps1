Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force
$env:PATH = [System.Environment]::GetEnvironmentVariable("PATH","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("PATH","User")
cd C:\Users\israe\Downloads\firebase-deploy
firebase deploy --only hosting
