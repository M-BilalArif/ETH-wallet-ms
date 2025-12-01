# Troubleshooting Guide

## Common Errors and Solutions

### 1. **Server Not Starting**

**Error**: `Address already in use` or `Port 8000 is already in use`

**Solution**:
```bash
# Kill process on port 8000
lsof -ti:8000 | xargs kill -9

# Or use different port
php -S localhost:8080
```

### 2. **MySQL Connection Error**

**Error**: `Connection refused` or `Can't connect to MySQL`

**Solution**:
```bash
# Start MySQL
brew services start mysql

# Check MySQL status
brew services list | grep mysql
```

### 3. **JavaScript Errors in Browser Console**

**Common Errors**:
- `ethers is not defined` - ethers.js library not loaded
- `psp is not defined` - rw.js not loaded
- `Cannot read property of undefined`

**Solution**:
- Check browser console (F12)
- Make sure all scripts are loading in correct order
- Clear browser cache and reload

### 4. **Balance Not Showing**

**Error**: Balance shows 0 or "Loading..."

**Solution**:
- Check internet connection
- Verify Etherscan API is accessible
- Check browser console for API errors
- Wait 30 seconds for auto-refresh

### 5. **Send Button Not Enabling**

**Error**: Send button stays disabled

**Solution**:
- Enter valid Ethereum address (0x...)
- Enter amount >= 0.000001 ETH
- Make sure amount <= balance
- Check browser console for validation errors

### 6. **Transaction Failed**

**Error**: `Transaction failed` or `Insufficient funds`

**Solution**:
- Check balance is enough (amount + gas fee)
- Verify recipient address is correct
- Check network (Sepolia testnet)
- Get testnet ETH from faucet

## Quick Fixes

### Restart Everything:
```bash
# Stop all services
pkill -f "php -S"
brew services stop mysql

# Start MySQL
brew services start mysql

# Start server
./start-server.sh
```

### Check Logs:
```bash
# PHP errors
tail -f /tmp/php_errors.log

# MySQL errors
tail -f /opt/homebrew/var/mysql/*.err
```

## Still Having Issues?

Please share:
1. Exact error message from terminal
2. Browser console errors (F12)
3. What you were doing when error occurred
4. Screenshot if possible

