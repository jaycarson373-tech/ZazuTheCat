# Pons V1 readiness verifier

`npm run verify:pons-v1` performs only `eth_chainId`, block, bytecode, contract read,
and read-only quote simulation calls. It has no wallet client, transaction path,
private-key input, or external write. A mismatch or failed read exits nonzero and the
JSON output never includes the RPC URL or environment contents.

The verifier samples the latest block number first and pins every subsequent bytecode
and contract read to that exact block. The JSON `network.blockNumber` therefore identifies
one coherent state snapshot rather than a mixture of state from several blocks.

Copy `deploy/pons-v1-readiness.env.example` to a private environment file and run:

```bash
node --env-file=.env.pons-v1 --import=tsx scripts/verify-pons-v1-readiness.ts
```

The required pins check chain 4663, the canonical active V1 factory and locker,
WETH, SwapRouter02, QuoterV2, V3 factory, position manager, public launch gate,
launch fee, and the complete current DEX and launch configurations. Review and update
the code and template together if Pons publishes a new canonical deployment or changes
an owner-controlled configuration. Do not make an unexpected live mismatch green by
blindly copying it into the environment.

The optional block is all-or-nothing. When present, it additionally verifies the ZAZU
factory launch record, locker fee redirect, configured fee collector, vault token,
adapter, fee asset, keeper, canonical burn destination, 15-minute intervals, execution
limits, slippage limit, pause state, and adapter immutables. Both collector and vault must
already be owned by `EXPECTED_MULTISIG_ADDRESS`, with `pendingOwner()` cleared to zero.
The expected owner must contain contract bytecode, so an EOA cannot satisfy the
multisig-owner readiness check.
The vault configuration timelock must be enabled and its delay must exactly match
`CONFIGURATION_DELAY_SECONDS`.

### Quote-route dry run

The integration block also validates the same Pons route used by the quote service. At
the pinned block it reads `token.liquidityPool()`, requires bytecode at that pool and at
the canonical QuoterV2, confirms `V3Factory.getPool(WETH, ZAZU, fee)` returns the same
pool, and checks that `token0` and `token1` are exactly WETH and ZAZU. It also requires
the expected pool fee, a nonzero `slot0` price, nonzero active liquidity, and an unlocked
pool.

Finally, it makes a read-only QuoterV2 `eth_call` from WETH to ZAZU for
`PONS_V1_READINESS_QUOTE_AMOUNT_WEI` and requires a nonzero output. Use a small positive
amount such as `1000000000000` wei (0.000001 WETH). This dry run executes no transaction,
spends no funds, and grants no approval. It does not claim fees, swap, or burn tokens.

## Trust boundary

The vault is not immutable. Its accepted owner can pause operations and schedule a
protected ZAZU or fee-asset rescue to an arbitrary recipient, then execute that rescue
after `configurationDelay`. The same owner also controls the documented timelocked router
and destination update paths. The verifier exposes this caveat in every JSON report and
checks the accepted multisig, absence of a pending ownership transfer, enabled timelock,
and exact delay. Public copy should say these controls are transparent and delayed; it
must not claim that the vault, treasury, fee assets, or burn mechanism are immutable.

The report is suitable for deployment logs. `ok: true` means every configured read and
pin matched at the reported block; it is a point-in-time configuration check, not an
audit or a guarantee that a future transaction will succeed.
