# Sepolia Testnet Configuration

## ✅ Changes Made

Application ab **Sepolia Testnet** ke liye configured hai testing ke liye.

### 1. **Network Configuration** (`rw.js`)
   - `USE_TESTNET = true` - Sepolia testnet enable
   - `SEPOLIA_RPC_URL` - Sepolia RPC endpoint (Infura public)
   - `SEPOLIA_CHAIN_ID = 11155111`

### 2. **Etherscan API URLs Updated**
   - Balance API: `https://api-sepolia.etherscan.io/api`
   - Transaction History API: `https://api-sepolia.etherscan.io/api`
   - Automatically switches based on `USE_TESTNET` flag

### 3. **Explorer Links Updated**
   - Transaction links: `https://sepolia.etherscan.io/tx/`
   - Automatically switches based on `USE_TESTNET` flag

### 4. **Provider Configuration**
   - ethers.js wallet ab Sepolia provider ke saath configured hai
   - Wallet creation mein Sepolia provider automatically attach hota hai

## 🔄 Mainnet Par Wapas Kaise Karein

Agar aap mainnet par wapas jana chahte hain:

`rw.js` file mein line 12 par:
```javascript
var USE_TESTNET = false; // Change to false for mainnet
```

## 📝 Important Notes

### Current Status:
- ✅ Balance fetching - Sepolia se kaam kar raha hai
- ✅ Transaction history - Sepolia se kaam kar raha hai
- ✅ Explorer links - Sepolia ke liye updated
- ⚠️ Transaction sending - Abhi bhi Bitcoin transaction logic use kar raha hai

### Transaction Sending:
**Note**: Current code mein transaction sending abhi bhi Bitcoin transaction methods (`txGetUnspent`, `txSend`) use kar raha hai. Proper Ethereum transaction sending ke liye additional implementation chahiye jo `ethers.js` ke `sendTransaction` method ko use kare.

### Testing:
1. Sepolia testnet ETH faucet se ETH lein:
   - https://sepoliafaucet.com/
   - https://faucet.quicknode.com/ethereum/sepolia
   - https://www.alchemy.com/faucets/ethereum-sepolia

2. Wallet create karein aur testnet ETH receive karein

3. Balance check karein - Sepolia explorer par verify karein

4. Transaction history dekh sakte hain Sepolia explorer par

## 🔗 Useful Links

- **Sepolia Explorer**: https://sepolia.etherscan.io
- **Sepolia Faucet**: https://sepoliafaucet.com/
- **Sepolia Chain ID**: 11155111
- **Sepolia RPC**: https://sepolia.infura.io/v3/YOUR_KEY

## ⚠️ Warning

Yeh configuration **testing ke liye** hai. Real ETH transactions ke liye `USE_TESTNET = false` karein aur mainnet par switch karein.

