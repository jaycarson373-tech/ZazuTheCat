#!/bin/sh
set -eu

: "${DEPLOYER_PRIVATE_KEY:?Set DEPLOYER_PRIVATE_KEY to resume the saved deployment}"

ZAZU_NFT_RPC_URL="${ROBINHOOD_RPC_URL:-https://rpc.mainnet.chain.robinhood.com}"
ZAZU_NFT_EXPLORER_API="${ROBINHOOD_EXPLORER_API_URL:-https://robinhoodchain.blockscout.com/api/}"
ZAZU_REPO_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)

cd "$ZAZU_REPO_DIR/contracts"
forge script script/DeployZazu1212.s.sol:DeployZazu1212 \
  --rpc-url "$ZAZU_NFT_RPC_URL" \
  --broadcast \
  --resume \
  --verify \
  --verifier blockscout \
  --verifier-url "$ZAZU_NFT_EXPLORER_API" \
  -vvvv
