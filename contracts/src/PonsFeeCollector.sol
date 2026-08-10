// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { Ownable2Step } from "@openzeppelin/contracts/access/Ownable2Step.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IPonsFeeVault {
    function zazuToken() external view returns (IERC20);
    function feeToken() external view returns (address);
    function buybackDestination() external view returns (address);
    function keeper() external view returns (address);
    function minimumInterval() external view returns (uint256);
    function syncTreasuryBalance() external returns (uint256 newlyAccounted);
    function burnDirectZazu() external returns (uint256 amount);
}

interface IPonsLaunchLocker {
    function collectFees(address token) external returns (uint256 amount0, uint256 amount1);
    function feeRedirects(address token) external view returns (address);
}

/// @title Pons Fee Collector
/// @notice Predeployable creator wallet for a pons launch whose token address does not exist yet.
/// @dev Set this contract as the pons creator wallet, then configure it exactly once after the
///      launched ZAZU token and BuybackVault exist. It has no withdrawal path: WETH and ZAZU can
///      only move to a vault that proves it buys the configured token and burns to 0xdead.
contract PonsFeeCollector is Ownable2Step, ReentrancyGuard {
    using SafeERC20 for IERC20;

    address public constant BURN_ADDRESS = 0x000000000000000000000000000000000000dEaD;
    uint256 public constant minimumClaimInterval = 15 minutes;
    bytes4 private constant NO_FEES_TO_COLLECT_SELECTOR = bytes4(keccak256("NoFeesToCollect()"));

    IERC20 public immutable wrappedNativeToken;
    IPonsLaunchLocker public immutable ponsLocker;
    IERC20 public zazuToken;
    IPonsFeeVault public buybackVault;
    uint256 public lastClaimTime;
    bool public configured;

    event CollectorConfigured(address indexed zazuToken, address indexed buybackVault);
    event CreatorFeesForwarded(uint256 wrappedNativeAmount, uint256 zazuAmount);

    error ZeroAddress();
    error AddressHasNoCode(address value);
    error AlreadyConfigured();
    error NotConfigured();
    error VaultTokenMismatch(address expected, address actual);
    error VaultFeeTokenMismatch(address expected, address actual);
    error VaultBurnDestinationMismatch(address actual);
    error VaultIntervalMismatch(uint256 expected, uint256 actual);
    error FeeRedirectMismatch(address expected, address actual);
    error UnauthorizedKeeper(address caller, address expectedKeeper);
    error ClaimIntervalNotElapsed(uint256 nextEligibleTime);

    constructor(address initialOwner, address wrappedNativeToken_, address ponsLocker_)
        Ownable(initialOwner)
    {
        if (
            initialOwner == address(0) || wrappedNativeToken_ == address(0)
                || ponsLocker_ == address(0)
        ) revert ZeroAddress();
        if (wrappedNativeToken_.code.length == 0) revert AddressHasNoCode(wrappedNativeToken_);
        if (ponsLocker_.code.length == 0) revert AddressHasNoCode(ponsLocker_);
        wrappedNativeToken = IERC20(wrappedNativeToken_);
        ponsLocker = IPonsLaunchLocker(ponsLocker_);
    }

    function configure(address zazuToken_, address buybackVault_) external onlyOwner {
        if (configured) revert AlreadyConfigured();
        if (zazuToken_ == address(0) || buybackVault_ == address(0)) revert ZeroAddress();
        if (zazuToken_.code.length == 0) revert AddressHasNoCode(zazuToken_);
        if (buybackVault_.code.length == 0) revert AddressHasNoCode(buybackVault_);

        IPonsFeeVault vault = IPonsFeeVault(buybackVault_);
        address vaultToken = address(vault.zazuToken());
        if (vaultToken != zazuToken_) revert VaultTokenMismatch(zazuToken_, vaultToken);

        address expectedFeeToken = address(wrappedNativeToken);
        address vaultFeeToken = vault.feeToken();
        if (vaultFeeToken != expectedFeeToken) {
            revert VaultFeeTokenMismatch(expectedFeeToken, vaultFeeToken);
        }

        address destination = vault.buybackDestination();
        if (destination != BURN_ADDRESS) revert VaultBurnDestinationMismatch(destination);
        uint256 vaultInterval = vault.minimumInterval();
        if (vaultInterval != minimumClaimInterval) {
            revert VaultIntervalMismatch(minimumClaimInterval, vaultInterval);
        }
        address redirect = ponsLocker.feeRedirects(zazuToken_);
        if (redirect != address(this)) revert FeeRedirectMismatch(address(this), redirect);

        zazuToken = IERC20(zazuToken_);
        buybackVault = vault;
        lastClaimTime = block.timestamp;
        configured = true;
        emit CollectorConfigured(zazuToken_, buybackVault_);
    }

    /// @notice Forwards every pons creator-fee asset and burns token-side fees immediately.
    /// @dev Permissionless by design. No caller can choose the recipient or assets.
    function flush() external nonReentrant returns (uint256 wethAmount, uint256 zazuAmount) {
        if (!configured) revert NotConfigured();

        return _flush();
    }

    /// @notice Claims the current creator share from the active pons V3 locker, then forwards it.
    /// @dev Only the vault's current keeper can advance the onchain 15-minute claim cadence. A
    ///      no-fees revert is tolerated so the keeper can simulate and skip an empty claim.
    function claimAndFlush()
        external
        nonReentrant
        returns (uint256 wethAmount, uint256 zazuAmount)
    {
        if (!configured) revert NotConfigured();
        IPonsFeeVault vault = buybackVault;
        address expectedKeeper = vault.keeper();
        if (msg.sender != expectedKeeper) revert UnauthorizedKeeper(msg.sender, expectedKeeper);

        uint256 nextEligibleTime = lastClaimTime + minimumClaimInterval;
        if (block.timestamp < nextEligibleTime) revert ClaimIntervalNotElapsed(nextEligibleTime);

        // Commit the cadence before external calls. Any failure reverts this update atomically.
        lastClaimTime = block.timestamp;
        try ponsLocker.collectFees(address(zazuToken)) returns (uint256, uint256) { }
        catch (bytes memory reason) {
            bytes4 selector;
            if (reason.length >= 4) {
                assembly ("memory-safe") {
                    selector := mload(add(reason, 0x20))
                }
            }
            if (selector != NO_FEES_TO_COLLECT_SELECTOR) {
                assembly ("memory-safe") {
                    revert(add(reason, 0x20), mload(reason))
                }
            }
        }

        return _flush();
    }

    function _flush() internal returns (uint256 wethAmount, uint256 zazuAmount) {
        IPonsFeeVault vault = buybackVault;
        address vaultAddress = address(vault);
        wethAmount = wrappedNativeToken.balanceOf(address(this));
        zazuAmount = zazuToken.balanceOf(address(this));

        if (wethAmount != 0) wrappedNativeToken.safeTransfer(vaultAddress, wethAmount);
        if (zazuAmount != 0) zazuToken.safeTransfer(vaultAddress, zazuAmount);

        if (wethAmount != 0) vault.syncTreasuryBalance();
        if (zazuAmount != 0) vault.burnDirectZazu();

        if (wethAmount != 0 || zazuAmount != 0) {
            emit CreatorFeesForwarded(wethAmount, zazuAmount);
        }
    }
}
