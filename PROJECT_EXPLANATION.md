# Project Ka Simple Explanation (اردو/हिंदी में)

## 🎯 Project Kya Hai?

**Yeh ek Ethereum (ETH) Wallet Application hai jo web browser mein kaam karta hai.**

### Simple Paragraph Mein:

Yeh project ek **web-based Ethereum wallet** hai jahan aap apna Ethereum wallet create kar sakte hain, ETH receive kar sakte hain, aur ETH transfer kar sakte hain. Ye **client-side wallet** hai, matlab aapka private key aur wallet data aapke browser mein hi store hota hai - server par kuch bhi save nahi hota. Application do parts mein hai: **Frontend** (HTML/JavaScript) jo browser mein chalta hai aur user ko interface deta hai, aur **Backend API** (PHP) jo domain name resolution, gift cards, aur transaction tracking ke liye use hota hai. Aap wallet create karne ke liye mouse se random movements karte hain jo entropy generate karta hai, phir usse Ethereum wallet address aur private key ban jata hai. Aap ETH send kar sakte hain direct address, email, QR code scan, ya domain name se. Transaction history, balance check, aur settings sab kuch browser mein hi hota hai. Database sirf backend features ke liye use hota hai (gift cards, domains, etc.) - actual wallet data browser mein hi rehta hai.

---

## 📋 Detailed Breakdown:

### 1. **Frontend (Browser Side)**
   - `index.html` - Main user interface
   - `app.js` - Main application logic
   - `rw.js` - Wallet operations (create, send, receive)
   - `tx.js` - Transaction handling
   - Uses **ethers.js** library for Ethereum operations

### 2. **Backend (Server Side)**
   - `bwapi/` - PHP API
   - Domain name resolution
   - Gift card management
   - Transaction tracking
   - MySQL database for storing metadata

### 3. **Key Features:**
   - ✅ Create Ethereum wallet (brain wallet - passcode se)
   - ✅ Send ETH (address, email, QR code, domain)
   - ✅ Receive ETH (QR code generate)
   - ✅ Transaction history
   - ✅ Balance checking
   - ✅ Settings (fee, currency)
   - ✅ Export/Import keys
   - ✅ Gift card system
   - ✅ Domain name support

### 4. **How It Works:**
   1. User browser mein website open karta hai
   2. Mouse movements se random entropy generate hota hai
   3. Entropy se Ethereum wallet address aur private key ban jata hai
   4. Private key browser mein hi store hota hai (URL hash mein)
   5. ETH send/receive ke liye ethers.js library use hoti hai
   6. Transactions directly Ethereum blockchain par broadcast hote hain
   7. Backend API sirf additional features ke liye (domains, gift cards)

### 5. **Security:**
   - Private keys browser mein hi rehte hain
   - Server par koi sensitive data store nahi hota
   - Wallet URL ko bookmark karna zaroori hai
   - URL = Wallet access (agar URL kho gayi to wallet access nahi)

---

## 🔑 Important Points:

1. **Client-Side Only**: Wallet data browser mein hi hai, server par nahi
2. **URL-Based Access**: Wallet URL se access hota hai (hash mein encoded)
3. **No Server Storage**: Private keys server par save nahi hote
4. **Direct Blockchain**: Transactions directly Ethereum network par jate hain
5. **Backend for Extras**: PHP backend sirf additional features ke liye

---

## 💡 Simple Analogy:

**Yeh aise hai jaise aapke paas ek digital wallet hai jo aapke browser mein hi hai. Jaise aap physical wallet mein paise rakhte hain, yahan ETH rakhte hain. Wallet create karne ke liye aap mouse se random movements karte hain (jaise password type karna), phir wallet ban jata hai. ETH send/receive karne ke liye aap address use karte hain. Sab kuch browser mein hi hota hai - koi server par data save nahi hota.**

---

**In Short**: Yeh ek browser-based Ethereum wallet hai jahan aap ETH store, send, aur receive kar sakte hain. Sab kuch client-side hai - server sirf extra features ke liye hai.

