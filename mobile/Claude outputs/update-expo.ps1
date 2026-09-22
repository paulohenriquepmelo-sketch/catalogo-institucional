# ============================================================================
# Script para Atualizar Expo no Catálogo Laurencini
# ============================================================================
#
# Uso:
#   1. Abra o PowerShell como Administrador
#   2. Execute: Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
#   3. Navegue até a pasta do projeto: cd C:\seu\caminho\mobile-app
#   4. Execute este script: .\update-expo.ps1
#
# ============================================================================

Write-Host "╔════════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║       Atualizar Expo - Catálogo Laurencini                     ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# Cores para output
$ErrorColor = "Red"
$SuccessColor = "Green"
$InfoColor = "Cyan"
$WarningColor = "Yellow"

# ============================================================================
# FUNÇÃO: Verificar se npm está instalado
# ============================================================================
function Test-NPM {
    try {
        $npm_version = npm --version 2>&1
        Write-Host "✓ npm encontrado: v$npm_version" -ForegroundColor $SuccessColor
        return $true
    }
    catch {
        Write-Host "✗ npm não encontrado! Instale Node.js em https://nodejs.org/" -ForegroundColor $ErrorColor
        return $false
    }
}

# ============================================================================
# FUNÇÃO: Verificar Node.js
# ============================================================================
function Test-NodeJS {
    try {
        $node_version = node --version 2>&1
        Write-Host "✓ Node.js encontrado: $node_version" -ForegroundColor $SuccessColor
        return $true
    }
    catch {
        Write-Host "✗ Node.js não encontrado!" -ForegroundColor $ErrorColor
        return $false
    }
}

# ============================================================================
# FUNÇÃO: Obter versão do Expo
# ============================================================================
function Get-ExpoVersion {
    try {
        $version = npm list expo --depth=0 2>&1 | Select-String "expo@" | ForEach-Object { $_.ToString().Split('@')[1] }
        if ($version) {
            Write-Host "Versão atual do Expo: $version" -ForegroundColor $InfoColor
            return $version
        }
        else {
            Write-Host "Expo não encontrado no projeto" -ForegroundColor $WarningColor
            return $null
        }
    }
    catch {
        Write-Host "Erro ao verificar versão do Expo" -ForegroundColor $ErrorColor
        return $null
    }
}

# ============================================================================
# MAIN SCRIPT
# ============================================================================

# Passo 1: Verificar pré-requisitos
Write-Host ""
Write-Host "[1/5] Verificando pré-requisitos..." -ForegroundColor $InfoColor
Write-Host "───────────────────────────────────────" -ForegroundColor $InfoColor

if (-not (Test-NodeJS)) {
    Write-Host ""
    Write-Host "Erro fatal: Node.js não está instalado" -ForegroundColor $ErrorColor
    exit 1
}

if (-not (Test-NPM)) {
    Write-Host ""
    Write-Host "Erro fatal: npm não está instalado" -ForegroundColor $ErrorColor
    exit 1
}

$current_version = Get-ExpoVersion

# Passo 2: Limpar cache npm
Write-Host ""
Write-Host "[2/5] Limpando cache npm..." -ForegroundColor $InfoColor
Write-Host "───────────────────────────────────────" -ForegroundColor $InfoColor
Write-Host "Executando: npm cache clean --force" -ForegroundColor $WarningColor

try {
    npm cache clean --force
    Write-Host "✓ Cache limpo com sucesso" -ForegroundColor $SuccessColor
}
catch {
    Write-Host "⚠ Erro ao limpar cache (continuando...)" -ForegroundColor $WarningColor
}

# Passo 3: Atualizar Expo CLI globalmente
Write-Host ""
Write-Host "[3/5] Atualizando Expo CLI globalmente..." -ForegroundColor $InfoColor
Write-Host "───────────────────────────────────────" -ForegroundColor $InfoColor
Write-Host "Executando: npm install -g expo-cli@latest" -ForegroundColor $WarningColor

try {
    npm install -g expo-cli@latest
    Write-Host "✓ Expo CLI atualizado com sucesso" -ForegroundColor $SuccessColor
}
catch {
    Write-Host "⚠ Erro ao atualizar Expo CLI globalmente" -ForegroundColor $ErrorColor
}

# Passo 4: Atualizar dependências do projeto
Write-Host ""
Write-Host "[4/5] Atualizando dependências do projeto..." -ForegroundColor $InfoColor
Write-Host "───────────────────────────────────────" -ForegroundColor $InfoColor

# Opção A: Atualizar tudo
Write-Host "Opções:" -ForegroundColor $InfoColor
Write-Host "  1 - Atualizar para última versão (recomendado)" -ForegroundColor $InfoColor
Write-Host "  2 - Atualizar dentro da versão atual (seguro)" -ForegroundColor $InfoColor
Write-Host "  3 - Pular atualização" -ForegroundColor $InfoColor
Write-Host ""

