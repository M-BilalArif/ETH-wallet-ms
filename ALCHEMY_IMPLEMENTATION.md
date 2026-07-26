# Alchemy API Implementation Guide

## Overview
This document describes the implementation of Alchemy API for fetching real-time Ethereum transactions with localStorage persistence.

## Changes Made

### 1. API Key Security (`config.js`)
- Created a separate `config.js` file to store the Alchemy API key
- **Important**: For production, consider using a backend proxy to keep the API key truly secure
- Frontend JavaScript cannot completely hide API keys, but this keeps it separate from main code

### 2. Alchemy API Integration (`rw.js`)

#### Replaced Etherscan API with Alchemy API
- **Old**: Used Etherscan public API (rate-limited, no API key)
- **New**: Uses Alchemy `alchemy_getAssetTransfers` method
- Supports: external, internal, ERC20, and ERC721 transfers
- Fetches transactions from block 0 to latest

#### New Functions Added

1. **`loadTransactionsFromStorage()`**
   - Loads saved transactions from localStorage when wallet opens
   - Ensures transactions persist across page refreshes
   - Key format: `eth_transactions_{walletAddress}`

2. **`saveTransactionsToStorage()`**
   - Saves all current transactions to localStorage
   - Limits to 100 transactions to avoid storage issues
   - Automatically called after fetching new transactions

3. **Updated `getHistory()`**
   - Now uses Alchemy API instead of Etherscan
   - Handles Alchemy response format
   - Processes different transfer types (ETH, ERC20, ERC721)
   - Automatically saves to localStorage after updates

4. **Updated `addTransactionToHistory()`**
   - Now saves to localStorage when adding optimistic transactions
   - Includes timestamp for proper sorting

### 3. Automatic Polling (`rw.js` - `open()` function)
- Polls Alchemy API every 30 seconds for new transactions
- Automatically updates transaction list
- Clears previous interval when wallet reopens

### 4. HTML Update (`index.html`)
- Added `config.js` script before `rw.js` to ensure config is loaded

## Features

✅ **Real-time Transactions**: Fetches from Alchemy API every 30 seconds  
✅ **Persistence**: Transactions saved to localStorage, persist across refreshes  
✅ **Multiple Transfer Types**: Supports ETH, ERC20, and ERC721 transfers  
✅ **Automatic Updates**: Polls for new transactions automatically  
✅ **Optimistic Updates**: Shows transactions immediately when sent  

## API Configuration

The Alchemy API endpoint used:
```
POST https://eth-mainnet.g.alchemy.com/v2/{API_KEY}
```

Request Body:
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "alchemy_getAssetTransfers",
  "params": [{
    "fromBlock": "0x0",
    "toBlock": "latest",
    "fromAddress": "0xYourWalletAddress",
    "category": ["external", "internal", "erc20", "erc721"]
  }]
}
```

## Security Notes

⚠️ **Important**: The API key is currently in `config.js` which is loaded in the browser. For production:

1. **Recommended**: Create a backend proxy endpoint that:
   - Stores the API key server-side
   - Makes Alchemy API calls from the server
   - Returns transaction data to the frontend
   - This keeps the API key completely hidden

2. **Alternative**: Use environment variables if deploying with a build process
   - Add `config.js` to `.gitignore`
   - Use a template file for deployment

## Testing

To test the implementation:

1. Open the wallet in a browser
2. Check browser console for any errors
3. Verify transactions load from Alchemy API
4. Refresh the page - transactions should persist
5. Wait 30 seconds - new transactions should appear automatically
6. Check localStorage in DevTools: `localStorage.getItem('eth_transactions_{yourAddress}')`

## Troubleshooting

### Transactions not appearing
- Check browser console for API errors
- Verify API key is correct in `config.js`
- Check network tab for Alchemy API responses
- Ensure wallet address is correct

### Transactions disappear on refresh
- Check if localStorage is enabled in browser
- Verify `loadTransactionsFromStorage()` is being called
- Check browser console for localStorage errors

### API rate limits
- Alchemy free tier has rate limits
- If hitting limits, increase polling interval (currently 30 seconds)
- Consider upgrading Alchemy plan for higher limits

