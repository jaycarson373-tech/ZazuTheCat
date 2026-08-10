// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Test, console2 } from "forge-std/Test.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { BuybackVault } from "../src/BuybackVault.sol";
import { PonsFeeCollector } from "../src/PonsFeeCollector.sol";
import { PonsV3Adapter } from "../src/PonsV3Adapter.sol";

interface IWeth is IERC20 {
    function deposit() external payable;
}

interface IPonsV1Factory {
    struct Socials {
        string twitter;
        string telegram;
        string discord;
        string website;
        string farcaster;
    }

    struct TokenParams {
        string name;
        string symbol;
        string logo;
        string description;
        Socials socials;
        address feeWallet;
    }

    struct DexConfig {
        string name;
        address factory;
        address positionManager;
        address swapRouter;
        uint24 poolFee;
        int24 tickSpacing;
        bool enabled;
    }

    struct LaunchConfig {
        address pairToken;
        uint256 graduationThreshold;
        int24 initialTick;
        uint256 supply;
        uint16 maxWalletBps;
        uint16 maxTxBps;
        uint32 restrictionBlocks;
        uint24 reservedFee;
        bool enabled;
        bool routerRequiresDeadline;
    }

    struct LaunchedToken {
        address token;
        address deployer;
        address pairedToken;
        address positionManager;
        uint256 positionId;
        uint256 dexId;
        uint256 launchConfigId;
        uint256 restrictionsEndBlock;
        uint256 supply;
        bool isToken0;
        uint24 poolFee;
        bool exists;
        uint256 initialBuyAmount;
    }

    function launchEnabled() external view returns (bool);
    function launchFee() external view returns (uint256);
    function getDexConfig(uint256 id) external view returns (DexConfig memory);
    function getLaunchConfig(uint256 id) external view returns (LaunchConfig memory);
    function getLaunchedToken(address token) external view returns (LaunchedToken memory);

    function predictTokenAddress(
        TokenParams calldata params,
        uint256 launchConfigId,
        uint256 dexId,
        bytes32 salt,
        address tokenDeployer
    ) external view returns (address token);

    function launchToken(
        TokenParams calldata params,
        uint256 launchConfigId,
        uint256 dexId,
        bytes32 salt
    ) external payable returns (address token);
}

interface IPonsV1LockerView {
    function feeRedirects(address token) external view returns (address);
}

interface IPonsV1LaunchedTokenView {
    function liquidityPool() external view returns (address);
}

interface IPonsV3PoolView {
    function token0() external view returns (address);
    function token1() external view returns (address);
}

interface ISwapRouter02 {
    struct ExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24 fee;
        address recipient;
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
    }

    function exactInputSingle(ExactInputSingleParams calldata params)
        external
        payable
        returns (uint256 amountOut);
}

interface IQuoterV2 {
    struct QuoteExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        uint256 amountIn;
        uint24 fee;
        uint160 sqrtPriceLimitX96;
    }

    function quoteExactInputSingle(QuoteExactInputSingleParams calldata params)
        external
        returns (
            uint256 amountOut,
            uint160 sqrtPriceX96After,
            uint32 initializedTicksCrossed,
            uint256 gasEstimate
        );
}

