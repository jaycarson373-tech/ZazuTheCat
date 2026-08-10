// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Script, console2 } from "forge-std/Script.sol";
import { PonsFeeCollector } from "../src/PonsFeeCollector.sol";

/// @notice Deploy this first, then use its address as the pons creator wallet at token creation.
contract DeployPonsFeeCollector is Script {
    uint256 internal constant ROBINHOOD_MAINNET_CHAIN_ID = 4663;

    error ChainIdMismatch(uint256 expected, uint256 actual);
    error RobinhoodMainnetChainRequired(uint256 actualChainId);
    error WrappedNativeHasNoCode(address value);
    error PonsLockerHasNoCode(address value);

    function run() external returns (PonsFeeCollector collector) {
        if (block.chainid != ROBINHOOD_MAINNET_CHAIN_ID) {
            revert RobinhoodMainnetChainRequired(block.chainid);
        }
        uint256 expectedChainId = vm.envUint("CHAIN_ID");
        if (block.chainid != expectedChainId) {
            revert ChainIdMismatch(expectedChainId, block.chainid);
        }

        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        address wrappedNative = vm.envAddress("WRAPPED_NATIVE_ADDRESS");
        address ponsLocker = vm.envAddress("PONS_LOCKER_ADDRESS");
        if (wrappedNative.code.length == 0) revert WrappedNativeHasNoCode(wrappedNative);
        if (ponsLocker.code.length == 0) revert PonsLockerHasNoCode(ponsLocker);

        vm.startBroadcast(deployerPrivateKey);
        collector = new PonsFeeCollector(deployer, wrappedNative, ponsLocker);
        vm.stopBroadcast();

        console2.log("PONS_CREATOR_WALLET", address(collector));
        console2.log("TEMPORARY_COLLECTOR_OWNER", deployer);
    }
}
