#!/usr/bin/env bash
#
# Scarica in backend/vendor/ la coppia Chrome + chromedriver usata da FGTD.
#
# Si usa Chrome for Testing perche' Google garantisce che, per una data
# versione, il binario Chrome e il chromedriver corrispondente siano
# compatibili, e perche' gli URL sono immutabili: la stessa versione scaricata
# oggi e fra tre anni e' bit-per-bit la stessa. E' cio' che rende lo scraping
# riproducibile a distanza di tempo, requisito per un software allegato a una
# pubblicazione.
#
# Uso:
#   tools/fetch_chrome.sh            scarica la versione pinnata
#   tools/fetch_chrome.sh --force    riscarica anche se gia' presente
#
# La versione DEVE restare allineata a CHROME_VERSION in backend/browser.py.

set -euo pipefail

CHROME_VERSION="153.0.8010.36"
PLATFORM="linux64"
BASE_URL="https://storage.googleapis.com/chrome-for-testing-public"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
VENDOR_DIR="$PROJECT_ROOT/backend/vendor"

FORCE=0
[[ "${1:-}" == "--force" ]] && FORCE=1

CHROME_BIN="$VENDOR_DIR/chrome-${PLATFORM}/chrome"
DRIVER_BIN="$VENDOR_DIR/chromedriver-${PLATFORM}/chromedriver"

if [[ $FORCE -eq 0 && -f "$CHROME_BIN" && -f "$DRIVER_BIN" ]]; then
    echo "Chrome for Testing gia' presente in $VENDOR_DIR"
    echo "  chrome:       $CHROME_BIN"
    echo "  chromedriver: $DRIVER_BIN"
    echo "Usa --force per riscaricare."
    exit 0
fi

for cmd in curl unzip; do
    command -v "$cmd" >/dev/null 2>&1 || { echo "ERRORE: serve '$cmd'." >&2; exit 1; }
done

mkdir -p "$VENDOR_DIR"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

echo "Scarico Chrome for Testing $CHROME_VERSION ($PLATFORM)..."

for component in chrome chromedriver; do
    url="$BASE_URL/$CHROME_VERSION/$PLATFORM/${component}-${PLATFORM}.zip"
    echo "  -> $component"
    if ! curl -fsSL --retry 3 --retry-delay 2 -o "$TMP_DIR/${component}.zip" "$url"; then
        echo "ERRORE: download fallito da $url" >&2
        echo "Verifica che la versione $CHROME_VERSION esista ancora:" >&2
        echo "  https://googlechromelabs.github.io/chrome-for-testing/" >&2
        exit 1
    fi
    # Rimuove la copia precedente, altrimenti unzip mescola i file di due
    # versioni diverse e si ottengono crash difficili da diagnosticare.
    rm -rf "${VENDOR_DIR:?}/${component}-${PLATFORM}"
    unzip -q "$TMP_DIR/${component}.zip" -d "$VENDOR_DIR"
done

chmod +x "$CHROME_BIN" "$DRIVER_BIN"

# Verifica minima: se i binari non partono, meglio saperlo adesso che al primo
# avvio dell'applicazione sulla macchina di un revisore.
echo
echo "Verifica:"
"$CHROME_BIN" --version
"$DRIVER_BIN" --version

MISSING="$(ldd "$CHROME_BIN" 2>/dev/null | grep -i 'not found' || true)"
if [[ -n "$MISSING" ]]; then
    echo
    echo "ATTENZIONE: librerie di sistema mancanti per Chrome:" >&2
    echo "$MISSING" >&2
    echo "Su Debian/Ubuntu:" >&2
    echo "  sudo apt install libnss3 libgbm1 libasound2t64 libatk-bridge2.0-0 libxkbcommon0 libxdamage1 libxrandr2 libpango-1.0-0 libcairo2" >&2
fi

echo
echo "Fatto. Chrome imbarcato in $VENDOR_DIR"
