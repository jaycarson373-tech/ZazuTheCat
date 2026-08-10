// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Script, console2 } from "forge-std/Script.sol";
import { BuybackVault } from "../src/BuybackVault.sol";
import { PonsFeeCollector } from "../src/PonsFeeCollector.sol";
import { PonsV3Adapter } from "../src/PonsV3Adapter.sol";

abstract contract DeployZazuBase is Script {
    address internal constant DEFAULT_BURN_ADDRESS = 0x000000000000000000000000000000000000dEaD;

    struct Deployment {
        address token;
        address collector;
        address adapter;
        address vault;
        address deployer;
        address keeper;
        address pendingOwner;
    }

    error ChainIdMismatch(uint256 expected, uint256 actual);
    error RequiredAddressMissing(string variableName);
    error AddressHasNoCode(string variableName, address value);
    error MultisigRequiredForMainnet(address configuredOwner);
    error PonsWethFeeAssetRequired(address configuredFeeToken, address wrappedNative);
    error PonsPoolFeeRequired(uint24 configuredPoolFee);
    error BurnDestinationRequired(address configuredDestination);
    error CollectorOwnerMismatch(address expected, address actual);
    error CollectorWrappedNativeMismatch(address expected, address actual);
    error CollectorPonsLockerMismatch(address expected, address actual);
    error CollectorClaimIntervalMismatch(uint256 expected, uint256 actual);
    error CollectorAlreadyConfigured(address collector);

    function _deploy(bool mainnet) internal returns (Deployment memory deployment) {
        uint256 expectedChainId = vm.envUint("CHAIN_ID");
        if (block.chainid != expectedChainId) {
            revert ChainIdMismatch(expectedChainId, block.chainid);
        }

        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        address keeper = vm.envAddress("KEEPER_ADDRESS");
        address initialOwner = vm.envOr("INITIAL_OWNER", deployer);
        address existingToken = vm.envAddress("ZAZU_TOKEN_ADDRESS");
        address collectorAddress = vm.envAddress("PONS_FEE_COLLECTOR_ADDRESS");
        address ponsLocker = vm.envAddress("PONS_LOCKER_ADDRESS");
        address ponsSwapRouter = vm.envAddress("PONS_SWAP_ROUTER_ADDRESS");
        uint24 ponsPoolFee = uint24(vm.envOr("PONS_POOL_FEE", uint256(10_000)));
        address wrappedNative = vm.envAddress("WRAPPED_NATIVE_ADDRESS");
        address feeToken = vm.envOr("FEE_TOKEN_ADDRESS", address(0));
        address destination = vm.envOr("BUYBACK_DESTINATION", DEFAULT_BURN_ADDRESS);
        uint256 minAmount = vm.envUint("MIN_EXECUTION_AMOUNT");
        uint256 maxAmount = vm.envUint("MAX_EXECUTION_AMOUNT");
        uint256 slippageBps = vm.envUint("MAX_SLIPPAGE_BPS");
        uint48 timelockDelay = uint48(vm.envOr("CONFIGURATION_DELAY_SECONDS", uint256(1 days)));

        _requireAddress("PONS_SWAP_ROUTER_ADDRESS", ponsSwapRouter);
        _requireAddress("WRAPPED_NATIVE_ADDRESS", wrappedNative);
        _requireAddress("BUYBACK_DESTINATION", destination);
        _requireAddress("INITIAL_OWNER", initialOwner);
        _requireAddress("KEEPER_ADDRESS", keeper);
        _requireAddress("ZAZU_TOKEN_ADDRESS", existingToken);
        _requireAddress("PONS_FEE_COLLECTOR_ADDRESS", collectorAddress);
        _requireAddress("PONS_LOCKER_ADDRESS", ponsLocker);
        _requireCode("PONS_SWAP_ROUTER_ADDRESS", ponsSwapRouter);
        _requireCode("WRAPPED_NATIVE_ADDRESS", wrappedNative);
        _requireCode("ZAZU_TOKEN_ADDRESS", existingToken);
        _requireCode("PONS_FEE_COLLECTOR_ADDRESS", collectorAddress);
        _requireCode("PONS_LOCKER_ADDRESS", ponsLocker);
        if (feeToken != address(0)) _requireCode("FEE_TOKEN_ADDRESS", feeToken);
        if (mainnet && (initialOwner == deployer || initialOwner.code.length == 0)) {
            revert MultisigRequiredForMainnet(initialOwner);
        }
        if (mainnet && feeToken != wrappedNative) {
            revert PonsWethFeeAssetRequired(feeToken, wrappedNative);
        }
        if (mainnet && ponsPoolFee != 10_000) {
            revert PonsPoolFeeRequired(ponsPoolFee);
        }
        if (mainnet && destination != DEFAULT_BURN_ADDRESS) {
            revert BurnDestinationRequired(destination);
        }

        PonsFeeCollector collector = PonsFeeCollector(collectorAddress);
        if (collector.owner() != deployer) {
            revert CollectorOwnerMismatch(deployer, collector.owner());
        }
        if (address(collector.wrappedNativeToken()) != wrappedNative) {
            revert CollectorWrappedNativeMismatch(
                wrappedNative, address(collector.wrappedNativeToken())
            );
        }
        if (address(collector.ponsLocker()) != ponsLocker) {
            revert CollectorPonsLockerMismatch(ponsLocker, address(collector.ponsLocker()));
        }
        if (collector.minimumClaimInterval() != 15 minutes) {
            revert CollectorClaimIntervalMismatch(15 minutes, collector.minimumClaimInterval());
        }
        if (collector.configured()) revert CollectorAlreadyConfigured(collectorAddress);

        vm.startBroadcast(deployerPrivateKey);

        PonsV3Adapter adapter =
            new PonsV3Adapter(ponsSwapRouter, wrappedNative, existingToken, ponsPoolFee);

        BuybackVault vault = new BuybackVault(
            deployer,
            existingToken,
            address(adapter),
            wrappedNative,
            feeToken,
            destination,
            keeper,
            minAmount,
            maxAmount,
            slippageBps
        );
        vault.enableConfigurationTimelock(timelockDelay);
        collector.configure(existingToken, address(vault));

        if (initialOwner != deployer) {
            vault.transferOwnership(initialOwner);
            collector.transferOwnership(initialOwner);
        }

        vm.stopBroadcast();

        deployment = Deployment({
            token: existingToken,
            collector: collectorAddress,
            adapter: address(adapter),
            vault: address(vault),
            deployer: deployer,
            keeper: keeper,
            pendingOwner: initialOwner == deployer ? address(0) : initialOwner
        });

        console2.log("ZAZU_TOKEN_ADDRESS", deployment.token);
        console2.log("PONS_FEE_COLLECTOR_ADDRESS", deployment.collector);
        console2.log("PONS_V3_ADAPTER_ADDRESS", deployment.adapter);
        console2.log("BUYBACK_VAULT_ADDRESS", deployment.vault);
        console2.log("DEPLOYER_ADDRESS", deployment.deployer);
        console2.log("KEEPER_ADDRESS", deployment.keeper);
        console2.log("PONS_ZAZU_TOKEN", existingToken);
        if (initialOwner != deployer) {
            console2.log("PENDING_VAULT_OWNER", initialOwner);
            console2.log("PENDING_COLLECTOR_OWNER", initialOwner);
            console2.log("ACTION_REQUIRED: INITIAL_OWNER must accept both ownership transfers");
        }
    }

    function _requireAddress(string memory variableName, address value) private pure {
        if (value == address(0)) revert RequiredAddressMissing(variableName);
    }

    function _requireCode(string memory variableName, address value) private view {
        if (value.code.length == 0) revert AddressHasNoCode(variableName, value);
    }
}
