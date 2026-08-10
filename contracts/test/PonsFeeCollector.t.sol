// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Test, Vm } from "forge-std/Test.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { BuybackVault } from "../src/BuybackVault.sol";
import { PonsFeeCollector } from "../src/PonsFeeCollector.sol";
import { MockERC20 } from "./mocks/MockERC20.sol";
import { MockPonsLaunchLocker } from "./mocks/MockPonsLaunchLocker.sol";
import { MockRouter } from "./mocks/MockRouter.sol";

contract WrongIntervalVault {
    MockERC20 public immutable zazuToken;
    address public immutable feeToken;
    address public immutable buybackDestination;
    uint256 public constant minimumInterval = 1 minutes;

    constructor(MockERC20 zazuToken_, address feeToken_, address buybackDestination_) {
        zazuToken = zazuToken_;
        feeToken = feeToken_;
        buybackDestination = buybackDestination_;
    }
}

contract PonsFeeCollectorTest is Test {
    address internal constant BURN_ADDRESS = 0x000000000000000000000000000000000000dEaD;

    event CollectorConfigured(address indexed zazuToken, address indexed buybackVault);
    event CreatorFeesForwarded(uint256 wrappedNativeAmount, uint256 zazuAmount);

    address internal owner = makeAddr("owner");
    address internal keeper = makeAddr("keeper");
    address internal caller = makeAddr("permissionlessCaller");

    MockERC20 internal weth;
    MockERC20 internal zazu;
    MockRouter internal router;
    MockPonsLaunchLocker internal ponsLocker;
    BuybackVault internal vault;
    PonsFeeCollector internal collector;

    function setUp() public {
        vm.warp(30 days);
        weth = new MockERC20("Wrapped Ether", "WETH");
        zazu = new MockERC20("Zazu", "ZAZU");
        router = new MockRouter();
        ponsLocker = new MockPonsLaunchLocker(address(weth));
        vault = _newVault(address(zazu), address(weth), BURN_ADDRESS);
        collector = new PonsFeeCollector(owner, address(weth), address(ponsLocker));
        ponsLocker.setFeeRedirect(address(zazu), address(collector));

        vm.expectEmit(true, true, false, true, address(collector));
        emit CollectorConfigured(address(zazu), address(vault));
        vm.prank(owner);
        collector.configure(address(zazu), address(vault));
    }

    function testConfigurePinsValidatedTokenVaultAndBurnDestination() public view {
        assertTrue(collector.configured());
        assertEq(address(collector.wrappedNativeToken()), address(weth));
        assertEq(address(collector.ponsLocker()), address(ponsLocker));
        assertEq(address(collector.zazuToken()), address(zazu));
        assertEq(address(collector.buybackVault()), address(vault));
        assertEq(collector.minimumClaimInterval(), 15 minutes);
        assertEq(collector.lastClaimTime(), block.timestamp);
    }

    function testFlushIsPermissionlessAndForwardsBothCreatorFeeAssets() public {
        uint256 wethAmount = 4 ether;
        uint256 zazuAmount = 750 ether;
        weth.mint(address(collector), wethAmount);
        zazu.mint(address(collector), zazuAmount);

        vm.expectEmit(false, false, false, true, address(collector));
        emit CreatorFeesForwarded(wethAmount, zazuAmount);
        vm.prank(caller);
        (uint256 forwardedWeth, uint256 forwardedZazu) = collector.flush();

        assertEq(forwardedWeth, wethAmount);
        assertEq(forwardedZazu, zazuAmount);
        assertEq(weth.balanceOf(address(collector)), 0);
        assertEq(zazu.balanceOf(address(collector)), 0);
        assertEq(weth.balanceOf(address(vault)), wethAmount);
        assertEq(vault.totalDeposited(), wethAmount);
        assertEq(zazu.balanceOf(vault.DEFAULT_BURN_ADDRESS()), zazuAmount);
        assertEq(zazu.balanceOf(address(vault)), 0);
        assertEq(vault.totalZazuBought(), 0);
        assertEq(vault.totalZazuBurned(), zazuAmount);
    }

    function testFlushWrappedNativeOnlySyncsTreasuryAccounting() public {
        weth.mint(address(collector), 3 ether);

        vm.prank(caller);
        (uint256 forwardedWeth, uint256 forwardedZazu) = collector.flush();

        assertEq(forwardedWeth, 3 ether);
        assertEq(forwardedZazu, 0);
        assertEq(weth.balanceOf(address(vault)), 3 ether);
        assertEq(vault.totalDeposited(), 3 ether);
        assertEq(vault.totalZazuBurned(), 0);
    }

    function testFlushZazuOnlyBurnsWithoutChangingBuybackAccounting() public {
        zazu.mint(address(collector), 99 ether);

        vm.prank(caller);
        (uint256 forwardedWeth, uint256 forwardedZazu) = collector.flush();

        assertEq(forwardedWeth, 0);
        assertEq(forwardedZazu, 99 ether);
        assertEq(vault.totalDeposited(), 0);
        assertEq(vault.totalInputSpent(), 0);
        assertEq(vault.totalZazuBought(), 0);
        assertEq(vault.totalZazuBurned(), 99 ether);
    }

    function testEmptyFlushIsSafeAndReturnsZero() public {
        vm.recordLogs();
        vm.prank(caller);
        (uint256 forwardedWeth, uint256 forwardedZazu) = collector.flush();
        Vm.Log[] memory logs = vm.getRecordedLogs();

        assertEq(forwardedWeth, 0);
        assertEq(forwardedZazu, 0);
        assertEq(logs.length, 0);
    }

    function testClaimAndFlushCollectsLockerFeesBeforeForwarding() public {
        uint256 wethAmount = 2 ether;
        uint256 zazuAmount = 400 ether;
        weth.mint(address(ponsLocker), wethAmount);
        zazu.mint(address(ponsLocker), zazuAmount);
        ponsLocker.setClaimAmounts(wethAmount, zazuAmount);

        _openClaimWindow();
        uint256 expectedClaimTime = block.timestamp;
        vm.prank(keeper);
        (uint256 forwardedWeth, uint256 forwardedZazu) = collector.claimAndFlush();

        assertEq(ponsLocker.collectCallCount(), 1);
        assertEq(forwardedWeth, wethAmount);
        assertEq(forwardedZazu, zazuAmount);
        assertEq(vault.totalDeposited(), wethAmount);
        assertEq(vault.totalZazuBurned(), zazuAmount);
        assertEq(zazu.balanceOf(vault.DEFAULT_BURN_ADDRESS()), zazuAmount);
        assertEq(collector.lastClaimTime(), expectedClaimTime);
    }

    function testClaimAndFlushToleratesOnlyNoFeesErrorAndFlushesExistingBalances() public {
        weth.mint(address(collector), 1 ether);
        ponsLocker.setShouldReportNoFees(true);

        _openClaimWindow();
        vm.prank(keeper);
        (uint256 forwardedWeth, uint256 forwardedZazu) = collector.claimAndFlush();

        assertEq(forwardedWeth, 1 ether);
        assertEq(forwardedZazu, 0);
        assertEq(vault.totalDeposited(), 1 ether);
        assertEq(ponsLocker.collectCallCount(), 0);
    }

    function testClaimAndFlushBubblesUnexpectedLockerFailure() public {
        weth.mint(address(collector), 1 ether);
        ponsLocker.setShouldRevert(true);

        _openClaimWindow();
        vm.prank(keeper);
        vm.expectRevert(MockPonsLaunchLocker.CollectFailed.selector);
        collector.claimAndFlush();

        assertEq(weth.balanceOf(address(collector)), 1 ether);
        assertEq(weth.balanceOf(address(vault)), 0);
        assertEq(vault.totalDeposited(), 0);
    }

    function testClaimAndFlushRejectsNonKeeper() public {
        uint256 wethAmount = 1 ether;
        weth.mint(address(ponsLocker), wethAmount);
        ponsLocker.setClaimAmounts(wethAmount, 0);
        _openClaimWindow();

        vm.prank(caller);
        vm.expectRevert(
            abi.encodeWithSelector(PonsFeeCollector.UnauthorizedKeeper.selector, caller, keeper)
        );
        collector.claimAndFlush();

        assertEq(ponsLocker.collectCallCount(), 0);
        assertEq(weth.balanceOf(address(vault)), 0);
    }

    function testClaimAndFlushRejectsBeforeFifteenMinuteWindow() public {
        uint256 configuredAt = collector.lastClaimTime();
        uint256 expectedNext = configuredAt + collector.minimumClaimInterval();
        weth.mint(address(ponsLocker), 1 ether);
        ponsLocker.setClaimAmounts(1 ether, 0);

        vm.warp(expectedNext - 1);
        vm.prank(keeper);
        vm.expectRevert(
            abi.encodeWithSelector(PonsFeeCollector.ClaimIntervalNotElapsed.selector, expectedNext)
        );
        collector.claimAndFlush();

        assertEq(collector.lastClaimTime(), configuredAt);
        assertEq(ponsLocker.collectCallCount(), 0);
    }

    function testSecondClaimWaitsForNextFifteenMinuteWindow() public {
        weth.mint(address(ponsLocker), 2 ether);
        ponsLocker.setClaimAmounts(1 ether, 0);
        _openClaimWindow();

        vm.prank(keeper);
        collector.claimAndFlush();
        uint256 firstClaimTime = collector.lastClaimTime();

        ponsLocker.setClaimAmounts(1 ether, 0);
        uint256 expectedNext = firstClaimTime + collector.minimumClaimInterval();
        vm.prank(keeper);
        vm.expectRevert(
            abi.encodeWithSelector(PonsFeeCollector.ClaimIntervalNotElapsed.selector, expectedNext)
        );
        collector.claimAndFlush();
        assertEq(ponsLocker.collectCallCount(), 1);

        vm.warp(expectedNext);
        vm.prank(keeper);
        collector.claimAndFlush();
        assertEq(ponsLocker.collectCallCount(), 2);
        assertEq(collector.lastClaimTime(), expectedNext);
    }

    function testClaimAuthorizationTracksVaultKeeperRotation() public {
        address nextKeeper = makeAddr("nextKeeper");
        vm.prank(owner);
        vault.setKeeper(nextKeeper);
        weth.mint(address(ponsLocker), 1 ether);
        ponsLocker.setClaimAmounts(1 ether, 0);
        _openClaimWindow();

        vm.prank(keeper);
        vm.expectRevert(
            abi.encodeWithSelector(PonsFeeCollector.UnauthorizedKeeper.selector, keeper, nextKeeper)
        );
        collector.claimAndFlush();

        vm.prank(nextKeeper);
        collector.claimAndFlush();
        assertEq(vault.totalDeposited(), 1 ether);
    }

    function testUnconfiguredCollectorCannotFlush() public {
        PonsFeeCollector fresh = new PonsFeeCollector(owner, address(weth), address(ponsLocker));
        vm.expectRevert(PonsFeeCollector.NotConfigured.selector);
        fresh.flush();

        vm.expectRevert(PonsFeeCollector.NotConfigured.selector);
        fresh.claimAndFlush();
    }

    function testCollectorCanOnlyBeConfiguredOnce() public {
        vm.prank(owner);
        vm.expectRevert(PonsFeeCollector.AlreadyConfigured.selector);
        collector.configure(address(zazu), address(vault));
    }

    function testOnlyOwnerCanConfigure() public {
        PonsFeeCollector fresh = new PonsFeeCollector(owner, address(weth), address(ponsLocker));
        vm.prank(caller);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, caller));
        fresh.configure(address(zazu), address(vault));
    }

    function testConfigureRejectsVaultTokenMismatch() public {
        MockERC20 other = new MockERC20("Other", "OTHER");
        PonsFeeCollector fresh = new PonsFeeCollector(owner, address(weth), address(ponsLocker));

        vm.prank(owner);
        vm.expectRevert(
            abi.encodeWithSelector(
                PonsFeeCollector.VaultTokenMismatch.selector, address(other), address(zazu)
            )
        );
        fresh.configure(address(other), address(vault));
    }

    function testConfigureRejectsVaultFeeTokenMismatch() public {
        MockERC20 otherFee = new MockERC20("Other Fee", "OTHER");
        BuybackVault wrongVault = _newVault(address(zazu), address(otherFee), BURN_ADDRESS);
        PonsFeeCollector fresh = new PonsFeeCollector(owner, address(weth), address(ponsLocker));

        vm.prank(owner);
        vm.expectRevert(
            abi.encodeWithSelector(
                PonsFeeCollector.VaultFeeTokenMismatch.selector, address(weth), address(otherFee)
            )
        );
        fresh.configure(address(zazu), address(wrongVault));
    }

    function testConfigureRejectsNonCanonicalDestination() public {
        BuybackVault wrongVault = _newVault(address(zazu), address(weth), makeAddr("rewardsVault"));
        PonsFeeCollector fresh = new PonsFeeCollector(owner, address(weth), address(ponsLocker));

        vm.prank(owner);
        vm.expectPartialRevert(PonsFeeCollector.VaultBurnDestinationMismatch.selector);
        fresh.configure(address(zazu), address(wrongVault));
    }

    function testConfigureRejectsVaultWithDifferentCadence() public {
        WrongIntervalVault wrongVault = new WrongIntervalVault(zazu, address(weth), BURN_ADDRESS);
        PonsFeeCollector fresh = new PonsFeeCollector(owner, address(weth), address(ponsLocker));

        vm.prank(owner);
        vm.expectRevert(
            abi.encodeWithSelector(
                PonsFeeCollector.VaultIntervalMismatch.selector, 15 minutes, 1 minutes
            )
        );
        fresh.configure(address(zazu), address(wrongVault));
    }

    function testConfigureRejectsAddressesWithoutCode() public {
        PonsFeeCollector fresh = new PonsFeeCollector(owner, address(weth), address(ponsLocker));
        address noCode = makeAddr("noCode");

        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(PonsFeeCollector.AddressHasNoCode.selector, noCode));
        fresh.configure(noCode, address(vault));
    }

    function testConfigureRejectsLockerFeeRedirectMismatch() public {
        PonsFeeCollector fresh = new PonsFeeCollector(owner, address(weth), address(ponsLocker));

        vm.prank(owner);
        vm.expectRevert(
            abi.encodeWithSelector(
                PonsFeeCollector.FeeRedirectMismatch.selector, address(fresh), address(collector)
            )
        );
        fresh.configure(address(zazu), address(vault));
    }

    function testConstructorRejectsInvalidWrappedNativeToken() public {
        vm.expectRevert(PonsFeeCollector.ZeroAddress.selector);
        new PonsFeeCollector(owner, address(0), address(ponsLocker));

        vm.expectRevert(PonsFeeCollector.ZeroAddress.selector);
        new PonsFeeCollector(owner, address(weth), address(0));

        address noCode = makeAddr("noCode");
        vm.expectRevert(abi.encodeWithSelector(PonsFeeCollector.AddressHasNoCode.selector, noCode));
        new PonsFeeCollector(owner, noCode, address(ponsLocker));

        vm.expectRevert(abi.encodeWithSelector(PonsFeeCollector.AddressHasNoCode.selector, noCode));
        new PonsFeeCollector(owner, address(weth), noCode);
    }

    function _newVault(address token, address feeToken, address destination)
        internal
        returns (BuybackVault)
    {
        return new BuybackVault(
            owner,
            token,
            address(router),
            address(weth),
            feeToken,
            destination,
            keeper,
            1 ether,
            10 ether,
            500
        );
    }

    function _openClaimWindow() internal {
        vm.warp(collector.lastClaimTime() + collector.minimumClaimInterval());
    }
}
