#!/bin/bash
# setup_headless_env.sh
#
# Provisions the headless Minecraft test environment (Java + Bedrock dedicated
# servers) that the repo's integration tests drive. After this script succeeds,
# the tests are immediately runnable from the repo root:
#
#   node tests/run.mjs            # Java suites (build pack from src/ and test it)
#   node tests/run-bedrock.mjs    # Bedrock smoke suite
#
# The harness auto-detects the environment created here (it also honors
# MC_TEST_SERVER_DIR / MC_TEST_BEDROCK_DIR). See tests/README.md for everything
# else an agent needs.
#
# NOTE: Requires these domains on the Claude Code environment network allowlist:
#   piston-meta.mojang.com
#   piston-data.mojang.com
#   net-secondary.web.minecraft-services.net
#   www.minecraft.net
#   minecraft.azureedge.net

set -euo pipefail

echo "Starting Headless Minecraft Test Environment Setup..."

# ------------------------------------------
# Helpers
# ------------------------------------------
fetch_json() {
  local url="$1"
  local out
  if ! out=$(curl -fsSL --retry 3 --retry-delay 2 -A "Mozilla/5.0 (X11; Linux x86_64)" "$url"); then
    echo "ERROR: failed to fetch $url" >&2
    echo "       If running in Claude Code, this domain is likely not on the network allowlist." >&2
    echo "       Debug with: curl -v $url  (look for the x-deny-reason header)" >&2
    exit 1
  fi
  if ! echo "$out" | jq -e . >/dev/null 2>&1; then
    echo "ERROR: non-JSON response from $url — first 500 bytes:" >&2
    echo "$out" | head -c 500 >&2
    echo >&2
    exit 1
  fi
  echo "$out"
}

require_nonempty() {
  if [ -z "$1" ] || [ "$1" = "null" ]; then
    echo "ERROR: could not determine $2 (jq returned empty/null)" >&2
    exit 1
  fi
}

# ------------------------------------------
# 1. Prerequisites
# ------------------------------------------
echo "Removing apt sources blocked by the environment's egress proxy..."

# grep exits 1 on no matches, which set -e/pipefail would treat as fatal —
# so collect matches with the failure suppressed.
BLOCKED_FILES=$(grep -rl -e 'ppa.launchpadcontent.net' -e 'ppa.launchpad.net' \
  /etc/apt/sources.list.d/ 2>/dev/null || true)

if [ -n "$BLOCKED_FILES" ]; then
  echo "$BLOCKED_FILES" | while read -r f; do
    echo "  Removing $f"
    sudo rm -f "$f"
  done
else
  echo "  No blocked PPA source files found."
fi

if [ -f /etc/apt/sources.list ] && grep -q -e 'ppa.launchpadcontent.net' -e 'ppa.launchpad.net' /etc/apt/sources.list; then
  echo "  Commenting out PPA entries in /etc/apt/sources.list"
  sudo sed -i -e '\|ppa.launchpadcontent.net|s|^|# |' -e '\|ppa.launchpad.net|s|^|# |' /etc/apt/sources.list
fi

# gcc: the Bedrock test runner compiles a small LD_PRELOAD shim
# (tests/lib/ipv6shim.c) in containers without IPv6 — BDS otherwise aborts at
# boot with a misleading "Port may be in use" error. Harmless if IPv6 exists.
echo "Installing prerequisites (Java 25, wget, unzip, curl, jq, gcc)..."
if ! sudo apt-get update; then
  echo "WARNING: apt-get update reported errors; continuing since main Ubuntu repos likely succeeded." >&2
fi
sudo apt-get install -y openjdk-25-jre-headless wget unzip curl jq gcc

# Node.js 18+ runs the zero-dependency test harness (tests/run.mjs). Claude
# Code images usually ship a recent Node already; install only if missing.
if command -v node >/dev/null 2>&1 && node -e 'process.exit(parseInt(process.versions.node, 10) >= 18 ? 0 : 1)'; then
  echo "Node.js $(node --version) present."
