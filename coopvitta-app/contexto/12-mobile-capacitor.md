# 12 — Mobile (Capacitor)

**Status:** ✅ Estrutura presente  
**Última atualização:** 2026-05-28

## O que existe

- Capacitor configurado em `frontend/`
- **Android:** `frontend/android/`
- **iOS:** `frontend/ios/App/`
- Script: `scripts/setup-capacitor-mobile.sh`
- Config dinâmica: `frontend/scripts/write-capacitor-config.mjs`

## Fluxo típico

```bash
cd frontend
npm run build
npx cap sync
# Abrir Android Studio / Xcode a partir de android/ ou ios/
```

## Origem do ponto

Registros marcados com `OrigemRegistroPonto.APP_MEDICO` no schema.

## Considerações

- Permissões de câmera/GPS no `Info.plist` (iOS) e manifest Android — revisar antes de release store
- API URL em produção deve apontar para backend HTTPS (env no build Capacitor)

## Pendências

- [ ] Documentar versões mínimas Android/iOS e processo de publicação quando definido
- [ ] Testes E2E mobile (não há harness automatizado documentado)
