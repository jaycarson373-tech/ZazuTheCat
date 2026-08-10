import assert from "node:assert/strict";
import test from "node:test";
import {
  evaluatePonsV1Readiness,
  loadPonsV1ReadinessConfig,
  PONS_V1_CANONICAL,
  sanitizeReadinessDiagnostic,
  type PonsV1ReadinessSnapshot,
} from "./pons-v1-readiness";

const baseEnv = (): NodeJS.ProcessEnv => ({
  NODE_ENV: "test",
  ROBINHOOD_RPC_URL: "https://rpc.mainnet.chain.robinhood.com",
  CHAIN_ID: "4663",
  PONS_V1_FACTORY_ADDRESS: PONS_V1_CANONICAL.factory,
  PONS_LOCKER_ADDRESS: PONS_V1_CANONICAL.locker,
  WRAPPED_NATIVE_ADDRESS: PONS_V1_CANONICAL.wrappedNative,
  PONS_SWAP_ROUTER_ADDRESS: PONS_V1_CANONICAL.swapRouter,
  PONS_QUOTER_V2_ADDRESS: PONS_V1_CANONICAL.quoterV2,
  PONS_V3_FACTORY_ADDRESS: PONS_V1_CANONICAL.v3Factory,
  PONS_POSITION_MANAGER_ADDRESS: PONS_V1_CANONICAL.positionManager,
  PONS_V1_DEX_CONFIG_ID: "0",
  PONS_V1_LAUNCH_CONFIG_ID: "0",
  PONS_V1_DEX_CONFIG_COUNT: "1",
  PONS_V1_LAUNCH_CONFIG_COUNT: "1",
  PONS_V1_LAUNCH_FEE_WEI: "500000000000000",
  PONS_V1_DEX_NAME: "uniswap v3",
  PONS_POOL_FEE: "10000",
  PONS_V1_TICK_SPACING: "200",
  PONS_V1_GRADUATION_THRESHOLD: "4200000000000000000",
  PONS_V1_INITIAL_TICK: "-204200",
  PONS_V1_SUPPLY: "1000000000000000000000000000",
  PONS_V1_MAX_WALLET_BPS: "500",
  PONS_V1_MAX_TX_BPS: "550",
  PONS_V1_RESTRICTION_BLOCKS: "2",
  PONS_V1_RESERVED_FEE: "0",
  PONS_V1_ROUTER_REQUIRES_DEADLINE: "false",
  PONS_V1_MINIMUM_INTERVAL_SECONDS: "900",
});

const goodSnapshot = (): PonsV1ReadinessSnapshot => ({
  chainId: 4663,
  blockNumber: 123n,
  code: {
    factory: true,
    locker: true,
    wrappedNative: true,
    swapRouter: true,
    quoterV2: true,
    v3Factory: true,
    positionManager: true,
  },
  factory: {
    locker: PONS_V1_CANONICAL.locker,
    launchEnabled: true,
    launchFee: 500000000000000n,
    dexConfigCount: 1n,
    launchConfigCount: 1n,
    dex: {
      name: "uniswap v3",
      factory: PONS_V1_CANONICAL.v3Factory,
      positionManager: PONS_V1_CANONICAL.positionManager,
      swapRouter: PONS_V1_CANONICAL.swapRouter,
      poolFee: 10000n,
      tickSpacing: 200n,
      enabled: true,
    },
    launch: {
      pairToken: PONS_V1_CANONICAL.wrappedNative,
      graduationThreshold: 4200000000000000000n,
      initialTick: -204200n,
      supply: 1000000000000000000000000000n,
      maxWalletBps: 500n,
      maxTxBps: 550n,
      restrictionBlocks: 2n,
      reservedFee: 0n,
      enabled: true,
      routerRequiresDeadline: false,
    },
  },
  lockerFactory: PONS_V1_CANONICAL.factory,
  routerFactory: PONS_V1_CANONICAL.v3Factory,
  routerWrappedNative: PONS_V1_CANONICAL.wrappedNative,
  quoterFactory: PONS_V1_CANONICAL.v3Factory,
  quoterWrappedNative: PONS_V1_CANONICAL.wrappedNative,
});

