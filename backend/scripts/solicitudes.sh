#!/usr/bin/env bash
# Solicitudes de prueba del contrato (evidencia de 07C, 08C y 09C).
# Uso:
#   BASE_URL=http://localhost:3000 DEVICE_KEY=... bash scripts/solicitudes.sh [foto.jpg ...]
# Cada respuesta trae un "id" que aparece en el log del backend (trazabilidad).
set -u
: "${BASE_URL:?Falta BASE_URL}" "${DEVICE_KEY:?Falta DEVICE_KEY}"
URL="$BASE_URL/api/clasificar"
tmp=$(mktemp -d); trap 'rm -rf "$tmp"' EXIT

printf '\xff\xd8\xff\xe0\x00\x10\xff\xd9' > "$tmp/minimo.jpg"
printf 'esto no es un jpeg' > "$tmp/texto.jpg"
{ printf '\xff\xd8\xff'; head -c 307200 /dev/zero; printf '\xff\xd9'; } > "$tmp/grande.jpg"

caso() { # nombre, archivo, clave
  printf '\n== %s\n' "$1"
  curl -sS -w '\nHTTP %{http_code} | %{time_total}s\n' -X POST "$URL" \
    -H 'Content-Type: image/jpeg' -H "X-Device-Key: $3" --data-binary "@$2"
}

printf '== health\n'; curl -sS -w '\nHTTP %{http_code}\n' "$BASE_URL/health"
caso 'sin clave → 401 NO_AUTORIZADO' "$tmp/minimo.jpg" ''
caso 'no es JPEG → 400 IMAGEN_INVALIDA' "$tmp/texto.jpg" "$DEVICE_KEY"
caso 'más de 300 KB → 413 IMAGEN_GRANDE' "$tmp/grande.jpg" "$DEVICE_KEY"
caso 'JPEG corrupto (cabecera válida) → 400 IMAGEN_INVALIDA con Gemini' "$tmp/minimo.jpg" "$DEVICE_KEY"
for foto in "$@"; do caso "foto: $foto" "$foto" "$DEVICE_KEY"; done
