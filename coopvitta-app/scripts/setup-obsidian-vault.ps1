#Requires -Version 5.1
<#
.SYNOPSIS
  Configura o Obsidian para usar o harness Viva Saúde (pasta contexto/).

.PARAMETER Mode
  repo-vault = abrir contexto/ como vault
  symlink = AppVS-contexto na raiz do vault
  memoria-total = memoria total\Viva-Saude -> repo\contexto (seu caso no Windows)

.EXAMPLE
  .\scripts\setup-obsidian-vault.ps1 -Mode memoria-total -VaultPath "C:\Users\voce\Documents\Obsidian\MeuVault" -Open -SaveConfig
#>
param(
    [ValidateSet('repo-vault', 'symlink', 'memoria-total')]
    [string]$Mode = 'repo-vault',

    [string]$VaultPath = '',

    [string]$MemoriaFolder = 'memoria total',

    [string]$LinkName = 'Viva-Saude',

    [switch]$Open,

    [switch]$SaveConfig
)

$ErrorActionPreference = 'Stop'

$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
$ContextoPath = Join-Path $RepoRoot 'contexto'
$ConfigPath = Join-Path $RepoRoot '.obsidian-vault.json'
$DefaultLinkName = 'AppVS-contexto'

function Write-Info($msg) { Write-Host "[obsidian] $msg" -ForegroundColor Cyan }
function Write-Ok($msg) { Write-Host "[obsidian] $msg" -ForegroundColor Green }
function Write-Warn($msg) { Write-Host "[obsidian] $msg" -ForegroundColor Yellow }

function New-DirectoryJunction {
    param(
        [Parameter(Mandatory)][string]$LinkPath,
        [Parameter(Mandatory)][string]$TargetPath
    )
    if (-not (Test-Path $TargetPath)) {
        throw "Destino inexistente: $TargetPath"
    }
    if (Test-Path $LinkPath) {
        $item = Get-Item $LinkPath -Force
        if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) {
            $target = $item.Target
            if ($target -and ($target -eq $TargetPath -or $target[0] -eq $TargetPath)) {
                Write-Warn "Junction ja aponta para o repo: $LinkPath"
                return
            }
            throw "Junction existe com outro destino: $LinkPath -> $target. Remova manualmente."
        }
        throw "Ja existe pasta/arquivo em $LinkPath (nao e junction). Renomeie ou remova."
    }
    $parent = Split-Path $LinkPath -Parent
    if (-not (Test-Path $parent)) {
        New-Item -ItemType Directory -Path $parent -Force | Out-Null
    }
    cmd /c "mklink /J `"$LinkPath`" `"$TargetPath`"" | Out-Null
    if (-not (Test-Path $LinkPath)) {
        throw "Falha ao criar junction. Execute PowerShell como Administrador ou ative Modo Desenvolvedor no Windows."
    }
    Write-Ok "Junction: $LinkPath -> $TargetPath"
}

if (-not (Test-Path $ContextoPath)) {
    throw "Pasta contexto nao encontrada: $ContextoPath"
}

# Config local
if (Test-Path $ConfigPath) {
    try {
        $cfg = Get-Content $ConfigPath -Raw | ConvertFrom-Json
        if (-not $VaultPath -and $cfg.vaultPath) { $VaultPath = $cfg.vaultPath }
        if ($cfg.mode) { $Mode = $cfg.mode }
        if ($cfg.memoriaTotalFolder) { $MemoriaFolder = $cfg.memoriaTotalFolder }
        if ($cfg.linkName) { $LinkName = $cfg.linkName }
    } catch {
        Write-Warn "Nao foi possivel ler $ConfigPath"
    }
}

$OpenPath = $ContextoPath
$OpenFile = 'Home.md'

