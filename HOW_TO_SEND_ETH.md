# ETH Transfer Kaise Karein (How to Send ETH)

## 📱 Step-by-Step Guide

### 1. **Wallet Open Karein**
   - Browser mein `http://localhost:8000` open karein
   - Agar pehle se wallet nahi hai, to naya wallet create karein
   - Wallet create karne ke liye box mein randomly drag karein

### 2. **Send Tab Par Click Karein**
   - Wallet open hone ke baad, bottom mein **"Send"** button dikhega
   - Us par click karein

### 3. **Recipient Address Enter Karein**
   Aap yeh options use kar sakte hain:
   
   **Option A: Direct Ethereum Address**
   - Recipient ka Ethereum address paste karein
   - Example: `0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb`
   
   **Option B: Email Address**
   - Recipient ka email address enter karein
   - System automatically temporary wallet create karega aur email bhejega
   
   **Option C: QR Code Scan**
   - Camera icon par click karein
   - QR code scan karein
   
   **Option D: Domain Name**
   - Agar recipient ne domain name register kiya hai, to woh bhi use kar sakte hain

### 4. **Amount Enter Karein**
   - Kitna ETH bhejna hai, woh amount enter karein
   - Example: `0.1` (0.1 ETH ke liye)
   - Ya `MAX` type karein agar poori balance bhejni hai

### 5. **Transaction Fee Set Karein (Optional)**
   - Settings icon (gear) par click karein
   - "Set Transaction Mining Fee" select karein
   - Default fee: `0.000007 ETH` (recommended)
   - Custom fee bhi set kar sakte hain

### 6. **Confirm Karein**
   - "Send" button par click karein
   - Confirmation popup mein details check karein:
     - Amount
     - Recipient address
     - Transaction fee
   - "Confirm" button par click karein

### 7. **Transaction Process**
   - Transaction blockchain par broadcast hoga
   - Success message aayega: "Payment Sent!"
   - Transaction ID mil jayega (Etherscan par dekh sakte hain)

## ⚠️ Important Notes

### Security:
- **Wallet URL ko bookmark karein** - Agar URL kho gayi to wallet access nahi hoga
- **Private key ko kabhi share na karein**
- **URL ko kisi ke saath share na karein**

### Transaction Fees:
- Har transaction mein mining fee lagta hai
- Default fee: `0.000007 ETH`
- Higher fee = faster confirmation
- Lower fee = slower confirmation

### Balance Check:
- Transaction se pehle balance check karein
- Balance transaction amount + fee se zyada hona chahiye

### Transaction Status:
- Transaction history mein sab transactions dikhengi
- Etherscan.io par transaction verify kar sakte hain
- Confirmation time: Usually 1-5 minutes

## 🔧 Troubleshooting

### "Insufficient Balance" Error:
- Balance check karein
- Transaction amount + fee total balance se kam hona chahiye

### "Transaction Failed" Error:
- Internet connection check karein
- Transaction fee increase karke try karein
- Kuch time baad phir try karein

### "Wrong Password" Error:
- Agar wallet encrypted hai, to sahi password enter karein
- Password case-sensitive hai

## 📊 Transaction Types

1. **Normal Transfer**: Direct ETH transfer
2. **Email Transfer**: Email address ke through temporary wallet
3. **Gift Card**: Gift card purchase ke liye
4. **Invoice Payment**: Invoice ke liye payment

## 💡 Tips

- Pehle chhoti amount se test karein
- Transaction ID save karein
- Recipient address double-check karein
- Network congestion ke time higher fee use karein

## 🌐 Useful Links

- **Etherscan**: https://etherscan.io (Transaction verify karne ke liye)
- **ETH Price**: Header mein real-time price dikhta hai
- **Support**: support@psp.llc

---

**Note**: Yeh ek client-side wallet hai. Private keys aapke browser mein hi store hote hain. Server par koi data store nahi hota.

