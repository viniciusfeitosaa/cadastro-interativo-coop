# Garante que o Node.js esta no PATH e inicia o frontend
$env:Path = "C:\Program Files\nodejs;" + $env:Path
Set-Location $PSScriptRoot\frontend
npm run dev
