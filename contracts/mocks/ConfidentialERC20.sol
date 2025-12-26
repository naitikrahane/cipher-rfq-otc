// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.20;

import "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

contract ConfidentialERC20 is ZamaEthereumConfig {
    string public name;
    string public symbol;
    uint8 public constant decimals = 6;

    mapping(address => euint64) internal _encBalances;
    mapping(address => mapping(address => euint64)) internal _encAllowances;

    constructor(string memory _name, string memory _symbol) {
        name = _name;
        symbol = _symbol;
    }

    // --- VIEW FUNCTIONS ---
    function balanceOf(address account) external view returns (euint64) {
        return _encBalances[account];
    }

    function allowance(address owner, address spender) external view returns (euint64) {
        return _encAllowances[owner][spender];
    }

    // --- MINTING ---
    function mint(address to, uint64 amount) external {
        euint64 encAmount = FHE.asEuint64(amount);
        if (!FHE.isInitialized(_encBalances[to])) {
            _encBalances[to] = encAmount;
        } else {
            _encBalances[to] = FHE.add(_encBalances[to], encAmount);
        }
        FHE.allow(_encBalances[to], to);
        FHE.allowThis(_encBalances[to]);
    }

    // --- APPROVAL (UPDATED FIX) ---
    function approve(address spender, uint64 amount) external returns (bool) {
        euint64 amountEnc = FHE.asEuint64(amount);
        _encAllowances[msg.sender][spender] = amountEnc;

        // 1. Grant access to the Allowance amount
        FHE.allow(amountEnc, spender);
        FHE.allow(amountEnc, msg.sender);
        FHE.allowThis(amountEnc);

        // 2. CRITICAL FIX: Grant access to the BALANCE too!
        // CipherCore needs to check (Balance >= Bid) AND (Allowance >= Bid).
        // Without this, CipherCore cannot read the bidder's balance handle.
        if (FHE.isInitialized(_encBalances[msg.sender])) {
            FHE.allow(_encBalances[msg.sender], spender);
        }

        return true;
    }

    // --- TRANSFERS ---
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool) {
        euint64 amountEnc = FHE.asEuint64(uint64(amount));

        _encBalances[sender] = FHE.sub(_encBalances[sender], amountEnc);
        FHE.allow(_encBalances[sender], sender);
        FHE.allowThis(_encBalances[sender]);

        if (!FHE.isInitialized(_encBalances[recipient])) {
            _encBalances[recipient] = amountEnc;
        } else {
            _encBalances[recipient] = FHE.add(_encBalances[recipient], amountEnc);
        }
        FHE.allow(_encBalances[recipient], recipient);
        FHE.allowThis(_encBalances[recipient]);

        return true;
    }

    function transferFrom(address sender, address recipient, euint64 amount) external returns (bool) {
        _encBalances[sender] = FHE.sub(_encBalances[sender], amount);

        if (!FHE.isInitialized(_encBalances[recipient])) {
            _encBalances[recipient] = amount;
        } else {
            _encBalances[recipient] = FHE.add(_encBalances[recipient], amount);
        }

        FHE.allow(_encBalances[sender], sender);
        FHE.allowThis(_encBalances[sender]);
        FHE.allow(_encBalances[recipient], recipient);
        FHE.allowThis(_encBalances[recipient]);
        return true;
    }

    function transfer(address recipient, uint256 amount) external returns (bool) {
        return this.transferFrom(msg.sender, recipient, amount);
    }

    function transfer(address recipient, euint64 amount) external returns (bool) {
        return this.transferFrom(msg.sender, recipient, amount);
    }
}
