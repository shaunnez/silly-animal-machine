#!/bin/zsh
set -e
cd "$(dirname "$0")"
export PATH="$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
if ! command -v node >/dev/null || ! command -v npm >/dev/null; then
  echo 'Please install Node.js 22 or newer, then open this launcher again.'
  read '?Press Enter to close.'
  exit 1
fi
if curl --fail --silent --max-time 2 http://127.0.0.1:4173/ | grep -q '<title>Silly Animal Machine</title>'; then
  open http://127.0.0.1:4173/
  exit 0
fi
if [ ! -d node_modules ]; then npm ci; fi
(sleep 2; open http://127.0.0.1:4173/) &
echo 'Keep this window open while playing. Press Control-C to stop the game.'
npm start