$choice = Read-Host "Escolha (1/2/3)"

switch ($choice) {
    "1" {
        Write-Host "Executando: npm install expo@latest" -ForegroundColor $WarningColor
        npm install expo@latest
        Write-Host "Executando: npm install" -ForegroundColor $WarningColor
        npm install
        Write-Host "✓ Dependências atualizadas para última versão" -ForegroundColor $SuccessColor
    }
    "2" {
        Write-Host "Executando: npm update" -ForegroundColor $WarningColor
        npm update
        Write-Host "✓ Dependências atualizadas (versão atual mantida)" -ForegroundColor $SuccessColor
    }
    "3" {
        Write-Host "⊘ Atualização de dependências pulada" -ForegroundColor $WarningColor
    }
    default {
        Write-Host "Opção inválida, pulando atualização" -ForegroundColor $ErrorColor
    }
}

# Passo 5: Verificação final
Write-Host ""
Write-Host "[5/5] Verificação final..." -ForegroundColor $InfoColor
Write-Host "───────────────────────────────────────" -ForegroundColor $InfoColor

$new_version = Get-ExpoVersion

Write-Host ""
Write-Host "Versão anterior: $current_version" -ForegroundColor $InfoColor
Write-Host "Versão atual:    $new_version" -ForegroundColor $InfoColor

# Verificar node_modules
if (Test-Path "node_modules") {
    Write-Host "✓ pasta node_modules encontrada" -ForegroundColor $SuccessColor
}
else {
    Write-Host "⚠ pasta node_modules não encontrada (execute 'npm install')" -ForegroundColor $WarningColor
}

# ============================================================================
# PRÓXIMOS PASSOS
# ============================================================================

Write-Host ""
Write-Host "╔════════════════════════════════════════════════════════════════╗" -ForegroundColor $SuccessColor
Write-Host "║                    Atualização Concluída!                      ║" -ForegroundColor $SuccessColor
Write-Host "╚════════════════════════════════════════════════════════════════╝" -ForegroundColor $SuccessColor

Write-Host ""
Write-Host "📋 Próximos passos:" -ForegroundColor $InfoColor
Write-Host ""
Write-Host "1️⃣  Executar a aplicação:" -ForegroundColor $InfoColor
Write-Host "   npx expo start" -ForegroundColor $WarningColor
Write-Host ""
Write-Host "2️⃣  Testar no emulador Android:" -ForegroundColor $InfoColor
Write-Host "   Pressione 'a' no terminal expo" -ForegroundColor $WarningColor
Write-Host ""
Write-Host "3️⃣  Testar no simulador iOS:" -ForegroundColor $InfoColor
Write-Host "   Pressione 'i' no terminal expo" -ForegroundColor $WarningColor
Write-Host ""
Write-Host "4️⃣  Fazer build para EAS:" -ForegroundColor $InfoColor
Write-Host "   eas build --platform all" -ForegroundColor $WarningColor
Write-Host ""
Write-Host "5️⃣  Executar testes:" -ForegroundColor $InfoColor
Write-Host "   npm test" -ForegroundColor $WarningColor
Write-Host ""

Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor $InfoColor
Write-Host "✓ Script finalizado com sucesso!" -ForegroundColor $SuccessColor
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor $InfoColor

# ============================================================================
# TROUBLESHOOTING
# ============================================================================

Write-Host ""
Write-Host "❓ Se encontrar problemas:" -ForegroundColor $WarningColor
Write-Host ""
Write-Host "Problema: 'comando não reconhecido'" -ForegroundColor $ErrorColor
Write-Host "  → Instale Node.js em https://nodejs.org/" -ForegroundColor $InfoColor
Write-Host "  → Reinicie o PowerShell após instalar" -ForegroundColor $InfoColor
Write-Host ""
Write-Host "Problema: 'EACCES: permission denied'" -ForegroundColor $ErrorColor
Write-Host "  → Execute PowerShell como Administrador" -ForegroundColor $InfoColor
Write-Host ""
Write-Host "Problema: erros de módulos não encontrados" -ForegroundColor $ErrorColor
Write-Host "  → Execute: npm install" -ForegroundColor $InfoColor
Write-Host "  → Delete node_modules: rmdir node_modules -r" -ForegroundColor $InfoColor
Write-Host "  → Execute: npm install novamente" -ForegroundColor $InfoColor
Write-Host ""
Write-Host "Problema: app não inicia após atualização" -ForegroundColor $ErrorColor
Write-Host "  → Limpe cache: expo prebuild --clean" -ForegroundColor $InfoColor
Write-Host "  → Ou: npx expo start -c" -ForegroundColor $InfoColor
Write-Host ""

Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor $InfoColor
Write-Host ""