switch ($Mode) {
    'memoria-total' {
        if (-not $VaultPath) {
            Write-Info "Informe a pasta do VAULT Obsidian (onde existe 'memoria total')."
            $VaultPath = Read-Host "Caminho do vault (ex: $env:USERPROFILE\Documents\Obsidian\MeuVault)"
        }
        $VaultPath = $VaultPath.Trim().Trim('"')
        if (-not (Test-Path $VaultPath)) {
            throw "Vault nao encontrado: $VaultPath"
        }

        $MemoriaPath = Join-Path $VaultPath $MemoriaFolder
        if (-not (Test-Path $MemoriaPath)) {
            New-Item -ItemType Directory -Path $MemoriaPath -Force | Out-Null
            Write-Ok "Pasta criada: $MemoriaPath"
        } else {
            Write-Ok "Usando pasta existente: $MemoriaPath"
        }

        $LinkPath = Join-Path $MemoriaPath $LinkName
        New-DirectoryJunction -LinkPath $LinkPath -TargetPath $ContextoPath

        Write-Host ""
        Write-Ok "No Obsidian, abra o vault: $VaultPath"
        Write-Ok "Navegue: $MemoriaFolder / $LinkName /"
        Write-Ok "Comece por: [[Home]] em $MemoriaFolder\$LinkName\Home.md"

        $OpenPath = $VaultPath
        $OpenFile = "$MemoriaFolder/$LinkName/Home.md"
    }

    'symlink' {
        if (-not $VaultPath) {
            $VaultPath = Read-Host "Caminho do vault Obsidian"
        }
        $VaultPath = $VaultPath.Trim().Trim('"')
        if (-not (Test-Path $VaultPath)) {
            New-Item -ItemType Directory -Path $VaultPath -Force | Out-Null
        }
        $LinkPath = Join-Path $VaultPath $DefaultLinkName
        New-DirectoryJunction -LinkPath $LinkPath -TargetPath $ContextoPath
        Write-Ok "Edite em: $DefaultLinkName\"
        $OpenPath = $VaultPath
        $OpenFile = "$DefaultLinkName/Home.md"
    }

    default {
        Write-Ok "Vault recomendado = pasta contexto do repo"
        Write-Ok $ContextoPath
        Write-Info "Obsidian -> Open folder as vault -> selecione contexto\"
        $OpenPath = $ContextoPath
    }
}

if ($SaveConfig -or $Mode -ne 'repo-vault') {
    @{
        mode               = $Mode
        vaultPath          = if ($Mode -eq 'repo-vault') { $ContextoPath } else { $VaultPath }
        memoriaTotalFolder = $MemoriaFolder
        linkName           = $LinkName
        contexto           = $ContextoPath
        memoriaTotalPath   = if ($Mode -eq 'memoria-total') { Join-Path $VaultPath $MemoriaFolder } else { $null }
        updatedAt          = (Get-Date).ToString('o')
    } | ConvertTo-Json | Set-Content -Path $ConfigPath -Encoding UTF8
    Write-Ok "Config: $ConfigPath"
}

if ($Open) {
    $obsidianExe = @(
        "${env:LocalAppData}\Programs\Obsidian\Obsidian.exe",
        "${env:ProgramFiles}\Obsidian\Obsidian.exe"
    ) | Where-Object { Test-Path $_ } | Select-Object -First 1

    if ($Mode -eq 'repo-vault') {
        $uri = 'obsidian://open?path=' + [uri]::EscapeDataString($OpenPath)
    } else {
        $fileEnc = [uri]::EscapeDataString($OpenFile)
        $uri = "obsidian://open?path=$([uri]::EscapeDataString($OpenPath))&file=$fileEnc"
    }

    if ($obsidianExe) {
        Write-Info "Abrindo Obsidian..."
        Start-Process -FilePath $obsidianExe -ArgumentList $uri
    } else {
        Write-Warn "Instale o Obsidian ou abra manualmente: $OpenPath"
        if ($OpenFile) { Write-Host "  Arquivo: $OpenFile" }
    }
}

Write-Host ""
Write-Host "Doc: contexto\SETUP-OBSIDIAN.md | memoria total: contexto\memoria-total.md" -ForegroundColor DarkGray
