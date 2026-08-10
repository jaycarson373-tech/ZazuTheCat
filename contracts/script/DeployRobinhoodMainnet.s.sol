// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { DeployZazuBase } from "./DeployZazuBase.s.sol";

contract DeployRobinhoodMainnet is DeployZazuBase {
    uint256 internal constant ROBINHOOD_MAINNET_CHAIN_ID = 4663;

    error RobinhoodMainnetChainRequired(uint256 actualChainId);

    function run() external returns (Deployment memory) {
        if (block.chainid != ROBINHOOD_MAINNET_CHAIN_ID) {
            revert RobinhoodMainnetChainRequired(block.chainid);
        }
        return _deploy(true);
    }
}
