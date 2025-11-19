#!/bin/bash
set -e

echo "Dump restoring"

# Wait for PostgreSQL to start
until pg_isready -U postgres; do
  echo "Waiting for PostgreSQL to start..."
  sleep 2
done

echo "Postgres ready"

# Check if the dump file exists
if [ -f "/docker-entrypoint-initdb.d/mydb.dump" ]; then
  echo "Restoring custom format dump..."
  
  # Use pg_restore for custom format dumps
  pg_restore -U postgres \
    --no-privileges \
    --no-owner \
    --clean \
    --if-exists \
    -d oa_prod /docker-entrypoint-initdb.d/mydb.dump
  
  # Mark database as initialized
  touch /var/lib/postgresql/data/.initialized
  
  echo "Database restoration completed."
fi

