# workboard Development Justfile

set dotenv-load := true
set dotenv-filename := ".env.local"

# Default recipe
default:
    @just info
    @just --list

# Project information
info:
    @echo "Current Project: workboard"
    @echo "Description: Web UI for wrkq task management"
    @echo "Stack:       TypeScript/Bun monorepo (API + Vite frontend)"
    @echo ""
    @echo "Key commands:"
    @echo "  just build     - Build all packages"
    @echo "  just test      - Run tests"
    @echo "  just lint      - Run linter"
    @echo "  just verify    - Run lint + test"

# Session prefix for tmux (set by stackctl via TOOL_STACK env var)
# Standalone: workboard-api, workboard-web
# With stackctl: stack-dev-workboard-api, stack-stable-workboard-api, etc.
stack := env_var_or_default("TOOL_STACK", "")
session_prefix := if stack == "" { "" } else { "stack-" + stack + "-" }

# Ports (override via .env.local or environment)
api_port := env_var_or_default("API_PORT", "18461")
web_port := env_var_or_default("WORKBOARD_WEB_PORT", "18460")

# Log directory (from CP env or default)
log_dir := env_var_or_default("CP_LOG_DIR", "~/.control-plane/dev/logs")

# ─────────────────────────────────────────────────────────────
# Development
# ─────────────────────────────────────────────────────────────

# Build all packages
[group('dev')]
build:
    bun run build

# Lint
[group('dev')]
lint:
    bun run lint

# Type check
[group('dev')]
typecheck:
    bun run typecheck

# Run tests
[group('dev')]
test:
    bun run test

# Pre-merge verification
verify: lint typecheck test

# ─────────────────────────────────────────────────────────────
# Infrastructure
# ─────────────────────────────────────────────────────────────

# Ensure log directory exists
[private]
ensure-logs:
    #!/usr/bin/env bash
    log_dir="{{log_dir}}"
    log_dir="${log_dir/#\~/$HOME}"
    mkdir -p "$log_dir"

# Start API server in tmux session
[group('infra')]
start-api: ensure-logs
    #!/usr/bin/env bash
    session="{{session_prefix}}workboard-api"
    log_dir="{{log_dir}}"
    log_dir="${log_dir/#\~/$HOME}"
    if tmux has-session -t "$session" 2>/dev/null; then
        echo "$session already running"
        exit 0
    fi
    if lsof -nP -iTCP:{{api_port}} -sTCP:LISTEN >/dev/null 2>&1; then
        echo "API port {{api_port}} is already in use; aborting"
        exit 1
    fi
    mkdir -p "$log_dir"
    tmux new-session -d -s "$session" \
        "bun run --filter '@workboard/api' dev 2>&1 | tee -a $log_dir/workboard-api.log"
    echo "Started $session on http://localhost:{{api_port}} (logging to $log_dir/workboard-api.log)"

# Start Web UI in tmux session
[group('infra')]
start-web: ensure-logs
    #!/usr/bin/env bash
    session="{{session_prefix}}workboard-web"
    log_dir="{{log_dir}}"
    log_dir="${log_dir/#\~/$HOME}"
    if tmux has-session -t "$session" 2>/dev/null; then
        echo "$session already running"
        exit 0
    fi
    if lsof -nP -iTCP:{{web_port}} -sTCP:LISTEN >/dev/null 2>&1; then
        echo "Web port {{web_port}} is already in use; aborting"
        exit 1
    fi
    mkdir -p "$log_dir"
    tmux new-session -d -s "$session" \
        "bun run --filter '@workboard/web' dev -- --host 0.0.0.0 --port {{web_port}} --strictPort 2>&1 | tee -a $log_dir/workboard-web.log"
    echo "Started $session on http://localhost:{{web_port}} (logging to $log_dir/workboard-web.log)"

# Start all services
[group('infra')]
up: start-api start-web
    @echo "workboard infrastructure up"

# Stop API server
[group('infra')]
stop-api:
    #!/usr/bin/env bash
    session="{{session_prefix}}workboard-api"
    if tmux has-session -t "$session" 2>/dev/null; then
        tmux kill-session -t "$session"
        echo "Stopped $session"
    else
        echo "$session not running"
    fi

# Stop Web UI
[group('infra')]
stop-web:
    #!/usr/bin/env bash
    session="{{session_prefix}}workboard-web"
    if tmux has-session -t "$session" 2>/dev/null; then
        tmux kill-session -t "$session"
        echo "Stopped $session"
    else
        echo "$session not running"
    fi

# Stop all services
[group('infra')]
down: stop-web stop-api
    @echo "workboard infrastructure down"

# Restart all services
[group('infra')]
restart: down up

# Show status
[group('infra')]
status:
    #!/usr/bin/env bash
    echo "=== tmux sessions ==="
    prefix="{{session_prefix}}"
    if [ -n "$prefix" ]; then
        tmux list-sessions 2>/dev/null | grep -E "^${prefix}workboard-" || echo "No ${prefix}workboard sessions"
    else
        tmux list-sessions 2>/dev/null | grep -E '^workboard-' || echo "No workboard sessions"
    fi
    echo ""
    echo "=== API health ==="
    curl -s "http://localhost:{{api_port}}/admin/status" 2>/dev/null || echo "API not responding"
    echo ""
    echo "=== Web UI ==="
    curl -s "http://localhost:{{web_port}}" >/dev/null 2>&1 && echo "Web UI: http://localhost:{{web_port}} ✓" || echo "Web UI not responding"

# ─────────────────────────────────────────────────────────────
# Legacy / Convenience
# ─────────────────────────────────────────────────────────────

# Start with mock API (for testing without control-plane)
start-mock:
    @echo "Starting mock API and web dev server..."
    @bun scripts/mock-api.ts &
    @sleep 1
    @bun run --filter '@workboard/web' dev

# Take prototype screenshots
screenshot:
    bun scripts/screenshot-prototype.ts
