#Requires -Version 5.1
<#
.SYNOPSIS
  Liga a pasta "memoria total" do seu vault Obsidian ao contexto/ do repo (Git).

.EXAMPLE
  .\scripts\setup-memoria-total.ps1
  Pede o caminho do vault e cria: memoria total\Viva-Saude -> repo\contexto

.EXAMPLE
  .\scripts\setup-memoria-total.ps1 -VaultPath "C:\Users\voce\Documents\Obsidian\MeuVault" -Open
#>
param(
    [string]$VaultPath = '',

    [string]$MemoriaFolder = 'memoria total',

    [string]$LinkName = 'Viva-Saude',

    [switch]$Open,

    [switch]$SaveConfig
)

$ErrorActionPreference = 'Stop'

& (Join-Path $PSScriptRoot 'setup-obsidian-vault.ps1') `
    -Mode memoria-total `
    -VaultPath $VaultPath `
    -MemoriaFolder $MemoriaFolder `
    -LinkName $LinkName `
    -Open:$Open `
    -SaveConfig:$SaveConfig
