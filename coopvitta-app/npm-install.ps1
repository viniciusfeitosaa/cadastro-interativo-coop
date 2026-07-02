# Script helper para executar npm no PowerShell
# Use: .\npm-install.ps1

$npmPath = "C:\Program Files\nodejs\npm.cmd"

if (Test-Path $npmPath) {
    Write-Host "Instalando dependências do backend..." -ForegroundColor Green
    Set-Location backend
    & $npmPath install
    Set-Location ..
    
    Write-Host "`nInstalando dependências do frontend..." -ForegroundColor Green
    Set-Location frontend
    & $npmPath install
    Set-Location ..
    
    Write-Host "`n✅ Instalação concluída!" -ForegroundColor Green
} else {
    Write-Host "❌ npm não encontrado em: $npmPath" -ForegroundColor Red
    Write-Host "Verifique se o Node.js está instalado corretamente." -ForegroundColor Yellow
}
