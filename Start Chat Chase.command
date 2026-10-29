#!/bin/zsh
cd -- "${0:A:h}"
if ! command -v npm >/dev/null 2>&1; then
  print 'Please install Node.js 22.12 or later from https://nodejs.org, then try again.'
  read '?Press Enter to close.'
  exit 1
fi
if [[ ! -d node_modules ]]; then
  npm install || exit 1
fi
(sleep 2; open 'http://localhost:5173/?demo=1') &
npm run dev -- --port 5173 --strictPort
