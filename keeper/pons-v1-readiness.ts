import {
  createPublicClient,
  defineChain,
  getAddress,
  http,
  isAddress,
  parseAbi,
  type Address,
} from "viem";

export const PONS_V1_CANONICAL = {
  chainId: 4663,
  factory: "0xA5aAb3F0c6EeadF30Ef1D3Eb997108E976351feB",
  locker: "0x736D76699C26D0d966744cAe304C000d471f7F35",
  wrappedNative: "0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73",
  swapRouter: "0xCaf681a66D020601342297493863E78C959E5cb2",
  quoterV2: "0x33e885eD0Ec9bF04EcfB19341582aADCb4c8A9E7",
  v3Factory: "0x1f7d7550B1b028f7571E69A784071F0205FD2EfA",
  positionManager: "0x73991a25C818Bf1f1128dEAaB1492D45638DE0D3",
  zeroAddress: "0x0000000000000000000000000000000000000000",
  burnDestination: "0x000000000000000000000000000000000000dEaD",
} as const satisfies Record<string, number | Address>;

export const VAULT_TRUST_NOTICE =
  "The accepted vault owner can pause operations and schedule a protected ZAZU or fee-asset rescue to an arbitrary recipient after the configured timelock. The controls are transparent and delayed, not immutable.";

const factoryAbi = parseAbi([
  "struct DexConfig { string name; address factory; address positionManager; address swapRouter; uint24 poolFee; int24 tickSpacing; bool enabled; }",
  "struct LaunchConfig { address pairToken; uint256 graduationThreshold; int24 initialTick; uint256 supply; uint16 maxWalletBps; uint16 maxTxBps; uint32 restrictionBlocks; uint24 reservedFee; bool enabled; bool routerRequiresDeadline; }",
  "struct LaunchedToken { address token; address deployer; address pairedToken; address positionManager; uint256 positionId; uint256 dexId; uint256 launchConfigId; uint256 restrictionsEndBlock; uint256 supply; bool isToken0; uint24 poolFee; bool exists; uint256 initialBuyAmount; }",
  "function locker() view returns (address)",
  "function launchEnabled() view returns (bool)",
  "function launchFee() view returns (uint256)",
  "function dexConfigCount() view returns (uint256)",
  "function launchConfigCount() view returns (uint256)",
  "function getDexConfig(uint256 id) view returns (DexConfig)",
  "function getLaunchConfig(uint256 id) view returns (LaunchConfig)",
  "function getLaunchedToken(address token) view returns (LaunchedToken)",
]);

const lockerAbi = parseAbi([
  "function factory() view returns (address)",
  "function feeRedirects(address token) view returns (address)",
]);

const peripheryAbi = parseAbi([
  "function factory() view returns (address)",
  "function WETH9() view returns (address)",
]);

const collectorAbi = parseAbi([
  "function owner() view returns (address)",
  "function pendingOwner() view returns (address)",
  "function configured() view returns (bool)",
  "function wrappedNativeToken() view returns (address)",
  "function ponsLocker() view returns (address)",
  "function zazuToken() view returns (address)",
  "function buybackVault() view returns (address)",
  "function minimumClaimInterval() view returns (uint256)",
]);

const vaultAbi = parseAbi([
  "function owner() view returns (address)",
  "function pendingOwner() view returns (address)",
  "function zazuToken() view returns (address)",
  "function dexRouter() view returns (address)",
  "function wrappedNativeToken() view returns (address)",
  "function feeToken() view returns (address)",
  "function buybackDestination() view returns (address)",
  "function keeper() view returns (address)",
  "function minimumExecutionAmount() view returns (uint256)",
  "function maximumExecutionAmount() view returns (uint256)",
  "function maximumSlippageBps() view returns (uint256)",
  "function minimumInterval() view returns (uint256)",
  "function paused() view returns (bool)",
  "function configurationTimelockEnabled() view returns (bool)",
  "function configurationDelay() view returns (uint48)",
]);

const adapterAbi = parseAbi([
  "function ponsSwapRouter() view returns (address)",
  "function wrappedNativeToken() view returns (address)",
  "function zazuToken() view returns (address)",
  "function poolFee() view returns (uint24)",
]);

const tokenAbi = parseAbi([
  "function liquidityPool() view returns (address)",
]);

const v3FactoryAbi = parseAbi([
  "function getPool(address tokenA,address tokenB,uint24 fee) view returns (address pool)",
]);

const poolAbi = parseAbi([
  "function token0() view returns (address)",
  "function token1() view returns (address)",
  "function fee() view returns (uint24)",
  "function liquidity() view returns (uint128)",
  "function slot0() view returns (uint160 sqrtPriceX96,int24 tick,uint16 observationIndex,uint16 observationCardinality,uint16 observationCardinalityNext,uint8 feeProtocol,bool unlocked)",
]);

const quoterAbi = parseAbi([
  "function quoteExactInputSingle((address tokenIn,address tokenOut,uint256 amountIn,uint24 fee,uint160 sqrtPriceLimitX96) params) returns (uint256 amountOut,uint160 sqrtPriceX96After,uint32 initializedTicksCrossed,uint256 gasEstimate)",
]);

