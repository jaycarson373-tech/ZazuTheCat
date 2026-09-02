// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Script, console2 } from "forge-std/Script.sol";
import { Zazu1212 } from "../src/Zazu1212.sol";

contract DeployZazu1212 is Script {
    uint256 internal constant ROBINHOOD_CHAIN_ID = 4663;

    error ChainIdMismatch(uint256 expected, uint256 actual);

    function run() external returns (Zazu1212 collection) {
        if (block.chainid != ROBINHOOD_CHAIN_ID) {
            revert ChainIdMismatch(ROBINHOOD_CHAIN_ID, block.chainid);
        }

        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        address initialOwner = vm.envOr("NFT_OWNER", deployer);
        address payable payoutRecipient = payable(vm.envOr("NFT_PAYOUT_RECIPIENT", deployer));
        string memory unrevealedURI =
            vm.envOr("NFT_UNREVEALED_URI", string("https://www.zazucatrh.fun/nft/hidden.json"));
        string memory baseURI = vm.envOr("NFT_BASE_URI", string(""));
        string memory contractURI =
            vm.envOr("NFT_CONTRACT_URI", string("https://www.zazucatrh.fun/nft/collection.json"));
        bool startSaleActive = vm.envOr("NFT_START_SALE", false);

        vm.startBroadcast(deployerPrivateKey);
        collection = new Zazu1212(
            initialOwner, payoutRecipient, unrevealedURI, baseURI, contractURI, startSaleActive
        );
        vm.stopBroadcast();

        console2.log("ZAZU_NFT_CONTRACT_ADDRESS", address(collection));
        console2.log("NFT_OWNER", initialOwner);
        console2.log("NFT_PAYOUT_RECIPIENT", payoutRecipient);
        console2.log("NFT_MAX_SUPPLY", collection.MAX_SUPPLY());
        console2.log("NFT_MINT_PRICE_WEI", collection.MINT_PRICE());
        console2.log("NFT_START_SALE", startSaleActive);
    }
}
