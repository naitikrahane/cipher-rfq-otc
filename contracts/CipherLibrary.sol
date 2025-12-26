// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.20;

import "@fhevm/solidity/lib/FHE.sol";

library CipherLibrary {
    struct EncryptedBidData {
        uint256 bidderId;
        euint64 encryptedPrice;
        euint64 validationMask;
    }

    // --- CORE LOGIC 1: VALIDITY MASKING ---
    // Checks if user has enough Balance AND Allowance
    function computeValidityMask(
        euint64 bidPrice,
        euint64 userBalance,
        euint64 userAllowance
    ) internal returns (euint64 mask) {
        ebool hasEnoughBalance = FHE.le(bidPrice, userBalance);
        ebool hasEnoughAllowance = FHE.le(bidPrice, userAllowance);

        ebool isValid = FHE.and(hasEnoughBalance, hasEnoughAllowance);

        // If Valid -> 1, Else -> 0
        mask = FHE.select(isValid, FHE.asEuint64(1), FHE.asEuint64(0));
        return mask;
    }

    // --- CORE LOGIC 2: BLIND AUCTION SORTING ---
    // Finds highest valid bid without revealing prices
    function findWinnerBlindly(
        EncryptedBidData[] memory bids,
        euint64 reservePrice
    ) internal returns (euint64 winningBidderId, euint64 highestPrice, ebool isAuctionSuccessful) {
        highestPrice = FHE.asEuint64(0);
        winningBidderId = FHE.asEuint64(0);
        ebool anyValidBidFound = FHE.asEbool(false);

        for (uint256 i = 0; i < bids.length; i++) {
            // EffectiveBid = BidPrice * Mask (0 if invalid)
            euint64 effectiveBid = FHE.mul(bids[i].encryptedPrice, bids[i].validationMask);

            // Is this new bid higher than current max?
            ebool isNewHigh = FHE.gt(effectiveBid, highestPrice);

            // Update Highest Price
            highestPrice = FHE.select(isNewHigh, effectiveBid, highestPrice);

            // Update Winner ID
            // Note: We cast uint256 ID to uint64 for FHE compatibility
            euint64 currentId = FHE.asEuint64(uint64(bids[i].bidderId));
            winningBidderId = FHE.select(isNewHigh, currentId, winningBidderId);

            // Track if at least one valid bid exists > 0
            ebool isNonZero = FHE.gt(effectiveBid, FHE.asEuint64(0));
            anyValidBidFound = FHE.or(anyValidBidFound, isNonZero);
        }

        // Check against Reserve Price
        ebool meetsReserve = FHE.ge(highestPrice, reservePrice);

        // Success if: (Valid Bid Exists) AND (Reserve Met)
        isAuctionSuccessful = FHE.and(anyValidBidFound, meetsReserve);
    }
}
