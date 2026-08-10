// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Test } from "forge-std/Test.sol";
import { DeployPonsFeeCollector } from "../script/DeployPonsFeeCollector.s.sol";
import { DeployRobinhoodMainnet } from "../script/DeployRobinhoodMainnet.s.sol";

contract DeploymentScriptsTest is Test {
    function testMainnetDeploymentHardRejectsAnotherChainBeforeReadingEnvironment() public {
        DeployRobinhoodMainnet deployment = new DeployRobinhoodMainnet();
        vm.chainId(1);

        vm.expectRevert(
            abi.encodeWithSelector(DeployRobinhoodMainnet.RobinhoodMainnetChainRequired.selector, 1)
        );
        deployment.run();
    }

    function testCollectorDeploymentHardRejectsAnotherChainBeforeReadingEnvironment() public {
        DeployPonsFeeCollector deployment = new DeployPonsFeeCollector();
        vm.chainId(1);

        vm.expectRevert(
            abi.encodeWithSelector(DeployPonsFeeCollector.RobinhoodMainnetChainRequired.selector, 1)
        );
        deployment.run();
    }
}