else
  echo "Installing Node.js (test harness needs 18+)..."
  sudo apt-get install -y nodejs
  node -e 'process.exit(parseInt(process.versions.node, 10) >= 18 ? 0 : 1)' \
    || { echo "ERROR: installed Node is older than 18 — install a newer Node manually." >&2; exit 1; }
fi

# Default install location. The harness looks here (~/minecraft_test_env)
# automatically; override with MC_TEST_ENV_DIR when provisioning somewhere else
# (then export MC_TEST_SERVER_DIR / MC_TEST_BEDROCK_DIR for the harness, or
# pass --server-dir).
BASE_DIR="${MC_TEST_ENV_DIR:-$HOME/minecraft_test_env}"
mkdir -p "$BASE_DIR"
cd "$BASE_DIR"

# ==========================================
# JAVA EDITION SETUP (Latest Release)
# ==========================================
echo "Setting up Java Edition (Latest Release)..."
mkdir -p java_server
cd java_server

echo "Fetching latest Java release manifest..."
MANIFEST_URL="https://piston-meta.mojang.com/mc/game/version_manifest.json"
MANIFEST=$(fetch_json "$MANIFEST_URL")

LATEST_JAVA_VERSION=$(echo "$MANIFEST" | jq -r '.latest.release')
require_nonempty "$LATEST_JAVA_VERSION" "latest Java release version"
echo "Latest Java version is $LATEST_JAVA_VERSION"

VERSION_JSON_URL=$(echo "$MANIFEST" | jq -r ".versions[] | select(.id==\"$LATEST_JAVA_VERSION\") | .url")
require_nonempty "$VERSION_JSON_URL" "version JSON URL for $LATEST_JAVA_VERSION"

SERVER_JAR_URL=$(fetch_json "$VERSION_JSON_URL" | jq -r '.downloads.server.url')
require_nonempty "$SERVER_JAR_URL" "server.jar download URL"

echo "Downloading Java server.jar from $SERVER_JAR_URL ..."
if ! wget -q --show-progress -O server.jar "$SERVER_JAR_URL"; then
  echo "ERROR: failed to download server.jar — is piston-data.mojang.com on the allowlist?" >&2
  exit 1
fi

JAR_SIZE=$(stat -c%s server.jar)
if [ "$JAR_SIZE" -lt 1000000 ]; then
  echo "ERROR: server.jar is suspiciously small ($JAR_SIZE bytes) — likely a blocked/error response." >&2
  head -c 500 server.jar >&2
  exit 1
fi

# Pre-warm the bundler: the first `java -jar server.jar` invocation unpacks
# libraries/ and versions/ into the server dir (~30-60s). Doing it here means
# the first test run doesn't pay that cost inside a suite's boot timeout.
# --initSettings writes default eula/server.properties and exits without
# creating a world; fall back to a plain short run if the flag ever changes.
echo "Pre-warming the server jar (unpacking bundled libraries)..."
if ! java -Xmx1G -jar server.jar --initSettings nogui >/dev/null 2>&1; then
  echo "  --initSettings unsupported? Falling back to a bounded plain start."
  (timeout 90 java -Xmx1G -jar server.jar nogui >/dev/null 2>&1 || true)
  rm -rf world  # discard any world the fallback boot began generating
fi
if [ ! -d libraries ]; then
  echo "WARNING: libraries/ was not unpacked; the first test run will do it (slower first boot)." >&2
fi

echo "eula=true" > eula.txt
mkdir -p world/datapacks/infinite_rail

# Baseline config for MANUAL runs only. The test harness (tests/lib/server.mjs)
# rewrites server.properties and wipes world/ on every suite, enabling RCON
# (port 25575), pinning a fixed seed, and setting pause-when-empty-seconds=-1
# (an empty server must keep ticking for headless tests). Keep nothing
# precious in java_server/world.
cat <<EOF > server.properties
online-mode=false
level-name=world
spawn-protection=0
difficulty=peaceful
view-distance=4
simulation-distance=4
max-players=1
enable-rcon=false
EOF

cd ..

# ==========================================
# BEDROCK EDITION SETUP (Latest Release)
# ==========================================
echo "Setting up Bedrock Edition (Latest Release)..."
mkdir -p bedrock_server
cd bedrock_server

