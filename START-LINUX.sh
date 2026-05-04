#!/usr/bin/env bash
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is required. Install Node.js LTS from https://nodejs.org/en/download"
  exit 1
fi
if [ ! -d node_modules ]; then npm install; fi
npm run dev