export interface PonsV1ReadinessConfig {
  rpcUrl: string;
  chainId: number;
  factory: Address;
  locker: Address;
  wrappedNative: Address;
  swapRouter: Address;
  quoterV2: Address;
  v3Factory: Address;
  positionManager: Address;
  dexConfigId: bigint;
  launchConfigId: bigint;
  expectedDexConfigCount: bigint;
  expectedLaunchConfigCount: bigint;
  launchFeeWei: bigint;
  dexName: string;
  poolFee: bigint;
  tickSpacing: bigint;
  graduationThreshold: bigint;
  initialTick: bigint;
  supply: bigint;
  maxWalletBps: bigint;
  maxTxBps: bigint;
  restrictionBlocks: bigint;
  reservedFee: bigint;
  routerRequiresDeadline: boolean;
  minimumInterval: bigint;
  integration?: {
    zazuToken: Address;
    collector: Address;
    vault: Address;
    adapter: Address;
    keeper: Address;
    feeToken: Address;
    burnDestination: Address;
    expectedOwner: Address;
    configurationDelay: bigint;
    quoteAmountWei: bigint;
    minimumExecutionAmount: bigint;
    maximumExecutionAmount: bigint;
    maximumSlippageBps: bigint;
  };
}

interface DexSnapshot {
  name: string;
  factory: Address;
  positionManager: Address;
  swapRouter: Address;
  poolFee: bigint;
  tickSpacing: bigint;
  enabled: boolean;
}

interface LaunchConfigSnapshot {
  pairToken: Address;
  graduationThreshold: bigint;
  initialTick: bigint;
  supply: bigint;
  maxWalletBps: bigint;
  maxTxBps: bigint;
  restrictionBlocks: bigint;
  reservedFee: bigint;
  enabled: boolean;
  routerRequiresDeadline: boolean;
}

export interface PonsV1ReadinessSnapshot {
  chainId: number;
  blockNumber: bigint;
  code: Record<
    | "factory"
    | "locker"
    | "wrappedNative"
    | "swapRouter"
    | "quoterV2"
    | "v3Factory"
    | "positionManager",
    boolean
  >;
  factory: {
    locker: Address;
    launchEnabled: boolean;
    launchFee: bigint;
    dexConfigCount: bigint;
    launchConfigCount: bigint;
    dex: DexSnapshot;
    launch: LaunchConfigSnapshot;
  };
  lockerFactory: Address;
  routerFactory: Address;
  routerWrappedNative: Address;
  quoterFactory: Address;
  quoterWrappedNative: Address;
  integration?: {
    code: Record<"zazuToken" | "collector" | "vault" | "adapter" | "ownerContract", boolean>;
    launch: {
      token: Address;
      pairedToken: Address;
      positionManager: Address;
      dexId: bigint;
      launchConfigId: bigint;
      poolFee: bigint;
      exists: boolean;
    };
    feeRedirect: Address;
    collector: {
      owner: Address;
      pendingOwner: Address;
      configured: boolean;
      wrappedNative: Address;
      locker: Address;
      zazuToken: Address;
      vault: Address;
      minimumClaimInterval: bigint;
    };
    vault: {
      owner: Address;
      pendingOwner: Address;
      zazuToken: Address;
      adapter: Address;
      wrappedNative: Address;
      feeToken: Address;
      burnDestination: Address;
      keeper: Address;
      minimumExecutionAmount: bigint;
      maximumExecutionAmount: bigint;
      maximumSlippageBps: bigint;
      minimumInterval: bigint;
      paused: boolean;
      configurationTimelockEnabled: boolean;
      configurationDelay: bigint;
    };
    adapter: {
      swapRouter: Address;
      wrappedNative: Address;
      zazuToken: Address;
      poolFee: bigint;
    };
    quoteRoute: {
      tokenLiquidityPool: Address;
      factoryPool: Address;
      poolCode: boolean;
      quoterCode: boolean;
      token0: Address;
      token1: Address;
      poolFee: bigint;
      sqrtPriceX96: bigint;
      liquidity: bigint;
      unlocked: boolean;
      quoteAmountIn: bigint;
      quoteAmountOut: bigint;
    };
  };
}

type PublicValue = string | number | boolean | null;

export interface ReadinessCheck {
  id: string;
  status: "pass" | "fail" | "skip";
  expected?: PublicValue;
  actual?: PublicValue;
}

export interface PonsV1ReadinessReport {
  schemaVersion: 1;
  generatedAt: string;
  readOnly: true;
  ok: boolean;
  network: { chainId: number; blockNumber: string };
  integrationEnabled: boolean;
  trustNotice: string;
  summary: { passed: number; failed: number; skipped: number };
  checks: ReadinessCheck[];
}

