#!/bin/bash
# Instala los git hooks de GestPro
HOOKS_DIR=".git/hooks"
SRC_DIR="scripts/hooks"

cp "$SRC_DIR/pre-commit" "$HOOKS_DIR/pre-commit"
chmod +x "$HOOKS_DIR/pre-commit"
echo "✅ Hooks instalados en $HOOKS_DIR"