/// @notice Opt-in integration test against a local fork of live Robinhood Chain state.
/// @dev Nothing is broadcast. Run with:
/// RUN_PONS_V1_FORK_TEST=true ROBINHOOD_RPC_URL=https://rpc.mainnet.chain.robinhood.com \
///   forge test --match-contract PonsV1ForkTest -vv
contract PonsV1ForkTest is Test {
    address internal constant PONS_V1_FACTORY = 0xA5aAb3F0c6EeadF30Ef1D3Eb997108E976351feB;
    address internal constant PONS_V1_LOCKER = 0x736D76699C26D0d966744cAe304C000d471f7F35;
    address internal constant PONS_SWAP_ROUTER = 0xCaf681a66D020601342297493863E78C959E5cb2;
    address internal constant PONS_QUOTER = 0x33e885eD0Ec9bF04EcfB19341582aADCb4c8A9E7;
    address internal constant WETH = 0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73;
    address internal constant BURN_ADDRESS = 0x000000000000000000000000000000000000dEaD;

    uint256 internal constant LAUNCH_CONFIG_ID = 0;
    uint256 internal constant DEX_ID = 0;
    uint256 internal constant DEFAULT_FORK_BLOCK = 28_702_466;
    uint24 internal constant POOL_FEE = 10_000;
    uint256 internal constant TRADE_SIZE = 0.01 ether;

    address internal keeper = makeAddr("keeper");
    address internal trader = makeAddr("trader");

    function testFork_LaunchClaimBuybackAndBurn() public {
        if (!vm.envOr("RUN_PONS_V1_FORK_TEST", false)) {
            vm.skip(true, "set RUN_PONS_V1_FORK_TEST=true to run the Robinhood fork canary");
        }

        vm.createSelectFork(
            vm.envString("ROBINHOOD_RPC_URL"), vm.envOr("PONS_FORK_BLOCK", DEFAULT_FORK_BLOCK)
        );
        assertEq(block.chainid, 4663, "wrong fork chain");

        IPonsV1Factory factory = IPonsV1Factory(PONS_V1_FACTORY);
        assertTrue(factory.launchEnabled(), "Pons V1 public launches are disabled");

        IPonsV1Factory.DexConfig memory dex = factory.getDexConfig(DEX_ID);
        IPonsV1Factory.LaunchConfig memory launch = factory.getLaunchConfig(LAUNCH_CONFIG_ID);
        assertTrue(dex.enabled, "Pons V1 DEX config is disabled");
        assertTrue(launch.enabled, "Pons V1 launch config is disabled");
        assertEq(dex.swapRouter, PONS_SWAP_ROUTER, "unexpected live swap router");
        assertEq(dex.poolFee, POOL_FEE, "unexpected live pool fee");
        assertEq(launch.pairToken, WETH, "unexpected live pair token");
        assertFalse(launch.routerRequiresDeadline, "adapter expects SwapRouter02");

        PonsFeeCollector collector = new PonsFeeCollector(address(this), WETH, PONS_V1_LOCKER);
        IPonsV1Factory.TokenParams memory params = _tokenParams(address(collector));

        bytes32 deploySalt = keccak256("zazu-v1-fork-canary");
        address predictedToken = factory.predictTokenAddress(
            params, LAUNCH_CONFIG_ID, DEX_ID, deploySalt, address(this)
        );

        uint256 launchFee = factory.launchFee();
        vm.deal(address(this), launchFee);
        address token =
            factory.launchToken{ value: launchFee }(params, LAUNCH_CONFIG_ID, DEX_ID, deploySalt);

        assertEq(token, predictedToken, "CREATE2 prediction mismatch");
        assertGt(token.code.length, 0, "launched token has no code");
        assertEq(
            IPonsV1LockerView(PONS_V1_LOCKER).feeRedirects(token),
            address(collector),
            "creator fee redirect mismatch"
        );

        IPonsV1Factory.LaunchedToken memory record = factory.getLaunchedToken(token);
        assertTrue(record.exists, "factory launch record missing");
        assertEq(record.deployer, address(this), "wrong token deployer");
        assertEq(record.pairedToken, WETH, "wrong launched-token pair");
        assertEq(record.poolFee, POOL_FEE, "wrong launched-token pool fee");

        address pool = IPonsV1LaunchedTokenView(token).liquidityPool();
        assertTrue(pool != address(0), "launched token returned zero liquidity pool");
        assertGt(pool.code.length, 0, "launched token liquidity pool has no code");
        assertEq(
            IPonsV3PoolView(pool).token0(), record.isToken0 ? token : WETH, "wrong live pool token0"
        );
        assertEq(
            IPonsV3PoolView(pool).token1(), record.isToken0 ? WETH : token, "wrong live pool token1"
        );

        PonsV3Adapter adapter = new PonsV3Adapter(PONS_SWAP_ROUTER, WETH, token, POOL_FEE);
        BuybackVault vault = new BuybackVault(
            address(this),
            token,
            address(adapter),
            WETH,
            WETH,
            BURN_ADDRESS,
            keeper,
            1,
            1 ether,
            500
        );
        collector.configure(token, address(vault));

        vm.roll(record.restrictionsEndBlock + 1);
        uint256 supplyBefore = IERC20(token).totalSupply();
        uint256 tokensBought = _buyThroughProductionAdapter(adapter, token);
        uint256 wethReturned = _sellThroughLiveRouter(token, tokensBought / 2);
        assertGt(wethReturned, 0, "live router sell returned no WETH");

        uint256 burnBeforeClaim = IERC20(token).balanceOf(BURN_ADDRESS);
        vm.warp(collector.lastClaimTime() + collector.minimumClaimInterval());
        vm.prank(keeper);
        (uint256 claimedWeth, uint256 claimedToken) = collector.claimAndFlush();
        assertGt(claimedWeth, 0, "no WETH creator fees claimed");
        assertGt(claimedToken, 0, "no token-side creator fees claimed");
        assertEq(IERC20(WETH).balanceOf(address(vault)), claimedWeth, "WETH not forwarded");
        assertEq(vault.totalDeposited(), claimedWeth, "WETH accounting not synced");
        assertEq(
            IERC20(token).balanceOf(BURN_ADDRESS) - burnBeforeClaim,
            claimedToken,
            "token-side fees were not burned"
        );

        uint256 burnBeforeBuyback = IERC20(token).balanceOf(BURN_ADDRESS);
        uint256 minimumBuybackOut = _minimumOut(_quote(WETH, token, claimedWeth));
        vm.prank(keeper);
        vault.executeBuyback(claimedWeth, minimumBuybackOut, bytes(""));

        uint256 boughtAndBurned = IERC20(token).balanceOf(BURN_ADDRESS) - burnBeforeBuyback;
        assertGt(boughtAndBurned, 0, "buyback produced no burned tokens");
        assertEq(vault.executionCount(), 1, "buyback execution not counted");
        assertEq(vault.totalInputSpent(), claimedWeth, "wrong buyback input accounting");
        assertEq(vault.totalZazuBought(), boughtAndBurned, "wrong buyback output accounting");
        assertEq(
            vault.totalZazuBurned(), claimedToken + boughtAndBurned, "wrong total burn accounting"
        );
        assertEq(IERC20(WETH).balanceOf(address(vault)), 0, "claimed WETH remains in vault");
        assertEq(IERC20(token).totalSupply(), supplyBefore, "dead-address burn changed supply");

        console2.log("fork block", block.number);
        console2.log("disposable token", token);
        console2.log("creator WETH claimed", claimedWeth);
        console2.log("creator token fees burned", claimedToken);
        console2.log("buyback tokens burned", boughtAndBurned);
        console2.log("total tokens at dead address", IERC20(token).balanceOf(BURN_ADDRESS));
    }

    function _buyThroughProductionAdapter(PonsV3Adapter adapter, address token)
        internal
        returns (uint256 amountOut)
    {
        vm.deal(trader, TRADE_SIZE);
        vm.startPrank(trader);
        IWeth(WETH).deposit{ value: TRADE_SIZE }();
        IERC20(WETH).approve(address(adapter), TRADE_SIZE);
        uint256 minimumOut = _minimumOut(_quote(WETH, token, TRADE_SIZE));
        amountOut = adapter.swap(WETH, token, TRADE_SIZE, minimumOut, trader, bytes(""));
        vm.stopPrank();
        assertGe(amountOut, minimumOut, "live adapter buy missed quote bound");
    }

    function _sellThroughLiveRouter(address token, uint256 amountIn)
        internal
        returns (uint256 amountOut)
    {
        assertGt(amountIn, 0, "zero sell amount");
        vm.startPrank(trader);
        IERC20(token).approve(PONS_SWAP_ROUTER, amountIn);
        uint256 minimumOut = _minimumOut(_quote(token, WETH, amountIn));
        amountOut = ISwapRouter02(PONS_SWAP_ROUTER)
            .exactInputSingle(
                ISwapRouter02.ExactInputSingleParams({
                tokenIn: token,
                tokenOut: WETH,
                fee: POOL_FEE,
                recipient: trader,
                amountIn: amountIn,
                amountOutMinimum: minimumOut,
                sqrtPriceLimitX96: 0
            })
            );
        vm.stopPrank();
        assertGe(amountOut, minimumOut, "live router sell missed quote bound");
    }

    function _quote(address tokenIn, address tokenOut, uint256 amountIn)
        internal
        returns (uint256 amountOut)
    {
        (amountOut,,,) = IQuoterV2(PONS_QUOTER)
            .quoteExactInputSingle(
                IQuoterV2.QuoteExactInputSingleParams({
                tokenIn: tokenIn,
                tokenOut: tokenOut,
                amountIn: amountIn,
                fee: POOL_FEE,
                sqrtPriceLimitX96: 0
            })
            );
        assertGt(amountOut, 0, "live quoter returned zero");
    }

    function _minimumOut(uint256 quotedOut) internal pure returns (uint256) {
        return quotedOut * 9500 / 10_000;
    }

    function _tokenParams(address feeWallet)
        internal
        pure
        returns (IPonsV1Factory.TokenParams memory)
    {
        return IPonsV1Factory.TokenParams({
            name: "Zazu Fork Canary",
            symbol: "ZCANARY",
            logo: "ipfs://fork-only",
            description: "Disposable token created only inside a Robinhood mainnet fork.",
            socials: IPonsV1Factory.Socials({
                twitter: "", telegram: "", discord: "", website: "", farcaster: ""
            }),
            feeWallet: feeWallet
        });
    }
}
