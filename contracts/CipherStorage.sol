// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.20;

import "@fhevm/solidity/lib/FHE.sol";

// Interface for Confidential Token (Payment)
interface IConfidentialERC20 {
    function balanceOf(address account) external view returns (euint64);
    function allowance(address owner, address spender) external view returns (euint64);

    // Transfers
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
    function transfer(address recipient, uint256 amount) external returns (bool);
}

contract CipherStorage {
    enum RequestStatus {
        ACTIVE,
        CALCULATED, // New status for v0.9 async flow
        FINALIZED,
        CANCELLED,
        FAILED
    }

    struct Request {
        uint256 id;
        address seller;
        address tokenToSell; // Asset Token (e.g. WBTC)
        uint256 amountToSell;
        address tokenToBuy; // Payment Token (e.g. zUSD)
        euint64 encryptedReserve;
        RequestStatus status;
        uint256 createdAt;
        // Final Results (Clear)
        address winner;
        uint256 winningPriceClear;
        // Async Decryption Storage (Encrypted Results)
        euint64 encWinnerId;
        euint64 encPrice;
        ebool encSuccess;
    }

    struct Bid {
        address bidder;
        euint64 encryptedPrice;
        euint64 validationMask; // 1=Valid, 0=Invalid
        uint256 timestamp;
    }

    // Constants & Config
    uint256 public constant MAX_BIDDERS = 20;
    uint256 public constant MAX_FEE_BPS = 1000; // 10%

    uint256 public nextRequestId;
    uint256 public platformFeeBps = 100; // 1%
    address public treasury;
    bool public isPaused;

    // Storage Mappings
    mapping(uint256 => Request) public requests;
    mapping(uint256 => Bid[]) public requestBids;
    mapping(address => bool) public allowedPaymentTokens;

    // Events
    event RequestCreated(uint256 indexed id, address indexed seller, address tokenSell, uint256 amount);
    event BidSubmitted(uint256 indexed id, address indexed bidder);

    // New Event: Triggered when calculation is done & ready for decryption
    event AuctionResultsReady(uint256 indexed id);

    event AuctionFinalized(uint256 indexed id, address indexed winner, uint256 clearingPrice);
    event AuctionFailed(uint256 indexed id, string reason);
    event AuctionCancelled(uint256 indexed id);
    event FeeUpdated(uint256 oldFee, uint256 newFee);
    event PaymentTokenWhitelisted(address token, bool status);
    event EmergencyWithdrawal(address token, uint256 amount);
    event TradeSettled(uint256 indexed id, address indexed winner, uint256 price);
}
