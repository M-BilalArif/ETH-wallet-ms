# Ethereum Wallet Generator - PSP Implementation

## Overview
This is a standalone HTML implementation that replicates the **exact** Ethereum wallet creation logic from the PSP (Personal Security Platform) website.

## Files Included
1. **index.html** - Main HTML file with complete wallet generation implementation
2. **md5.js** - MD5 hashing library (from PSP codebase)
3. **web3-eth-accounts.js** - Web3 Ethereum Accounts library (from PSP codebase)

## How It Works - Exact PSP Flow

### Step-by-Step Process:

1. **Random Entropy Generation**
   - Generates a random 64-character string using cryptographically secure random values
   - This replaces the manual user input in the original PSP website

2. **MD5 Hashing**
   - Takes the random entropy and creates an MD5 hash
   - Uses the exact same MD5 library from PSP (`md5.js`)
   - **PSP Code Reference**: `brainwallet.js` line 20: `document.getElementById('result').value = md5(input.value)`

3. **SHA256 Hashing**
   - Takes the MD5 hash and creates a SHA256 hash
   - This becomes the private key seed
   - **PSP Code Reference**: `brainwallet.js` line 497: `var hash = Crypto.SHA256($('#pass').val(), { asBytes: true });`

4. **Padding**
   - Pads the SHA256 hash to exactly 64 characters with leading zeros
   - **PSP Code Reference**: `brainwallet.js` line 248: `var hash_str = pad($('#hash').val(), 64, '0');`

5. **Ethereum Wallet Creation**
   - Uses the `Web3EthAccounts` library to create the wallet from the padded hash
   - Derives the private key, public key, and Ethereum address
   - **PSP Code Reference**: `brainwallet.js` lines 251-254:
     ```javascript
     const account = new Web3EthAccounts();
     const keyPair = account.create(hash_str);
     const addr = JSON.parse(JSON.stringify(keyPair.address));
     const sec = JSON.parse(JSON.stringify(keyPair.privateKey));
     ```

## Usage Instructions

### Opening the File
1. Ensure all three files are in the same directory:
   - `index.html`
   - `md5.js`
   - `web3-eth-accounts.js`

2. Open `index.html` in a web browser (Chrome, Firefox, Safari, Edge, etc.)

### Creating a Wallet
1. Click the "🔐 Create Ethereum Wallet" button
2. The system will automatically:
   - Generate random entropy
   - Create MD5 hash
   - Create SHA256 hash
   - Derive private key
   - Generate public key
   - Create Ethereum address

3. View all the generated values in the output fields
4. Use the "Copy" buttons to copy individual values to clipboard

## Security Warnings

### ⚠️ CRITICAL SECURITY NOTICE ⚠️

1. **NEVER USE THIS ONLINE**
   - This tool should ONLY be used offline on an air-gapped computer
   - True cold storage wallets must be created in a completely offline environment

2. **Educational Purpose Only**
   - This implementation is for educational purposes and to demonstrate the PSP logic
   - Any wallets created online should be considered **compromised**

3. **Private Key Security**
   - The private key controls access to the wallet
   - Anyone with the private key can access and transfer all funds
   - NEVER share your private key with anyone
   - NEVER store it in plain text online

4. **Proper Cold Storage Setup**
   - Use a dedicated computer that has never been connected to the internet
   - Download files on a different computer and transfer via USB
   - Verify file integrity before use
   - Store private keys in secure, offline locations (paper wallet, hardware wallet, etc.)

## Technical Implementation Details

### Libraries Used
- **MD5.js**: JavaScript MD5 hashing implementation (from PSP)
- **Web3-eth-accounts.js**: Ethereum account creation library (from PSP)
- **CryptoJS SHA256**: Embedded minimal SHA256 implementation for compatibility

### Cryptographic Flow
```
Random Entropy (64 chars)
    ↓
MD5 Hash (32 hex chars)
    ↓
SHA256 Hash (64 hex chars)
    ↓
Pad to 64 chars
    ↓
secp256k1 Private Key
    ↓
secp256k1 Public Key
    ↓
Keccak-256 Hash of Public Key
    ↓
Ethereum Address (last 20 bytes with 0x prefix)
```

### Key Differences from PSP
The only difference between this implementation and the PSP website is:

**PSP**: User manually enters a phrase → MD5 → SHA256 → Wallet
**This Tool**: Automatic random generation → MD5 → SHA256 → Wallet

The actual cryptographic process is **identical** in both cases.

## Verification

You can verify this implementation matches PSP by:

1. Using the same input in both systems
2. Comparing the MD5 hash output
3. Comparing the SHA256 hash output
4. Comparing the final Ethereum address

Both should produce **identical results** because they use the same libraries and the same cryptographic flow.

## Browser Compatibility

This tool works in all modern browsers:
- ✓ Google Chrome
- ✓ Mozilla Firefox
- ✓ Safari
- ✓ Microsoft Edge
- ✓ Opera

## License

This implementation uses open-source libraries:
- MD5.js: MIT License
- Web3-eth-accounts.js: LGPL-3.0

The HTML implementation is provided as-is for educational purposes.

## Disclaimer

This software is provided "as is" without warranty of any kind. The authors and distributors are not responsible for any loss of funds, security breaches, or other damages resulting from the use of this software. Users assume all risks and responsibilities when creating and managing cryptocurrency wallets.

Always follow best practices for cryptocurrency security and cold storage.
