# Vault Obsidian: COFRE - MEMORIA (vinic)
# Repo: C:\Users\vinic\Downloads\GymApp\AppVS
# Uso: .\rodar-cofre-memoria.ps1   (NAO junto com git pull)
# Liga memoria total\Viva-Saude -> repo\contexto
& "$PSScriptRoot\scripts\setup-memoria-total.ps1" `
    -VaultPath "C:\Users\vinic\Documents\COFRE - MEMORIA" `
    -MemoriaFolder "memoria total" `
    -LinkName "Viva-Saude" `
    -Open `
    -SaveConfig
