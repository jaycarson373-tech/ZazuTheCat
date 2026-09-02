// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Test } from "forge-std/Test.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { Zazu1212 } from "../src/Zazu1212.sol";

contract RejectEther {
    receive() external payable {
        revert("no ether");
    }
}

contract Zazu1212Test is Test {
    address internal owner = makeAddr("owner");
    address payable internal payout = payable(makeAddr("payout"));
    address internal collector = makeAddr("collector");
    Zazu1212 internal nft;

    function setUp() public {
        nft = new Zazu1212(
            owner, payout, "ipfs://hidden.json", "ipfs://base/", "ipfs://collection.json", false
        );
        vm.deal(collector, 100 ether);
    }

    function testFixedCollectionConfiguration() public view {
        assertEq(nft.name(), "Zazu Cat 1212");
        assertEq(nft.symbol(), "ZAZU");
        assertEq(nft.MAX_SUPPLY(), 1212);
        assertEq(nft.MINT_PRICE(), 0.003 ether);
        assertEq(nft.maxPerTransaction(), 12);
        assertEq(nft.maxPerWallet(), 24);
        assertEq(nft.owner(), owner);
        assertEq(nft.payoutRecipient(), payout);
        assertEq(nft.totalMinted(), 0);
        assertEq(nft.remainingSupply(), 1212);
        assertEq(nft.baseTokenURI(), "ipfs://base/");
        assertFalse(nft.saleActive());
    }

    function testMintRequiresOpenSale() public {
        vm.prank(collector);
        vm.expectRevert(Zazu1212.SaleClosed.selector);
        nft.mint{ value: 0.003 ether }(1);
    }

    function testActiveDeploymentRequiresFinalBaseURI() public {
        vm.expectRevert(Zazu1212.EmptyURI.selector);
        new Zazu1212(
            owner,
            payout,
            "ipfs://hidden.json",
            "",
            "ipfs://collection.json",
            true
        );
    }

    function testMintUsesExactPriceAndSequentialIds() public {
        _openSale();

        vm.prank(collector);
        nft.mint{ value: 0.009 ether }(3);

        assertEq(nft.ownerOf(1), collector);
        assertEq(nft.ownerOf(2), collector);
        assertEq(nft.ownerOf(3), collector);
        assertEq(nft.totalMinted(), 3);
        assertEq(nft.remainingSupply(), 1209);
        assertEq(nft.mintedByWallet(collector), 3);
        assertEq(address(nft).balance, 0.009 ether);
    }

    function testMintRejectsZeroAndTransactionLimit() public {
        _openSale();

        vm.startPrank(collector);
        vm.expectRevert(Zazu1212.InvalidQuantity.selector);
        nft.mint(0);

        vm.expectRevert(abi.encodeWithSelector(Zazu1212.TransactionLimitExceeded.selector, 12));
        nft.mint{ value: 0.039 ether }(13);
        vm.stopPrank();
    }

    function testMintRejectsIncorrectPayment() public {
        _openSale();

        vm.prank(collector);
        vm.expectRevert(
            abi.encodeWithSelector(Zazu1212.IncorrectPayment.selector, 0.006 ether, 0.005 ether)
        );
        nft.mint{ value: 0.005 ether }(2);
    }

    function testWalletLimitTracksLifetimeMints() public {
        _openSale();

        vm.startPrank(collector);
        nft.mint{ value: 0.036 ether }(12);
        nft.mint{ value: 0.036 ether }(12);

        vm.expectRevert(abi.encodeWithSelector(Zazu1212.WalletLimitExceeded.selector, 24));
        nft.mint{ value: 0.003 ether }(1);
        vm.stopPrank();
    }

    function testSupplyCannotExceed1212() public {
        vm.startPrank(owner);
        nft.setMintLimits(1212, 1212);
        nft.setSaleActive(true);
        vm.stopPrank();

        vm.prank(collector);
        nft.mint{ value: 3.636 ether }(1212);

        assertEq(nft.totalMinted(), 1212);
        assertEq(nft.ownerOf(1212), collector);

        address nextCollector = makeAddr("nextCollector");
        vm.deal(nextCollector, 1 ether);
        vm.prank(nextCollector);
        vm.expectRevert(Zazu1212.MaxSupplyExceeded.selector);
        nft.mint{ value: 0.003 ether }(1);
    }

    function testHiddenThenRevealedMetadataCanBeFrozen() public {
        _openSale();
        vm.prank(collector);
        nft.mint{ value: 0.003 ether }(1);
        assertEq(nft.tokenURI(1), "ipfs://hidden.json");

        vm.startPrank(owner);
        nft.setBaseURI("ipfs://bafy-zazu/");
        nft.reveal();
        assertEq(nft.tokenURI(1), "ipfs://bafy-zazu/1.json");
        nft.freezeMetadata();

        vm.expectRevert(Zazu1212.MetadataIsFrozen.selector);
        nft.setBaseURI("ipfs://replacement/");
        vm.stopPrank();
    }

    function testCannotRevealWithoutBaseURIOrFreezeBeforeReveal() public {
        Zazu1212 noBase = new Zazu1212(
            owner, payout, "ipfs://hidden.json", "", "ipfs://collection.json", false
        );
        vm.startPrank(owner);
        vm.expectRevert(Zazu1212.EmptyURI.selector);
        noBase.reveal();

        vm.expectRevert(Zazu1212.CollectionNotRevealed.selector);
        noBase.freezeMetadata();
        vm.stopPrank();
    }

    function testSaleCannotOpenBeforeFinalBaseURIIsSet() public {
        Zazu1212 noBase = new Zazu1212(
            owner, payout, "ipfs://hidden.json", "", "ipfs://collection.json", false
        );

        vm.startPrank(owner);
        vm.expectRevert(Zazu1212.EmptyURI.selector);
        noBase.setSaleActive(true);
        noBase.setBaseURI("ipfs://final/");
        noBase.setSaleActive(true);
        vm.stopPrank();

        assertTrue(noBase.saleActive());
    }

    function testOnlyOwnerControlsSaleAndLimits() public {
        vm.startPrank(collector);
        vm.expectRevert(
            abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, collector)
        );
        nft.setSaleActive(true);

        vm.expectRevert(
            abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, collector)
        );
        nft.setMintLimits(5, 10);
        vm.stopPrank();

        vm.prank(owner);
        nft.setMintLimits(6, 18);
        assertEq(nft.maxPerTransaction(), 6);
        assertEq(nft.maxPerWallet(), 18);
    }

    function testRejectsInvalidMintLimits() public {
        vm.startPrank(owner);
        vm.expectRevert(Zazu1212.InvalidMintLimits.selector);
        nft.setMintLimits(0, 1);
        vm.expectRevert(Zazu1212.InvalidMintLimits.selector);
        nft.setMintLimits(10, 9);
        vm.expectRevert(Zazu1212.InvalidMintLimits.selector);
        nft.setMintLimits(12, 1213);
        vm.stopPrank();
    }

    function testWithdrawSendsAllProceedsToPayoutRecipient() public {
        _openSale();
        vm.prank(collector);
        nft.mint{ value: 0.006 ether }(2);

        uint256 balanceBefore = payout.balance;
        vm.prank(owner);
        nft.withdraw();

        assertEq(payout.balance - balanceBefore, 0.006 ether);
        assertEq(address(nft).balance, 0);
    }

    function testWithdrawRejectsEmptyBalanceAndFailedRecipient() public {
        vm.prank(owner);
        vm.expectRevert(Zazu1212.NothingToWithdraw.selector);
        nft.withdraw();

        RejectEther rejectEther = new RejectEther();
        vm.startPrank(owner);
        nft.setPayoutRecipient(payable(address(rejectEther)));
        nft.setSaleActive(true);
        vm.stopPrank();

        vm.prank(collector);
        nft.mint{ value: 0.003 ether }(1);

        vm.prank(owner);
        vm.expectRevert(Zazu1212.WithdrawalFailed.selector);
        nft.withdraw();
    }

    function testOwnershipTransferIsTwoStep() public {
        address nextOwner = makeAddr("nextOwner");
        vm.prank(owner);
        nft.transferOwnership(nextOwner);
        assertEq(nft.owner(), owner);
        assertEq(nft.pendingOwner(), nextOwner);

        vm.prank(nextOwner);
        nft.acceptOwnership();
        assertEq(nft.owner(), nextOwner);
    }

    function testOwnershipCannotBeRenounced() public {
        vm.prank(owner);
        vm.expectRevert(Zazu1212.OwnershipRenouncementDisabled.selector);
        nft.renounceOwnership();
        assertEq(nft.owner(), owner);
    }

    function testSupportsERC4906MetadataUpdates() public view {
        assertTrue(nft.supportsInterface(bytes4(0x49064906)));
    }

    function testFuzzMintValidQuantity(uint8 rawQuantity) public {
        uint256 quantity = bound(uint256(rawQuantity), 1, 12);
        _openSale();
        uint256 payment = nft.MINT_PRICE() * quantity;

        vm.prank(collector);
        nft.mint{ value: payment }(quantity);

        assertEq(nft.totalMinted(), quantity);
        assertEq(nft.mintedByWallet(collector), quantity);
    }

    function _openSale() private {
        vm.prank(owner);
        nft.setSaleActive(true);
    }
}
