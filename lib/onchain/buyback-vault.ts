export const BUYBACK_VAULT_SELECTORS = {
  feeToken: "0x647846a5",
  zazuToken: "0x84fc7910",
  buybackDestination: "0xc563127c",
  minimumInterval: "0x51cfaf73",
  lastExecutionTime: "0x73b379bd",
  executionCount: "0xa17ecef3",
  totalInputSpent: "0x342ffc90",
  totalZazuBought: "0xd8b6eb7a",
  totalZazuBurned: "0x22a2cefd",
} as const;

export const ERC20_SELECTORS = {
  balanceOf: "0x70a08231",
  decimals: "0x313ce567",
  symbol: "0x95d89b41",
} as const;

export const BUYBACK_EXECUTED_TOPIC =
  "0x4ff168e44814be9a5767d8eeafd5dee7e655804ba7ffa0fc59b2237d0b820385";

export const DIRECT_ZAZU_BURNED_TOPIC =
  "0x7de22f771e903cdab0d82b7fae12ccc3794eda66af490c9f315b4c7c1c799fb6";

export const CREATOR_FEES_FORWARDED_TOPIC =
  "0xaa330b55610f73593b7470d1932f2523ccc17286e023c6ec532d595cc6a2acd5";

export const PONS_FEE_COLLECTOR_SELECTORS = {
  claimAndFlush: "0x10f3e19d",
  configured: "0x8772a23a",
  flush: "0x6b9f96ea",
  zazuToken: "0x84fc7910",
  buybackVault: "0xf1f5c993",
  minimumClaimInterval: "0xcf33fce6",
} as const;

export const CANONICAL_BURN_ADDRESS =
  "0x000000000000000000000000000000000000dead";

export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
