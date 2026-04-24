#!/usr/bin/env bash
# Hook "Stop": viene lanciato automaticamente quando Claude finisce un turno.
# Silenzioso se tutto è OK, stampa output solo in caso di errore typecheck.
# Claude vede l'output come "user reminder" e può correggersi senza che tu
# debba chiederlo.

set +e

# Non bloccare mai il turno di Claude: in caso di errori interni esci 0.
trap 'exit 0' ERR

ROOT="${CLAUDE_PROJECT_DIR:-$(pwd)}"
cd "$ROOT" 2>/dev/null || exit 0

# Hook no-op se questa non è la repo dell'app.
[ -f package.json ] || exit 0
command -v pnpm >/dev/null 2>&1 || exit 0

# Esegui typecheck; scarta stdout ma cattura exit code.
LOG=$(mktemp /tmp/smm-tc.XXXXXX)
if ! pnpm typecheck >"$LOG" 2>&1; then
  echo "⚠️  typecheck fallito dopo le modifiche recenti:"
  echo
  tail -30 "$LOG"
fi
rm -f "$LOG"
exit 0
