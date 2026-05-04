#!/bin/bash
# bounty-worktree.sh — create an isolated git worktree per target so multiple
# /bountyagent runs can hunt different targets concurrently without trampling
# state files, .mcp.json, or settings.

set -euo pipefail

usage() {
  cat <<EOF
Usage: $0 <target-domain> [worktree-root]

Creates a git worktree at <worktree-root>/<target-domain> on a fresh branch
(target/<target-domain>) so a Claude Code session in that worktree can run
/bountyagent against the target without sharing repo state with other targets.

  worktree-root defaults to ~/bug-bounty-worktrees

Examples:
  $0 example.com
  $0 example.com /tmp/bounty
EOF
  exit "${1:-1}"
}

[ "$#" -lt 1 ] && usage 1
[ "$1" = "-h" ] || [ "$1" = "--help" ] && usage 0

TARGET="$1"
WORKTREE_ROOT="${2:-$HOME/bug-bounty-worktrees}"
REPO_ROOT="$(git -C "$(dirname "$0")/.." rev-parse --show-toplevel 2>/dev/null || true)"

if [ -z "$REPO_ROOT" ]; then
  echo "ERROR: not in a git repo (run this from inside the bug-bounty checkout)" >&2
  exit 2
fi

# Sanitize target for branch/dir name (a-z, 0-9, dash only)
SAFE_TARGET="$(printf '%s' "$TARGET" | tr '[:upper:]' '[:lower:]' | tr -c 'a-z0-9.-' '-' | sed 's/^-*//; s/-*$//')"
if [ -z "$SAFE_TARGET" ]; then
  echo "ERROR: target '$TARGET' produced an empty sanitized name" >&2
  exit 2
fi

WORKTREE_DIR="$WORKTREE_ROOT/$SAFE_TARGET"
BRANCH="target/$SAFE_TARGET"

mkdir -p "$WORKTREE_ROOT"

if [ -d "$WORKTREE_DIR" ]; then
  echo "Worktree already exists at $WORKTREE_DIR — reusing."
  cd "$WORKTREE_DIR"
  git status --short
else
  echo "Creating worktree at $WORKTREE_DIR on branch $BRANCH..."
  git -C "$REPO_ROOT" worktree add -b "$BRANCH" "$WORKTREE_DIR" HEAD
fi

# Per-worktree session directory hint — claude code session files still go
# under ~/bounty-agent-sessions/<target>/ but each worktree has its own .claude
# permissions and statusline reading the same global session directory.
SESSION_DIR="$HOME/bounty-agent-sessions/$TARGET"
mkdir -p "$SESSION_DIR"

# Per-worktree .mcp.json must point at THIS worktree's mcp/server.js so each
# worktree has its own MCP server process, isolated from other worktrees.
MCP_JSON="$WORKTREE_DIR/.mcp.json"
SERVER_JS="$WORKTREE_DIR/mcp/server.js"

if [ -f "$MCP_JSON" ]; then
  # Update the bountyagent server path to point at this worktree
  if command -v jq >/dev/null 2>&1; then
    tmp="$(mktemp)"
    jq --arg p "$SERVER_JS" '.mcpServers.bountyagent.args = [$p]' "$MCP_JSON" > "$tmp" && mv "$tmp" "$MCP_JSON"
    echo "Updated .mcp.json to point at $SERVER_JS"
  else
    echo "WARNING: jq not installed — .mcp.json not auto-updated. Edit args to point at $SERVER_JS"
  fi
else
  cat > "$MCP_JSON" <<EOF
{
  "mcpServers": {
    "bountyagent": {
      "command": "node",
      "args": ["$SERVER_JS"]
    }
  }
}
EOF
  echo "Wrote $MCP_JSON"
fi

cat <<EOF

Worktree ready.
  cd $WORKTREE_DIR
  claude
  /bountyagent $TARGET

Session state lives in: $SESSION_DIR
Branch: $BRANCH

To remove this worktree later:
  git -C $REPO_ROOT worktree remove $WORKTREE_DIR
  git -C $REPO_ROOT branch -D $BRANCH
EOF
