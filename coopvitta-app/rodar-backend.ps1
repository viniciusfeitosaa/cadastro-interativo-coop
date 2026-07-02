# Garante que o Node.js esta no PATH e inicia o backend
$env:Path = "C:\Program Files\nodejs;" + $env:Path
Set-Location $PSScriptRoot\backend
npm run dev
