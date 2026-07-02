@echo off
:: Adiciona Node.js ao PATH do SISTEMA para npm/node funcionarem em qualquer terminal.
:: Rode como ADMINISTRADOR: botao direito no arquivo -> "Executar como administrador"
set "NODE_DIR=C:\Program Files\nodejs"
powershell -NoProfile -Command "$p = [Environment]::GetEnvironmentVariable('Path', 'Machine'); if ($p -like '*nodejs*') { Write-Host 'Node.js ja esta no PATH do sistema.' } else { [Environment]::SetEnvironmentVariable('Path', \"%NODE_DIR%;$p\", 'Machine'); Write-Host 'Node.js adicionado ao PATH. Feche todos os terminais e o Cursor e abra de novo.' }"
pause