const required = (env: NodeJS.ProcessEnv, name: string): string => {
  const value = env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable ${name}`);
  return value;
};

const optional = (env: NodeJS.ProcessEnv, name: string): string | undefined => {
  const value = env[name]?.trim();
  return value || undefined;
};

const address = (env: NodeJS.ProcessEnv, name: string): Address => {
  const value = required(env, name);
  if (!isAddress(value, { strict: false })) throw new Error(`${name} must be an EVM address`);
  return getAddress(value);
};

const unsigned = (env: NodeJS.ProcessEnv, name: string): bigint => {
  const value = required(env, name);
  if (!/^\d+$/.test(value)) throw new Error(`${name} must be an unsigned base-10 integer`);
  return BigInt(value);
};

const signed = (env: NodeJS.ProcessEnv, name: string): bigint => {
  const value = required(env, name);
  if (!/^-?\d+$/.test(value)) throw new Error(`${name} must be a base-10 integer`);
  return BigInt(value);
};

const bool = (env: NodeJS.ProcessEnv, name: string): boolean => {
  const value = required(env, name).toLowerCase();
  if (value === "true" || value === "1") return true;
  if (value === "false" || value === "0") return false;
  throw new Error(`${name} must be true, false, 1, or 0`);
};

export function loadPonsV1ReadinessConfig(
  env: NodeJS.ProcessEnv = process.env,
): PonsV1ReadinessConfig {
  const rpcUrl = required(env, "ROBINHOOD_RPC_URL");
  let parsedRpc: URL;
  try {
    parsedRpc = new URL(rpcUrl);
  } catch {
    throw new Error("ROBINHOOD_RPC_URL must be a valid URL");
  }
  const local = parsedRpc.hostname === "localhost" || parsedRpc.hostname === "127.0.0.1";
  if (parsedRpc.protocol !== "https:" && !(local && parsedRpc.protocol === "http:")) {
    throw new Error("ROBINHOOD_RPC_URL must use HTTPS (HTTP is allowed only locally)");
  }

  const chainId = Number(required(env, "CHAIN_ID"));
  if (!Number.isSafeInteger(chainId) || chainId !== PONS_V1_CANONICAL.chainId) {
    throw new Error(`CHAIN_ID must be ${PONS_V1_CANONICAL.chainId}`);
  }

  const optionalPrimaryNames = [
    "ZAZU_TOKEN_ADDRESS",
    "PONS_FEE_COLLECTOR_ADDRESS",
    "BUYBACK_VAULT_ADDRESS",
    "DEX_ROUTER_ADDRESS",
  ] as const;
  const integrationRequested = optionalPrimaryNames.some((name) => optional(env, name));
  if (integrationRequested) {
    const missingPrimary = optionalPrimaryNames.filter((name) => !optional(env, name));
    if (missingPrimary.length > 0) {
      throw new Error(
        `Optional integration pins are all-or-nothing; missing ${missingPrimary.join(", ")}`,
      );
    }
  }

  const config: PonsV1ReadinessConfig = {
    rpcUrl,
    chainId,
    factory: address(env, "PONS_V1_FACTORY_ADDRESS"),
    locker: address(env, "PONS_LOCKER_ADDRESS"),
    wrappedNative: address(env, "WRAPPED_NATIVE_ADDRESS"),
    swapRouter: address(env, "PONS_SWAP_ROUTER_ADDRESS"),
    quoterV2: address(env, "PONS_QUOTER_V2_ADDRESS"),
    v3Factory: address(env, "PONS_V3_FACTORY_ADDRESS"),
    positionManager: address(env, "PONS_POSITION_MANAGER_ADDRESS"),
    dexConfigId: unsigned(env, "PONS_V1_DEX_CONFIG_ID"),
    launchConfigId: unsigned(env, "PONS_V1_LAUNCH_CONFIG_ID"),
    expectedDexConfigCount: unsigned(env, "PONS_V1_DEX_CONFIG_COUNT"),
    expectedLaunchConfigCount: unsigned(env, "PONS_V1_LAUNCH_CONFIG_COUNT"),
    launchFeeWei: unsigned(env, "PONS_V1_LAUNCH_FEE_WEI"),
    dexName: required(env, "PONS_V1_DEX_NAME"),
    poolFee: unsigned(env, "PONS_POOL_FEE"),
    tickSpacing: signed(env, "PONS_V1_TICK_SPACING"),
    graduationThreshold: unsigned(env, "PONS_V1_GRADUATION_THRESHOLD"),
    initialTick: signed(env, "PONS_V1_INITIAL_TICK"),
    supply: unsigned(env, "PONS_V1_SUPPLY"),
    maxWalletBps: unsigned(env, "PONS_V1_MAX_WALLET_BPS"),
    maxTxBps: unsigned(env, "PONS_V1_MAX_TX_BPS"),
    restrictionBlocks: unsigned(env, "PONS_V1_RESTRICTION_BLOCKS"),
    reservedFee: unsigned(env, "PONS_V1_RESERVED_FEE"),
    routerRequiresDeadline: bool(env, "PONS_V1_ROUTER_REQUIRES_DEADLINE"),
    minimumInterval: unsigned(env, "PONS_V1_MINIMUM_INTERVAL_SECONDS"),
  };

  if (integrationRequested) {
    const minimumExecutionAmount = unsigned(env, "MIN_EXECUTION_AMOUNT");
    const maximumExecutionAmount = unsigned(env, "MAX_EXECUTION_AMOUNT");
    const maximumSlippageBps = unsigned(env, "MAX_SLIPPAGE_BPS");
    const configurationDelay = unsigned(env, "CONFIGURATION_DELAY_SECONDS");
    const quoteAmountWei = unsigned(env, "PONS_V1_READINESS_QUOTE_AMOUNT_WEI");
    if (minimumExecutionAmount === 0n || maximumExecutionAmount < minimumExecutionAmount) {
      throw new Error("Integration execution limits are invalid");
    }
    if (maximumSlippageBps === 0n || maximumSlippageBps > 500n) {
      throw new Error("MAX_SLIPPAGE_BPS must be between 1 and 500");
    }
    if (configurationDelay < 3600n) {
      throw new Error("CONFIGURATION_DELAY_SECONDS must be at least 3600");
    }
    if (quoteAmountWei === 0n) {
      throw new Error("PONS_V1_READINESS_QUOTE_AMOUNT_WEI must be greater than zero");
    }
    config.integration = {
      zazuToken: address(env, "ZAZU_TOKEN_ADDRESS"),
      collector: address(env, "PONS_FEE_COLLECTOR_ADDRESS"),
      vault: address(env, "BUYBACK_VAULT_ADDRESS"),
      adapter: address(env, "DEX_ROUTER_ADDRESS"),
      keeper: address(env, "KEEPER_ADDRESS"),
      feeToken: address(env, "FEE_TOKEN_ADDRESS"),
      burnDestination: address(env, "BUYBACK_DESTINATION"),
      expectedOwner: address(env, "EXPECTED_MULTISIG_ADDRESS"),
      configurationDelay,
      quoteAmountWei,
      minimumExecutionAmount,
      maximumExecutionAmount,
      maximumSlippageBps,
    };
  }

  return config;
}

const asAddress = (value: unknown): Address => getAddress(String(value));
const asBigInt = (value: unknown): bigint => BigInt(String(value));

export async function readPonsV1ReadinessSnapshot(
  config: PonsV1ReadinessConfig,
): Promise<PonsV1ReadinessSnapshot> {
  const chain = defineChain({
    id: PONS_V1_CANONICAL.chainId,
    name: "Robinhood Chain",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: [config.rpcUrl] } },
  });
  const client = createPublicClient({
    chain,
    transport: http(config.rpcUrl, { timeout: 20_000, retryCount: 2 }),
  });
  const codeAddresses = {
    factory: config.factory,
    locker: config.locker,
    wrappedNative: config.wrappedNative,
    swapRouter: config.swapRouter,
    quoterV2: config.quoterV2,
    v3Factory: config.v3Factory,
    positionManager: config.positionManager,
  } as const;

  // Sample once, then pin every bytecode and contract read to the same block.
  const blockNumber = await client.getBlockNumber();
  const pinnedBlock = { blockNumber } as const;

  const [
    chainId,
    codeValues,
    factoryLocker,
    launchEnabled,
    launchFee,
    dexConfigCount,
    launchConfigCount,
    dex,
    launch,
    lockerFactory,
    routerFactory,
    routerWrappedNative,
    quoterFactory,
    quoterWrappedNative,
  ] = await Promise.all([
    client.getChainId(),
    Promise.all(
      Object.values(codeAddresses).map((value) =>
        client.getBytecode({ address: value, ...pinnedBlock }),
      ),
    ),
    client.readContract({ address: config.factory, abi: factoryAbi, functionName: "locker", ...pinnedBlock }),
    client.readContract({ address: config.factory, abi: factoryAbi, functionName: "launchEnabled", ...pinnedBlock }),
    client.readContract({ address: config.factory, abi: factoryAbi, functionName: "launchFee", ...pinnedBlock }),
    client.readContract({ address: config.factory, abi: factoryAbi, functionName: "dexConfigCount", ...pinnedBlock }),
    client.readContract({ address: config.factory, abi: factoryAbi, functionName: "launchConfigCount", ...pinnedBlock }),
    client.readContract({ address: config.factory, abi: factoryAbi, functionName: "getDexConfig", args: [config.dexConfigId], ...pinnedBlock }),
    client.readContract({ address: config.factory, abi: factoryAbi, functionName: "getLaunchConfig", args: [config.launchConfigId], ...pinnedBlock }),
    client.readContract({ address: config.locker, abi: lockerAbi, functionName: "factory", ...pinnedBlock }),
    client.readContract({ address: config.swapRouter, abi: peripheryAbi, functionName: "factory", ...pinnedBlock }),
    client.readContract({ address: config.swapRouter, abi: peripheryAbi, functionName: "WETH9", ...pinnedBlock }),
    client.readContract({ address: config.quoterV2, abi: peripheryAbi, functionName: "factory", ...pinnedBlock }),
    client.readContract({ address: config.quoterV2, abi: peripheryAbi, functionName: "WETH9", ...pinnedBlock }),
  ]);

  const code = Object.fromEntries(
    Object.keys(codeAddresses).map((key, index) => [key, Boolean(codeValues[index])]),
  ) as PonsV1ReadinessSnapshot["code"];

  const snapshot: PonsV1ReadinessSnapshot = {
    chainId,
    blockNumber,
    code,
    factory: {
      locker: asAddress(factoryLocker),
      launchEnabled,
      launchFee,
      dexConfigCount,
      launchConfigCount,
      dex: {
        name: dex.name,
        factory: asAddress(dex.factory),
        positionManager: asAddress(dex.positionManager),
        swapRouter: asAddress(dex.swapRouter),
        poolFee: asBigInt(dex.poolFee),
        tickSpacing: asBigInt(dex.tickSpacing),
        enabled: dex.enabled,
      },
      launch: {
        pairToken: asAddress(launch.pairToken),
        graduationThreshold: launch.graduationThreshold,
        initialTick: asBigInt(launch.initialTick),
        supply: launch.supply,
        maxWalletBps: asBigInt(launch.maxWalletBps),
        maxTxBps: asBigInt(launch.maxTxBps),
        restrictionBlocks: asBigInt(launch.restrictionBlocks),
        reservedFee: asBigInt(launch.reservedFee),
        enabled: launch.enabled,
        routerRequiresDeadline: launch.routerRequiresDeadline,
      },
    },
    lockerFactory: asAddress(lockerFactory),
    routerFactory: asAddress(routerFactory),
    routerWrappedNative: asAddress(routerWrappedNative),
    quoterFactory: asAddress(quoterFactory),
    quoterWrappedNative: asAddress(quoterWrappedNative),
  };

  if (config.integration) {
    const integration = config.integration;
    const [
      integrationCode,
      launched,
      tokenLiquidityPool,
      feeRedirect,
      collectorOwner,
      collectorPendingOwner,
      collectorConfigured,
      collectorWrappedNative,
      collectorLocker,
      collectorToken,
      collectorVault,
      collectorInterval,
      vaultOwner,
      vaultPendingOwner,
      vaultToken,
      vaultAdapter,
      vaultWrappedNative,
      vaultFeeToken,
      vaultBurnDestination,
      vaultKeeper,
      vaultMinimum,
      vaultMaximum,
      vaultSlippage,
      vaultInterval,
      vaultPaused,
      vaultTimelockEnabled,
      vaultConfigurationDelay,
      adapterRouter,
      adapterWrappedNative,
      adapterToken,
      adapterPoolFee,
    ] = await Promise.all([
      Promise.all(
        [
          integration.zazuToken,
          integration.collector,
          integration.vault,
          integration.adapter,
          integration.expectedOwner,
        ].map((value) => client.getBytecode({ address: value, ...pinnedBlock })),
      ),
      client.readContract({ address: config.factory, abi: factoryAbi, functionName: "getLaunchedToken", args: [integration.zazuToken], ...pinnedBlock }),
      client.readContract({ address: integration.zazuToken, abi: tokenAbi, functionName: "liquidityPool", ...pinnedBlock }),
      client.readContract({ address: config.locker, abi: lockerAbi, functionName: "feeRedirects", args: [integration.zazuToken], ...pinnedBlock }),
      client.readContract({ address: integration.collector, abi: collectorAbi, functionName: "owner", ...pinnedBlock }),
      client.readContract({ address: integration.collector, abi: collectorAbi, functionName: "pendingOwner", ...pinnedBlock }),
      client.readContract({ address: integration.collector, abi: collectorAbi, functionName: "configured", ...pinnedBlock }),
      client.readContract({ address: integration.collector, abi: collectorAbi, functionName: "wrappedNativeToken", ...pinnedBlock }),
      client.readContract({ address: integration.collector, abi: collectorAbi, functionName: "ponsLocker", ...pinnedBlock }),
      client.readContract({ address: integration.collector, abi: collectorAbi, functionName: "zazuToken", ...pinnedBlock }),
      client.readContract({ address: integration.collector, abi: collectorAbi, functionName: "buybackVault", ...pinnedBlock }),
      client.readContract({ address: integration.collector, abi: collectorAbi, functionName: "minimumClaimInterval", ...pinnedBlock }),
      client.readContract({ address: integration.vault, abi: vaultAbi, functionName: "owner", ...pinnedBlock }),
      client.readContract({ address: integration.vault, abi: vaultAbi, functionName: "pendingOwner", ...pinnedBlock }),
      client.readContract({ address: integration.vault, abi: vaultAbi, functionName: "zazuToken", ...pinnedBlock }),
      client.readContract({ address: integration.vault, abi: vaultAbi, functionName: "dexRouter", ...pinnedBlock }),
      client.readContract({ address: integration.vault, abi: vaultAbi, functionName: "wrappedNativeToken", ...pinnedBlock }),
      client.readContract({ address: integration.vault, abi: vaultAbi, functionName: "feeToken", ...pinnedBlock }),
      client.readContract({ address: integration.vault, abi: vaultAbi, functionName: "buybackDestination", ...pinnedBlock }),
      client.readContract({ address: integration.vault, abi: vaultAbi, functionName: "keeper", ...pinnedBlock }),
      client.readContract({ address: integration.vault, abi: vaultAbi, functionName: "minimumExecutionAmount", ...pinnedBlock }),
      client.readContract({ address: integration.vault, abi: vaultAbi, functionName: "maximumExecutionAmount", ...pinnedBlock }),
      client.readContract({ address: integration.vault, abi: vaultAbi, functionName: "maximumSlippageBps", ...pinnedBlock }),
      client.readContract({ address: integration.vault, abi: vaultAbi, functionName: "minimumInterval", ...pinnedBlock }),
      client.readContract({ address: integration.vault, abi: vaultAbi, functionName: "paused", ...pinnedBlock }),
      client.readContract({ address: integration.vault, abi: vaultAbi, functionName: "configurationTimelockEnabled", ...pinnedBlock }),
      client.readContract({ address: integration.vault, abi: vaultAbi, functionName: "configurationDelay", ...pinnedBlock }),
      client.readContract({ address: integration.adapter, abi: adapterAbi, functionName: "ponsSwapRouter", ...pinnedBlock }),
      client.readContract({ address: integration.adapter, abi: adapterAbi, functionName: "wrappedNativeToken", ...pinnedBlock }),
      client.readContract({ address: integration.adapter, abi: adapterAbi, functionName: "zazuToken", ...pinnedBlock }),
      client.readContract({ address: integration.adapter, abi: adapterAbi, functionName: "poolFee", ...pinnedBlock }),
    ]);

    const pool = asAddress(tokenLiquidityPool);
    if (pool === getAddress(PONS_V1_CANONICAL.zeroAddress)) {
      throw new Error("ZAZU token liquidityPool() returned the zero address");
    }

    const [poolCode, factoryPool, poolToken0, poolToken1, poolFee, poolLiquidity, slot0, quote] =
      await Promise.all([
        client.getBytecode({ address: pool, ...pinnedBlock }),
        client.readContract({
          address: config.v3Factory,
          abi: v3FactoryAbi,
          functionName: "getPool",
          args: [config.wrappedNative, integration.zazuToken, Number(config.poolFee)],
          ...pinnedBlock,
        }),
        client.readContract({ address: pool, abi: poolAbi, functionName: "token0", ...pinnedBlock }),
        client.readContract({ address: pool, abi: poolAbi, functionName: "token1", ...pinnedBlock }),
        client.readContract({ address: pool, abi: poolAbi, functionName: "fee", ...pinnedBlock }),
        client.readContract({ address: pool, abi: poolAbi, functionName: "liquidity", ...pinnedBlock }),
        client.readContract({ address: pool, abi: poolAbi, functionName: "slot0", ...pinnedBlock }),
        client.simulateContract({
          address: config.quoterV2,
          abi: quoterAbi,
          functionName: "quoteExactInputSingle",
          args: [
            {
              tokenIn: config.wrappedNative,
              tokenOut: integration.zazuToken,
              amountIn: integration.quoteAmountWei,
              fee: Number(config.poolFee),
              sqrtPriceLimitX96: 0n,
            },
          ],
          ...pinnedBlock,
        }),
      ]);

    snapshot.integration = {
      code: {
        zazuToken: Boolean(integrationCode[0]),
        collector: Boolean(integrationCode[1]),
        vault: Boolean(integrationCode[2]),
        adapter: Boolean(integrationCode[3]),
        ownerContract: Boolean(integrationCode[4]),
      },
      launch: {
        token: asAddress(launched.token),
        pairedToken: asAddress(launched.pairedToken),
        positionManager: asAddress(launched.positionManager),
        dexId: launched.dexId,
        launchConfigId: launched.launchConfigId,
        poolFee: asBigInt(launched.poolFee),
        exists: launched.exists,
      },
      feeRedirect: asAddress(feeRedirect),
      collector: {
        owner: asAddress(collectorOwner),
        pendingOwner: asAddress(collectorPendingOwner),
        configured: collectorConfigured,
        wrappedNative: asAddress(collectorWrappedNative),
        locker: asAddress(collectorLocker),
        zazuToken: asAddress(collectorToken),
        vault: asAddress(collectorVault),
        minimumClaimInterval: collectorInterval,
      },
      vault: {
        owner: asAddress(vaultOwner),
        pendingOwner: asAddress(vaultPendingOwner),
        zazuToken: asAddress(vaultToken),
        adapter: asAddress(vaultAdapter),
        wrappedNative: asAddress(vaultWrappedNative),
        feeToken: asAddress(vaultFeeToken),
        burnDestination: asAddress(vaultBurnDestination),
        keeper: asAddress(vaultKeeper),
        minimumExecutionAmount: vaultMinimum,
        maximumExecutionAmount: vaultMaximum,
        maximumSlippageBps: vaultSlippage,
        minimumInterval: vaultInterval,
        paused: vaultPaused,
        configurationTimelockEnabled: vaultTimelockEnabled,
        configurationDelay: asBigInt(vaultConfigurationDelay),
      },
      adapter: {
        swapRouter: asAddress(adapterRouter),
        wrappedNative: asAddress(adapterWrappedNative),
        zazuToken: asAddress(adapterToken),
        poolFee: asBigInt(adapterPoolFee),
      },
      quoteRoute: {
        tokenLiquidityPool: pool,
        factoryPool: asAddress(factoryPool),
        poolCode: Boolean(poolCode),
        quoterCode: snapshot.code.quoterV2,
        token0: asAddress(poolToken0),
        token1: asAddress(poolToken1),
        poolFee: asBigInt(poolFee),
        sqrtPriceX96: asBigInt(slot0[0]),
        liquidity: asBigInt(poolLiquidity),
        unlocked: slot0[6],
        quoteAmountIn: integration.quoteAmountWei,
        quoteAmountOut: asBigInt(quote.result[0]),
      },
    };
  }

  return snapshot;
}

const printable = (value: unknown): PublicValue => {
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  return value === null || value === undefined ? null : String(value);
};

export function evaluatePonsV1Readiness(
  config: PonsV1ReadinessConfig,
  snapshot: PonsV1ReadinessSnapshot,
  generatedAt = new Date().toISOString(),
): PonsV1ReadinessReport {
  const checks: ReadinessCheck[] = [];
  const equal = (id: string, expected: unknown, actual: unknown) => {
    const expectedValue = printable(expected);
    const actualValue = printable(actual);
    checks.push({
      id,
      status: expectedValue === actualValue ? "pass" : "fail",
      expected: expectedValue,
      actual: actualValue,
    });
  };

  equal("chain.id", PONS_V1_CANONICAL.chainId, snapshot.chainId);
  for (const key of ["factory", "locker", "wrappedNative", "swapRouter", "quoterV2", "v3Factory", "positionManager"] as const) {
    equal(`pins.${key}`, PONS_V1_CANONICAL[key], config[key]);
    equal(`code.${key}`, true, snapshot.code[key]);
  }
  equal("factory.locker", config.locker, snapshot.factory.locker);
  equal("locker.factory", config.factory, snapshot.lockerFactory);
  equal("factory.launchEnabled", true, snapshot.factory.launchEnabled);
  equal("factory.launchFeeWei", config.launchFeeWei, snapshot.factory.launchFee);
  equal("factory.dexConfigCount", config.expectedDexConfigCount, snapshot.factory.dexConfigCount);
  equal("factory.launchConfigCount", config.expectedLaunchConfigCount, snapshot.factory.launchConfigCount);
  equal("dex.name", config.dexName, snapshot.factory.dex.name);
  equal("dex.factory", config.v3Factory, snapshot.factory.dex.factory);
  equal("dex.positionManager", config.positionManager, snapshot.factory.dex.positionManager);
  equal("dex.swapRouter", config.swapRouter, snapshot.factory.dex.swapRouter);
  equal("dex.poolFee", config.poolFee, snapshot.factory.dex.poolFee);
  equal("dex.tickSpacing", config.tickSpacing, snapshot.factory.dex.tickSpacing);
  equal("dex.enabled", true, snapshot.factory.dex.enabled);
  equal("launch.pairToken", config.wrappedNative, snapshot.factory.launch.pairToken);
  equal("launch.graduationThreshold", config.graduationThreshold, snapshot.factory.launch.graduationThreshold);
  equal("launch.initialTick", config.initialTick, snapshot.factory.launch.initialTick);
  equal("launch.supply", config.supply, snapshot.factory.launch.supply);
  equal("launch.maxWalletBps", config.maxWalletBps, snapshot.factory.launch.maxWalletBps);
  equal("launch.maxTxBps", config.maxTxBps, snapshot.factory.launch.maxTxBps);
  equal("launch.restrictionBlocks", config.restrictionBlocks, snapshot.factory.launch.restrictionBlocks);
  equal("launch.reservedFee", config.reservedFee, snapshot.factory.launch.reservedFee);
  equal("launch.enabled", true, snapshot.factory.launch.enabled);
  equal("launch.routerRequiresDeadline", config.routerRequiresDeadline, snapshot.factory.launch.routerRequiresDeadline);
  equal("router.factory", config.v3Factory, snapshot.routerFactory);
  equal("router.wrappedNative", config.wrappedNative, snapshot.routerWrappedNative);
  equal("quoter.factory", config.v3Factory, snapshot.quoterFactory);
  equal("quoter.wrappedNative", config.wrappedNative, snapshot.quoterWrappedNative);

  if (config.integration && snapshot.integration) {
    const expected = config.integration;
    const actual = snapshot.integration;
    for (const key of ["zazuToken", "collector", "vault", "adapter", "ownerContract"] as const) {
      equal(`integration.code.${key}`, true, actual.code[key]);
    }
    equal("integration.launch.exists", true, actual.launch.exists);
    equal("integration.launch.token", expected.zazuToken, actual.launch.token);
    equal("integration.launch.pairedToken", config.wrappedNative, actual.launch.pairedToken);
    equal("integration.launch.positionManager", config.positionManager, actual.launch.positionManager);
    equal("integration.launch.dexId", config.dexConfigId, actual.launch.dexId);
    equal("integration.launch.launchConfigId", config.launchConfigId, actual.launch.launchConfigId);
    equal("integration.launch.poolFee", config.poolFee, actual.launch.poolFee);
    equal("integration.feeRedirect", expected.collector, actual.feeRedirect);
    equal("collector.owner", expected.expectedOwner, actual.collector.owner);
    equal("collector.pendingOwner", PONS_V1_CANONICAL.zeroAddress, actual.collector.pendingOwner);
    equal("collector.configured", true, actual.collector.configured);
    equal("collector.wrappedNative", config.wrappedNative, actual.collector.wrappedNative);
    equal("collector.locker", config.locker, actual.collector.locker);
    equal("collector.zazuToken", expected.zazuToken, actual.collector.zazuToken);
    equal("collector.vault", expected.vault, actual.collector.vault);
    equal("collector.minimumClaimInterval", config.minimumInterval, actual.collector.minimumClaimInterval);
    equal("vault.owner", expected.expectedOwner, actual.vault.owner);
    equal("vault.pendingOwner", PONS_V1_CANONICAL.zeroAddress, actual.vault.pendingOwner);
    equal("vault.zazuToken", expected.zazuToken, actual.vault.zazuToken);
    equal("vault.adapter", expected.adapter, actual.vault.adapter);
    equal("vault.wrappedNative", config.wrappedNative, actual.vault.wrappedNative);
    equal("vault.feeToken", expected.feeToken, actual.vault.feeToken);
    equal("vault.burnDestination", expected.burnDestination, actual.vault.burnDestination);
    equal("vault.canonicalBurnDestination", PONS_V1_CANONICAL.burnDestination, actual.vault.burnDestination);
    equal("vault.keeper", expected.keeper, actual.vault.keeper);
    equal("vault.minimumExecutionAmount", expected.minimumExecutionAmount, actual.vault.minimumExecutionAmount);
    equal("vault.maximumExecutionAmount", expected.maximumExecutionAmount, actual.vault.maximumExecutionAmount);
    equal("vault.maximumSlippageBps", expected.maximumSlippageBps, actual.vault.maximumSlippageBps);
    equal("vault.minimumInterval", config.minimumInterval, actual.vault.minimumInterval);
    equal("vault.paused", false, actual.vault.paused);
    equal("vault.configurationTimelockEnabled", true, actual.vault.configurationTimelockEnabled);
    equal("vault.configurationDelay", expected.configurationDelay, actual.vault.configurationDelay);
    equal("adapter.swapRouter", config.swapRouter, actual.adapter.swapRouter);
    equal("adapter.wrappedNative", config.wrappedNative, actual.adapter.wrappedNative);
    equal("adapter.zazuToken", expected.zazuToken, actual.adapter.zazuToken);
    equal("adapter.poolFee", config.poolFee, actual.adapter.poolFee);
    const expectedPair = [config.wrappedNative, expected.zazuToken].sort((left, right) =>
      left.toLowerCase().localeCompare(right.toLowerCase()),
    );
    const actualPair = [actual.quoteRoute.token0, actual.quoteRoute.token1].sort((left, right) =>
      left.toLowerCase().localeCompare(right.toLowerCase()),
    );
    equal("quoteRoute.tokenLiquidityPool.nonzero", false, actual.quoteRoute.tokenLiquidityPool === PONS_V1_CANONICAL.zeroAddress);
    equal("quoteRoute.factoryPool", actual.quoteRoute.tokenLiquidityPool, actual.quoteRoute.factoryPool);
    equal("quoteRoute.poolCode", true, actual.quoteRoute.poolCode);
    equal("quoteRoute.quoterCode", true, actual.quoteRoute.quoterCode);
    equal("quoteRoute.token0", expectedPair[0], actualPair[0]);
    equal("quoteRoute.token1", expectedPair[1], actualPair[1]);
    equal("quoteRoute.poolFee", config.poolFee, actual.quoteRoute.poolFee);
    equal("quoteRoute.sqrtPriceX96.positive", true, actual.quoteRoute.sqrtPriceX96 > 0n);
    equal("quoteRoute.liquidity.positive", true, actual.quoteRoute.liquidity > 0n);
    equal("quoteRoute.unlocked", true, actual.quoteRoute.unlocked);
    equal("quoteRoute.quoteAmountIn", expected.quoteAmountWei, actual.quoteRoute.quoteAmountIn);
    equal("quoteRoute.quoteAmountOut.positive", true, actual.quoteRoute.quoteAmountOut > 0n);
  } else if (config.integration) {
    checks.push({
      id: "integration.snapshot",
      status: "fail",
      expected: "present",
      actual: "missing",
    });
  } else {
    checks.push({ id: "integration", status: "skip", actual: "not configured" });
  }

  const summary = {
    passed: checks.filter((check) => check.status === "pass").length,
    failed: checks.filter((check) => check.status === "fail").length,
    skipped: checks.filter((check) => check.status === "skip").length,
  };
  return {
    schemaVersion: 1,
    generatedAt,
    readOnly: true,
    ok: summary.failed === 0,
    network: { chainId: snapshot.chainId, blockNumber: snapshot.blockNumber.toString() },
    integrationEnabled: Boolean(config.integration),
    trustNotice: VAULT_TRUST_NOTICE,
    summary,
    checks,
  };
}

export function sanitizeReadinessDiagnostic(error: unknown): string {
  const candidate =
    error && typeof error === "object" && "shortMessage" in error
      ? String((error as { shortMessage?: unknown }).shortMessage ?? "Readiness verification failed")
      : error instanceof Error
        ? error.message
        : "Readiness verification failed";
  return candidate
    .replace(/https?:\/\/[^\s"']+/gi, "[redacted-url]")
    .replace(/0x[0-9a-fA-F]{64}/g, "[redacted-hex]")
    .slice(0, 500);
}