echo "Fetching latest Bedrock download URL..."
BEDROCK_API="https://net-secondary.web.minecraft-services.net/api/v1.0/download/links"
BEDROCK_URL=$(fetch_json "$BEDROCK_API" | jq -r '.result.links[] | select(.downloadType=="serverBedrockLinux") | .downloadUrl')
require_nonempty "$BEDROCK_URL" "Bedrock Linux server download URL"

echo "Downloading Bedrock server zip from $BEDROCK_URL ..."
if ! wget -q --show-progress --user-agent="Mozilla/5.0 (X11; Linux x86_64)" -O bedrock-server.zip "$BEDROCK_URL"; then
  echo "ERROR: failed to download Bedrock zip — check that the host in the URL above is on the allowlist." >&2
  exit 1
fi

ZIP_SIZE=$(stat -c%s bedrock-server.zip)
if [ "$ZIP_SIZE" -lt 1000000 ]; then
  echo "ERROR: bedrock-server.zip is suspiciously small ($ZIP_SIZE bytes) — likely a blocked/error response." >&2
  head -c 500 bedrock-server.zip >&2
  exit 1
fi

unzip -q bedrock-server.zip
rm bedrock-server.zip

if [ ! -f server.properties ] || [ ! -f bedrock_server ]; then
  echo "ERROR: unexpected Bedrock zip layout — server.properties or bedrock_server binary missing." >&2
  ls -la >&2
  exit 1
fi
chmod +x bedrock_server

sed -i 's/content-log-file-enabled=false/content-log-file-enabled=true/' server.properties
if ! grep -q 'content-log-file-enabled=true' server.properties; then
  echo "content-log-file-enabled=true" >> server.properties
fi

mkdir -p behavior_packs/infinite_rail
mkdir -p "worlds/Bedrock level/behavior_packs"

# NOTE for manual use: the test harness (tests/lib/bedrock.mjs) reconfigures
# this server on every run — offline mode (the sandbox has no route to
# Minecraft services), allow-list off + allowlist.json REMOVED (BDS refuses
# offline mode while the file exists), enable-lan-visibility=false, content
# log to console, and it wipes worlds/ and installs the pack under test into
# development_behavior_packs/ + development_resource_packs/. In containers
# without IPv6 it LD_PRELOADs a compiled tests/lib/ipv6shim.c so BDS can bind.

echo "Verifying Bedrock binary can start (5s smoke test)..."
set +e
LD_LIBRARY_PATH=. timeout 5 ./bedrock_server > /tmp/bedrock_smoke.log 2>&1
RC=$?
set -e
if [ "$RC" -ne 124 ] && [ "$RC" -ne 0 ]; then
  if grep -q 'Port \[.*\] may be in use' /tmp/bedrock_smoke.log; then
    echo "NOTE: BDS reported 'Port may be in use' — in IPv6-less containers this is" >&2
    echo "      a misleading v6-bind failure. The test harness works around it with" >&2
    echo "      an LD_PRELOAD shim (tests/lib/ipv6shim.c, needs gcc). Nothing to fix." >&2
  else
    echo "WARNING: bedrock_server exited early (code $RC). Output:" >&2
    cat /tmp/bedrock_smoke.log >&2
    echo "You may be missing native libs (libcurl4, libssl). Continuing anyway." >&2
  fi
fi

cd "$BASE_DIR"

echo ""
echo "Setup complete! Layout:"
echo "  $BASE_DIR/java_server      — manual run: cd java_server && java -Xmx1G -jar server.jar nogui"
echo "  $BASE_DIR/bedrock_server   — manual run: cd bedrock_server && LD_LIBRARY_PATH=. ./bedrock_server"
echo "  Java datapack (manual):    java_server/world/datapacks/infinite_rail"
echo "  Bedrock BP (manual):       bedrock_server/behavior_packs/infinite_rail"
echo ""
echo "Integration tests (from the repo root — see tests/README.md):"
echo "  node tests/run.mjs                # Java: build from src/ and run all suites (~5 min)"
echo "  node tests/run.mjs --pack X.zip   # Java: test a CI artifact instead"
echo "  node tests/run-bedrock.mjs        # Bedrock smoke suite (~1 min)"