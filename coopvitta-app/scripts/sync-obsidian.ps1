#Requires -Version 5.1
<#
.SYNOPSIS
  Copia notas entre repo\contexto e um vault Obsidian externo (use apenas se NAO usar symlink).

.EXAMPLE
  .\scripts\sync-obsidian.ps1 -Direction to-vault
  Repo -> vault externo

.EXAMPLE
  .\scripts\sync-obsidian.ps1 -Direction from-vault
  Vault externo -> repo
#>
param(
    [ValidateSet('to-vault', 'from-vault', 'both')]
    [string]$Direction = 'to-vault',

    [string]$ExternalVault = ''
)

$ErrorActionPreference = 'Stop'

$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
$ContextoPath = Join-Path $RepoRoot 'contexto'
$ConfigPath = Join-Path $RepoRoot '.obsidian-vault.json'

if (-not $ExternalVault -and (Test-Path $ConfigPath)) {
    $cfg = Get-Content $ConfigPath -Raw | ConvertFrom-Json
    if ($cfg.externalVaultPath) { $ExternalVault = $cfg.externalVaultPath }
    elseif ($cfg.mode -eq 'memoria-total' -and $cfg.vaultPath) {
        $folder = if ($cfg.memoriaTotalFolder) { $cfg.memoriaTotalFolder } else { 'memoria total' }
        $link = if ($cfg.linkName) { $cfg.linkName } else { 'Viva-Saude' }
        $ExternalVault = Join-Path (Join-Path $cfg.vaultPath $folder) $link
    }
    elseif ($cfg.vaultPath -and $cfg.mode -eq 'symlink') {
        $ExternalVault = Join-Path $cfg.vaultPath 'AppVS-contexto'
    }
}

if (-not $ExternalVault) {
    throw @"
Informe -ExternalVault ou configure .obsidian-vault.json com externalVaultPath.

Recomendado: use symlink (setup-obsidian-vault.ps1 -Mode symlink) ou abra contexto/ como vault — sem copia.
"@
}

$robocopyArgs = @('/E', '/XD', 'node_modules', '.git', '/XF', '*.tmp', 'workspace.json', 'workspace-mobile.json')

function Sync-ToVault {
    Write-Host "[sync] $ContextoPath -> $ExternalVault" -ForegroundColor Cyan
    & robocopy $ContextoPath $ExternalVault @robocopyArgs /NFL /NDL /NJH /NJS | Out-Null
    if ($LASTEXITCODE -ge 8) { throw "Robocopy falhou com codigo $LASTEXITCODE" }
}

function Sync-FromVault {
    Write-Host "[sync] $ExternalVault -> $ContextoPath" -ForegroundColor Cyan
    & robocopy $ExternalVault $ContextoPath @robocopyArgs /NFL /NDL /NJH /NJS | Out-Null
    if ($LASTEXITCODE -ge 8) { throw "Robocopy falhou com codigo $LASTEXITCODE" }
}

switch ($Direction) {
    'to-vault' { Sync-ToVault }
    'from-vault' { Sync-FromVault }
    'both' {
        Sync-ToVault
        Sync-FromVault
        Write-Host "[sync] Modo 'both' pode sobrescrever alteracoes recentes — prefira symlink." -ForegroundColor Yellow
    }
}

Write-Host "[sync] Concluido." -ForegroundColor Green
