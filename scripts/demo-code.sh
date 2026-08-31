#!/usr/bin/env bash
# Print the current TOTP code for the demo admin (rotates every 30s).
cd "$(dirname "$0")/../services/core-api"
node -e "const {totp}=require('./dist/src/auth/totp.js'); console.log(totp('JBSWY3DPEHPK3PXP', Date.now()))"
