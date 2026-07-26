# Quick Start Guide

## 🚀 Start the Application

Run this command in the project directory:

```bash
./start-server.sh
```

Then open your browser to: **http://localhost:8000**

## ✅ What's Been Set Up

1. ✅ PHP 8.5.0 installed
2. ✅ Composer installed
3. ✅ MySQL installed and running
4. ✅ Database `eth_wallet_ms` created with all tables
5. ✅ PHP dependencies installed
6. ✅ Configuration updated for local development

## 📁 Project Structure

- `index.html` - Main application (frontend)
- `bwapi/` - PHP API backend
- `start-server.sh` - Startup script
- `SETUP.md` - Detailed setup documentation

## 🔧 Troubleshooting

**Server won't start?**
- Make sure MySQL is running: `brew services start mysql`

**Port 8000 in use?**
- Edit `start-server.sh` and change the port number

**Database errors?**
- Check MySQL is running: `brew services list | grep mysql`
- Verify database exists: `mysql -u root -e "SHOW DATABASES;"`

## 📖 More Information

See `SETUP.md` for detailed documentation.

