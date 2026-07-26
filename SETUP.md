# ETH Wallet MS - Setup Guide

This guide will help you set up and run the ETH Wallet MS project on your Mac.

## Prerequisites

The following have been installed for you:
- ✅ PHP 8.5.0
- ✅ Composer (PHP dependency manager)
- ✅ MySQL 9.5.0

## Project Structure

```
ETH-wallet-ms-main/
├── index.html          # Main frontend application
├── app.js              # Frontend JavaScript
├── bwapi/              # PHP API backend (moved from Place_In_Root/)
│   ├── index.php       # API entry point
│   ├── app/            # Application classes
│   └── vendor/         # PHP dependencies
└── merchan1_info.sql   # Database schema
```

## Database Setup

The database has been configured with:
- **Host**: localhost
- **User**: root
- **Password**: (empty - for local development)
- **Database**: eth_wallet_ms

The database schema has been imported from `merchan1_info.sql`.

## Running the Application

### Option 1: Using the Startup Script (Recommended)

Simply run:
```bash
./start-server.sh
```

Or make it executable first:
```bash
chmod +x start-server.sh
./start-server.sh
```

### Option 2: Manual Start

1. Ensure MySQL is running:
   ```bash
   brew services start mysql
   ```

2. Start the PHP development server:
   ```bash
   php -S localhost:8000
   ```

3. Open your browser and navigate to:
   ```
   http://localhost:8000
   ```

## Access Points

- **Frontend**: http://localhost:8000
- **API**: http://localhost:8000/bwapi/

## Configuration

### Database Configuration

The database configuration is in `bwapi/app/Config.php`:

```php
const DB_HOST ='localhost';
const DB_USER ='root';
const DB_PASS ='';
const DB_DB   ='eth_wallet_ms';
```

To change the database settings, edit this file.

### Frontend Configuration

The main frontend files are:
- `index.html` - Main HTML file
- `app.js` - Main JavaScript application
- `rw.js` - Wallet-related JavaScript
- `tx.js` - Transaction-related JavaScript

## Troubleshooting

### MySQL Not Running

If MySQL is not running:
```bash
brew services start mysql
```

### Port Already in Use

If port 8000 is already in use, you can change it in `start-server.sh`:
```bash
php -S localhost:8080  # Use port 8080 instead
```

### Database Connection Issues

1. Check if MySQL is running:
   ```bash
   brew services list | grep mysql
   ```

2. Test database connection:
   ```bash
   mysql -u root -e "SHOW DATABASES;"
   ```

3. Verify the database exists:
   ```bash
   mysql -u root -e "USE eth_wallet_ms; SHOW TABLES;"
   ```

### PHP Extensions

If you encounter missing PHP extensions, install them:
```bash
brew install php
```

The required extensions should be included with PHP 8.5.

## Development Notes

- The frontend is a client-side Ethereum wallet that uses ethers.js
- The backend API handles domain resolution, gift cards, and transactions
- All wallet operations are performed client-side for security
- The API is used for additional features like domain lookups

## Security Notes

⚠️ **Important**: This is a development setup with:
- No password for MySQL root user
- Local-only access
- Not suitable for production use

For production deployment, you should:
- Set a strong MySQL root password
- Configure proper database users and permissions
- Use a production web server (Apache/Nginx)
- Enable HTTPS
- Review and secure all API endpoints

## Support

For issues or questions, refer to the project documentation or contact the project maintainers.