const integrationEnv = (): NodeJS.ProcessEnv => ({
  ...baseEnv(),
  ZAZU_TOKEN_ADDRESS: "0x1111111111111111111111111111111111111111",
  PONS_FEE_COLLECTOR_ADDRESS: "0x2222222222222222222222222222222222222222",
  BUYBACK_VAULT_ADDRESS: "0x3333333333333333333333333333333333333333",
  DEX_ROUTER_ADDRESS: "0x4444444444444444444444444444444444444444",
  KEEPER_ADDRESS: "0x5555555555555555555555555555555555555555",
  EXPECTED_MULTISIG_ADDRESS: "0x6666666666666666666666666666666666666666",
  FEE_TOKEN_ADDRESS: PONS_V1_CANONICAL.wrappedNative,
  BUYBACK_DESTINATION: PONS_V1_CANONICAL.burnDestination,
  CONFIGURATION_DELAY_SECONDS: "172800",
  PONS_V1_READINESS_QUOTE_AMOUNT_WEI: "1000000000000",
  MIN_EXECUTION_AMOUNT: "1",
  MAX_EXECUTION_AMOUNT: "2",
  MAX_SLIPPAGE_BPS: "100",
});

const addGoodIntegration = (
  snapshot: PonsV1ReadinessSnapshot,
): PonsV1ReadinessSnapshot => {
  snapshot.integration = {
    code: {
      zazuToken: true,
      collector: true,
      vault: true,
      adapter: true,
      ownerContract: true,
    },
    launch: {
      token: "0x1111111111111111111111111111111111111111",
      pairedToken: PONS_V1_CANONICAL.wrappedNative,
      positionManager: PONS_V1_CANONICAL.positionManager,
      dexId: 0n,
      launchConfigId: 0n,
      poolFee: 10000n,
      exists: true,
    },
    feeRedirect: "0x2222222222222222222222222222222222222222",
    collector: {
      owner: "0x6666666666666666666666666666666666666666",
      pendingOwner: PONS_V1_CANONICAL.zeroAddress,
      configured: true,
      wrappedNative: PONS_V1_CANONICAL.wrappedNative,
      locker: PONS_V1_CANONICAL.locker,
      zazuToken: "0x1111111111111111111111111111111111111111",
      vault: "0x3333333333333333333333333333333333333333",
      minimumClaimInterval: 900n,
    },
    vault: {
      owner: "0x6666666666666666666666666666666666666666",
      pendingOwner: PONS_V1_CANONICAL.zeroAddress,
      zazuToken: "0x1111111111111111111111111111111111111111",
      adapter: "0x4444444444444444444444444444444444444444",
      wrappedNative: PONS_V1_CANONICAL.wrappedNative,
      feeToken: PONS_V1_CANONICAL.wrappedNative,
      burnDestination: PONS_V1_CANONICAL.burnDestination,
      keeper: "0x5555555555555555555555555555555555555555",
      minimumExecutionAmount: 1n,
      maximumExecutionAmount: 2n,
      maximumSlippageBps: 100n,
      minimumInterval: 900n,
      paused: false,
      configurationTimelockEnabled: true,
      configurationDelay: 172800n,
    },
    adapter: {
      swapRouter: PONS_V1_CANONICAL.swapRouter,
      wrappedNative: PONS_V1_CANONICAL.wrappedNative,
      zazuToken: "0x1111111111111111111111111111111111111111",
      poolFee: 10000n,
    },
    quoteRoute: {
      tokenLiquidityPool: "0x8888888888888888888888888888888888888888",
      factoryPool: "0x8888888888888888888888888888888888888888",
      poolCode: true,
      quoterCode: true,
      token0: PONS_V1_CANONICAL.wrappedNative,
      token1: "0x1111111111111111111111111111111111111111",
      poolFee: 10000n,
      sqrtPriceX96: 79228162514264337593543950336n,
      liquidity: 1000000000000000000n,
      unlocked: true,
      quoteAmountIn: 1000000000000n,
      quoteAmountOut: 250000000000000000000n,
    },
  };
  return snapshot;
};

test("loads the explicit canonical base pins without enabling ZAZU checks", () => {
  const config = loadPonsV1ReadinessConfig(baseEnv());
  assert.equal(config.chainId, 4663);
  assert.equal(config.integration, undefined);
});

