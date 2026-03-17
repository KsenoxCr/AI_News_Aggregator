#!/bin/env bash
set -euo pipefail

source .env

npx kysely-codegen --dialect mysql --url mysql://${LOCAL_DB_USERNAME}:${LOCAL_DB_PASSWORD}@127.0.0.1:3306/newsagg --out-file ./src/server/db/types.ts
