#!/bin/bash
export $(grep -v '^#' .env | xargs)
deno run --allow-all scripts/scraper-daemon.ts
