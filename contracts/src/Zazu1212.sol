// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { Ownable2Step } from "@openzeppelin/contracts/access/Ownable2Step.sol";
import { IERC165 } from "@openzeppelin/contracts/interfaces/IERC165.sol";
import { IERC4906 } from "@openzeppelin/contracts/interfaces/IERC4906.sol";
import { ERC721 } from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { Strings } from "@openzeppelin/contracts/utils/Strings.sol";

/// @title Zazu 1212
/// @notice Fixed-supply public mint for the Zazu Cat collection on Robinhood Chain.
contract Zazu1212 is ERC721, IERC4906, Ownable2Step, ReentrancyGuard {
    using Strings for uint256;

    uint256 public constant MAX_SUPPLY = 1212;
    uint256 public constant MINT_PRICE = 0.003 ether;

    uint256 public maxPerTransaction;
    uint256 public maxPerWallet;
    uint256 private _nextTokenId = 1;

    bool public saleActive;
    bool public revealed;
    bool public metadataFrozen;

    address payable public payoutRecipient;
    mapping(address minter => uint256 quantity) public mintedByWallet;

    string public unrevealedURI;
    string public contractURI;
    string private _baseTokenURI;

    error SaleClosed();
    error InvalidQuantity();
    error TransactionLimitExceeded(uint256 limit);
    error WalletLimitExceeded(uint256 limit);
    error MaxSupplyExceeded();
    error IncorrectPayment(uint256 expected, uint256 received);
    error ZeroAddress();
    error EmptyURI();
    error MetadataIsFrozen();
    error AlreadyRevealed();
    error CollectionNotRevealed();
    error InvalidMintLimits();
    error NothingToWithdraw();
    error WithdrawalFailed();
    error OwnershipRenouncementDisabled();

    event Minted(address indexed minter, uint256 indexed firstTokenId, uint256 quantity);
    event SaleStatusUpdated(bool active);
    event MintLimitsUpdated(uint256 maxPerTransaction, uint256 maxPerWallet);
    event PayoutRecipientUpdated(address indexed previousRecipient, address indexed newRecipient);
    event UnrevealedURIUpdated(string uri);
    event BaseURIUpdated(string uri);
    event ContractURIUpdated(string uri);
    event CollectionRevealed(string baseURI);
    event MetadataFrozen(string baseURI, string contractURI);
    event ProceedsWithdrawn(address indexed recipient, uint256 amount);

    constructor(
        address initialOwner,
        address payable initialPayoutRecipient,
        string memory initialUnrevealedURI,
        string memory initialBaseURI,
        string memory initialContractURI,
        bool startSaleActive
    ) ERC721("Zazu Cat 1212", "ZAZU") Ownable(initialOwner) {
        if (initialPayoutRecipient == address(0)) revert ZeroAddress();
        if (bytes(initialUnrevealedURI).length == 0) revert EmptyURI();
        if (startSaleActive && bytes(initialBaseURI).length == 0) revert EmptyURI();

        payoutRecipient = initialPayoutRecipient;
        unrevealedURI = initialUnrevealedURI;
        _baseTokenURI = initialBaseURI;
        contractURI = initialContractURI;
        maxPerTransaction = 12;
        maxPerWallet = 24;
        saleActive = startSaleActive;
    }

    function mint(uint256 quantity) external payable nonReentrant {
        if (!saleActive) revert SaleClosed();
        if (quantity == 0) revert InvalidQuantity();
        if (quantity > maxPerTransaction) {
            revert TransactionLimitExceeded(maxPerTransaction);
        }

        uint256 walletTotal = mintedByWallet[msg.sender] + quantity;
        if (walletTotal > maxPerWallet) revert WalletLimitExceeded(maxPerWallet);

        uint256 firstTokenId = _nextTokenId;
        if (firstTokenId + quantity - 1 > MAX_SUPPLY) revert MaxSupplyExceeded();

        uint256 expectedPayment = MINT_PRICE * quantity;
        if (msg.value != expectedPayment) {
            revert IncorrectPayment(expectedPayment, msg.value);
        }

        mintedByWallet[msg.sender] = walletTotal;
        _nextTokenId = firstTokenId + quantity;

        for (uint256 tokenId = firstTokenId; tokenId < firstTokenId + quantity; ++tokenId) {
            _safeMint(msg.sender, tokenId);
        }

        emit Minted(msg.sender, firstTokenId, quantity);
    }

    function totalMinted() public view returns (uint256) {
        return _nextTokenId - 1;
    }

    function remainingSupply() external view returns (uint256) {
        return MAX_SUPPLY - totalMinted();
    }

    function baseTokenURI() external view returns (string memory) {
        return _baseTokenURI;
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        if (!revealed) return unrevealedURI;
        return string.concat(_baseTokenURI, tokenId.toString(), ".json");
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, IERC165)
        returns (bool)
    {
        return interfaceId == bytes4(0x49064906) || super.supportsInterface(interfaceId);
    }

    function setSaleActive(bool active) external onlyOwner {
        if (active && bytes(_baseTokenURI).length == 0) revert EmptyURI();
        saleActive = active;
        emit SaleStatusUpdated(active);
    }

    function setMintLimits(uint256 transactionLimit, uint256 walletLimit) external onlyOwner {
        if (
            transactionLimit == 0 || walletLimit == 0 || transactionLimit > walletLimit
                || walletLimit > MAX_SUPPLY
        ) revert InvalidMintLimits();

        maxPerTransaction = transactionLimit;
        maxPerWallet = walletLimit;
        emit MintLimitsUpdated(transactionLimit, walletLimit);
    }

    function setPayoutRecipient(address payable newRecipient) external onlyOwner {
        if (newRecipient == address(0)) revert ZeroAddress();
        address previousRecipient = payoutRecipient;
        payoutRecipient = newRecipient;
        emit PayoutRecipientUpdated(previousRecipient, newRecipient);
    }

    function setUnrevealedURI(string calldata newURI) external onlyOwner {
        _requireMetadataMutable();
        if (bytes(newURI).length == 0) revert EmptyURI();
        unrevealedURI = newURI;
        emit UnrevealedURIUpdated(newURI);
        emit BatchMetadataUpdate(1, MAX_SUPPLY);
    }

    function setBaseURI(string calldata newURI) external onlyOwner {
        _requireMetadataMutable();
        if (bytes(newURI).length == 0) revert EmptyURI();
        _baseTokenURI = newURI;
        emit BaseURIUpdated(newURI);
        if (revealed) emit BatchMetadataUpdate(1, MAX_SUPPLY);
    }

    function setContractURI(string calldata newURI) external onlyOwner {
        _requireMetadataMutable();
        if (bytes(newURI).length == 0) revert EmptyURI();
        contractURI = newURI;
        emit ContractURIUpdated(newURI);
    }

    function reveal() external onlyOwner {
        _requireMetadataMutable();
        if (revealed) revert AlreadyRevealed();
        if (bytes(_baseTokenURI).length == 0) revert EmptyURI();
        revealed = true;
        emit CollectionRevealed(_baseTokenURI);
        emit BatchMetadataUpdate(1, MAX_SUPPLY);
    }

    function freezeMetadata() external onlyOwner {
        _requireMetadataMutable();
        if (!revealed) revert CollectionNotRevealed();
        metadataFrozen = true;
        emit MetadataFrozen(_baseTokenURI, contractURI);
    }

    function withdraw() external onlyOwner nonReentrant {
        uint256 amount = address(this).balance;
        if (amount == 0) revert NothingToWithdraw();

        address payable recipient = payoutRecipient;
        (bool success,) = recipient.call{ value: amount }("");
        if (!success) revert WithdrawalFailed();

        emit ProceedsWithdrawn(recipient, amount);
    }

    function renounceOwnership() public pure override {
        revert OwnershipRenouncementDisabled();
    }

    function _requireMetadataMutable() private view {
        if (metadataFrozen) revert MetadataIsFrozen();
    }
}