test("rejects a partially configured optional integration", () => {
  const env = baseEnv();
  env.ZAZU_TOKEN_ADDRESS = "0x1111111111111111111111111111111111111111";
  assert.throws(
    () => loadPonsV1ReadinessConfig(env),
    /PONS_FEE_COLLECTOR_ADDRESS/,
  );
});

test("returns a green base report only when every live pin matches", () => {
  const config = loadPonsV1ReadinessConfig(baseEnv());
  const report = evaluatePonsV1Readiness(
    config,
    goodSnapshot(),
    "2026-08-10T00:00:00.000Z",
  );
  assert.equal(report.ok, true);
  assert.equal(report.summary.failed, 0);
  assert.equal(report.summary.skipped, 1);

  const changed = goodSnapshot();
  changed.factory.launchEnabled = false;
  const failed = evaluatePonsV1Readiness(config, changed);
  assert.equal(failed.ok, false);
  assert.deepEqual(
    failed.checks.find((check) => check.id === "factory.launchEnabled"),
    { id: "factory.launchEnabled", status: "fail", expected: true, actual: false },
  );
});

test("fails closed when configured integration state is absent", () => {
  const config = loadPonsV1ReadinessConfig(integrationEnv());
  const report = evaluatePonsV1Readiness(config, goodSnapshot());
  assert.equal(report.ok, false);
  assert.deepEqual(
    report.checks.find((check) => check.id === "integration.snapshot"),
    { id: "integration.snapshot", status: "fail", expected: "present", actual: "missing" },
  );
});

test("requires accepted multisig ownership, no pending owner, and the exact timelock", () => {
  const config = loadPonsV1ReadinessConfig(integrationEnv());
  const snapshot = addGoodIntegration(goodSnapshot());
  assert.equal(evaluatePonsV1Readiness(config, snapshot).ok, true);

  snapshot.integration!.vault.pendingOwner =
    "0x7777777777777777777777777777777777777777";
  snapshot.integration!.vault.configurationDelay = 3600n;
  const failed = evaluatePonsV1Readiness(config, snapshot);
  assert.equal(failed.ok, false);
  assert.equal(
    failed.checks.find((check) => check.id === "vault.pendingOwner")?.status,
    "fail",
  );
  assert.equal(
    failed.checks.find((check) => check.id === "vault.configurationDelay")?.status,
    "fail",
  );
});

test("requires bytecode at the accepted multisig owner address", () => {
  const config = loadPonsV1ReadinessConfig(integrationEnv());
  const snapshot = addGoodIntegration(goodSnapshot());
  snapshot.integration!.code.ownerContract = false;
  const failed = evaluatePonsV1Readiness(config, snapshot);
  assert.equal(failed.ok, false);
  assert.deepEqual(
    failed.checks.find((check) => check.id === "integration.code.ownerContract"),
    {
      id: "integration.code.ownerContract",
      status: "fail",
      expected: true,
      actual: false,
    },
  );
});

test("requires the token pool, canonical pair, active pool state, and a nonzero dry-run quote", () => {
  const config = loadPonsV1ReadinessConfig(integrationEnv());
  const snapshot = addGoodIntegration(goodSnapshot());
  assert.equal(evaluatePonsV1Readiness(config, snapshot).ok, true);

  snapshot.integration!.quoteRoute.token1 =
    "0x9999999999999999999999999999999999999999";
  snapshot.integration!.quoteRoute.quoteAmountOut = 0n;
  const failed = evaluatePonsV1Readiness(config, snapshot);
  assert.equal(failed.ok, false);
  assert.equal(
    failed.checks.find((check) => check.id === "quoteRoute.token1")?.status,
    "fail",
  );
  assert.equal(
    failed.checks.find((check) => check.id === "quoteRoute.quoteAmountOut.positive")?.status,
    "fail",
  );
});

test("sanitizes RPC URLs and 32-byte hexadecimal material", () => {
  const diagnostic = sanitizeReadinessDiagnostic(
    new Error(
      "request https://rpc.example.test/path?key=secret failed for 0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    ),
  );
  assert.equal(diagnostic.includes("secret"), false);
  assert.equal(diagnostic.includes("aaaaaaaa"), false);
  assert.match(diagnostic, /\[redacted-url\]/);
  assert.match(diagnostic, /\[redacted-hex\]/);
});
