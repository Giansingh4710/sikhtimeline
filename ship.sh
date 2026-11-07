#!/bin/bash
set -e
npx eas-cli build -p ios --profile production --auto-submit
