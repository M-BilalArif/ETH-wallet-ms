// This keeps a list of unspent transactions to compute the transaction fee from; it
// is hacky and terrible, but we're trying to fix adjusting fees while modifying the
// existing code a little as possible. @TODO: use this as the input to the global TX

var txFeeUnspentCount = 0;


//API 

// Network Configuration - Set to Sepolia Testnet for testing
var USE_TESTNET = true; // Set to false for mainnet
// Using public RPC endpoints that don't require API keys
var SEPOLIA_RPC_URL = 'https://ethereum-sepolia-rpc.publicnode.com'; // Public Sepolia RPC
var SEPOLIA_CHAIN_ID = 11155111;

var apiUrl = 'https://privacy18.site/bwapi'
//var apiUrl = 'http://localhost/blockchain/bwapi';

var apiToken = false; 
var apiUserId = 'testUserId123'; 
var apiUserKey = 'testUserKey456'; 

var transactionKey = '';

var checkDomainMessage = '';
var checkDomainBitcoinAddress = '';

var checkGiftCardMessage = '';
var checkGiftCardBitcoinAddress = '';
var checkGiftCardQR_code = ''; 
var checkGiftCardAmount = '';
var checkGiftCardName = '';
var checkGiftCardNum = '';

//Disable loop
var checkGiftCardLock = 0; 
//Global return
winLoc = window.location;
var cuDomain = winLoc.protocol + "//"+ winLoc.host +""+ winLoc.pathname

console.log(cuDomain)

var r_gc; 

//END API 



function unspentUpdate() {
    var url = 'https://blockchain.info/unspent?cors=true&active=' + psp.address;
    ajax(url, function (data) {
        var r = JSON.parse(data);
        txFeeUnspentCount = r.unspent_outputs.length;
    });
}

function estimateTxKb() {
    // This tries to be as transparent and pessimistic about computing the
    // number of kB a transaction will be.

    var varintSize = function(value) {
        if (value < 253) {
            return 1;
        } else if (value <= 65535) {
            return 3;
        } else if (value <= 4294967293) {
            return 5;
        }
        return 9;
    }

    var stringSize = function(length) {
        return varintSize(length) + length;
    }

    var estimate = 4 +                               // version
                   varintSize(txFeeUnspentCount) +   // number of inputs
                   (txFeeUnspentCount * (            // inputs
                       36 +                          // previous outpoint
                       varintSize(stringSize(65) +   // script length
                           stringSize(72)) +
                       stringSize(65) +              // uncompressed public key size (worst case)
                       stringSize(72) +              // secp265k1 DER signature size (worst case)
                       4)) +                         // sequence size
                   varintSize(2) +                   // size of the number of outputs (max 2)
                   2 * (                             // outputs size (at most 2)
                       8 +                           // output value size
                       varintSize(25) +              // script length size
                       25) +                         // IP_DUP OP_HASH varint(1) address(20) OP_EQUALVERIFY OP_CHECKSIG 
                   4;                                // lock time size

    // Where this estimation will over estimate:
    //   - if the DER signature begins with 0's (as DER truncates leading 0's)
    //   - if there is no change output (it assumes 2 outputs, target and change)
    //   - (I don't know for sure, investigate) a bitcoin output adress could
    //     also have its leading 0's truncated? Might become a requirement to
    //     lower transaction malleability?

    return Math.ceil(estimate / 1000);
}

psp = window.psp = {
    "passcode": "",
    "address": "",
    "txSec": "",
    "balance": 0,
    "txUnspent": "",
    "txValue": 0,
    "txFeePerKb": 0.000007,
    "txAmount": .001,
    "txDest": "",
    "counter": 0,
    "encrypted": false,
    "gpgPrivate": "",
    "gpgPublic": "",
    "gpgKeys": Array(),
    "gpgPage": Array(),
    "price": 0,
    "currency": "USD",
    "useFiat": false,
    "useFiat2": false,
    "firstTime":false,
    "currency": "USD",
    "currencyOptions": ["AUD","BRL","CAD","CHF","CNY","DKK","EUR","GBP","HKD","INR", "ISK", "JPY","KRW","NZD","PLN","RUB","SEK","SGD","THB","TWD","USD","ZAR"],
    "sweeping":"",
    "getBalanceBlock": false,
    "chartLoaded": false,
    "afterSendSuccessful": null,

    "open": function ()
    {
        $("#settings").show();

        if ( readCookie("currency") != "" )
        {
            this.currency = readCookie("currency");
        }

        if ( readCookie("txFeePerKb") != "" )
        {
            this.txFeePerKb = readCookie("txFeePerKb");
        }

        //is invoice wallet?
        invoices = localStorage.invoices;

        if ( invoices && invoices != '[]' )
        {
            invoices = JSON.parse( invoices );

            for ( i in invoices )
            {
                if ( invoices[i].address == this.address )
                {
                    $("#walletName").html( invoices[i].title );
                    break;
                }
            }
        }

        //

        $("#wallet, #txList").show();
        $("#generate").hide();
        
        // Display address with network indicator
        if (this.address && this.address.length > 0) {
            $("#address").html(this.address);
            console.log("Wallet Address:", this.address);
            
            // Show network indicator (Sepolia Testnet or Mainnet)
            if (typeof USE_TESTNET !== 'undefined' && USE_TESTNET) {
                $("#networkIndicator").html("(Sepolia Testnet)").css({"color": "#ff9900", "font-size": "12px", "font-weight": "bold"});
                console.log("Network: Sepolia Testnet");
            } else {
                $("#networkIndicator").html("(Mainnet)").css({"color": "#4CAE4C", "font-size": "12px", "font-weight": "bold"});
                console.log("Network: Mainnet");
            }
        } else {
            console.error("Wallet address is empty!");
            $("#address").html("Address not available");
        }
        
        $(".qrimage").attr("src", generateQRCode("ethereum:" + this.address))
        //$(".qrimage").attr("src", "https://chart.googleapis.com/chart?cht=qr&chs=300x300&chl=bitcoin%3A" + this.address + "&chld=H|0")

        psp.getBalance();

        // Ethereum doesn't have the same WebSocket API as Bitcoin
        // Instead, we'll poll the balance every 30 seconds
        // You can also use Etherscan's WebSocket API with a paid plan
        var balanceCheckInterval = setInterval(function() {
            if (!psp.getBalanceBlock) {
                psp.getBalance();
            }
        }, 30000); // Check every 30 seconds

        // Store interval ID so we can clear it if needed
        psp.balanceCheckInterval = balanceCheckInterval;

        url = "https://bitcoin.wallet.ms/?z=" + ( Math.floor(Math.random() * 9999999) + 1 ) + "#" + psp.passcode + "&{CODE}";
        //DMN
        url2="zxing://scan/?ret=" + encodeURIComponent( url ) + "&SCAN_FORMATS=QR";
        $("#qrlink").attr("href", "");      //dmn
        //$("#qrlink").attr("href", "#");         //dmn

        if ( psp.firstTime )
        {
            $("#saveURLHolder, #saveURL").show();
            setTimeout( function()
            {
                $("#saveURL").slideUp();
            }, 250000);
        }        
        else
        {

        }

        // this.getHistory();
        // if ( psp.lastTab == "gpg" )
        // {
        //     setTimeout(function ()
        //     {
        //         psp.openGpgTab();
        //     }, 200);
        // }

        setInterval( function()
        {
            psp.getFiatPrice();
        }, 300000);
    },

    "check": function ()
    {
        if ( this.useFiat )
        {
            var amount = parseFloat($("#txtAmount").val()) / this.price;
        }
        else
        {
            var amount = $("#txtAmount").val();   
        }

        if (amount > this.balance)
        {
            setMsg("You are trying to send more BTC than you have in your balance!");
            return false;
        }

        // console.log( "total: " + (parseFloat(amount) + parseFloat(this.txFee)) + " balance: " + this.balance);

        var txFee = estimateTxKb() * parseFloat(this.txFeePerKb)
        total = parseFloat(amount) + txFee;
        total = btcFormat( total );

        if (total > this.balance)
        {
            setMsg("You need to leave enough room for the " + txFee + " ETH fee");
            return false;
        }

        if (parseFloat(amount) <= 0)
        {
            setMsg("Please enter an amount!");
            return false;
        }

        

        if ( !this.checkAddress( $('#txtAddress').val() )  && !this.checkEmail( $('#txtAddress').val() ) && !this.checkTwitter( $('#txtAddress').val() ) && !this.checkNFC( $('#txtAddress').val() ) && !this.checkDomain( $('#txtAddress').val()) && !this.checkGiftCard( $('#txtAddress').val()))
        {
            if(checkDomainMessage.length > 1){
                setMsg(checkDomainMessage);
            }else{
                setMsg("Invalid ETH address or Domain address or Email or Gift card!");
            }
            
            
            return false;
        }






        $('#txFee').text(txFee);

       return true;
    },

    "checkEmail": function ( email )
    {
        var re = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;

        return re.test(email);
    },

    "checkTwitter": function ( twitter )
    {
        var result = twitter.match(/^\s*@(\w{1,15})\s*$/);
        return result && result[1] ? result[1] : null;
    },

    "checkAddress": function ( address )
    {
        // Check if it's a valid Ethereum address (0x followed by 40 hex characters)
        if (typeof address === 'string' && address.match(/^0x[a-fA-F0-9]{40}$/)) {
            return true;
        }
        
        // Legacy Bitcoin address support (for backward compatibility)
        try
        {
            if (typeof Bitcoin !== 'undefined' && Bitcoin.base58) {
                var res = Bitcoin.base58.checkDecode(address);
                var version = res.version
                var payload = res.slice(0);
                if (version == 0 || version == 5 )
                    return true;
            }
        }
        catch (err)
        {
            return false;
        }
        
        return false;
    },

    "apiAuth": function(){

        rn = false;

        
        $.ajax({

            url:apiUrl+'/auth/'+apiUserId+'/'+apiUserKey,
            method:'GET',
            async: false,
            dataType:'json',
            error: function(){

                console.log('error api auth')     

                rn = false;
            },
            success: function(e){

                if(typeof(e[0]) != "undefined"){

                    apiToken = e[0].replace(/[/]/g,"|");

                    apiToken = encodeURIComponent(apiToken);

                    rn = true; 

                }else{

                    rn = false;

                }
                
            }

        });


        return rn;

    },


    "checkDomain": function (domain)
    {
            rn = false;

            checkDomainMessage = "";
            checkDomainBitcoinAddress = "";


            result = domain.match(/^[^\.]+\.[^\.]+$/);


            if(result != null){


                //Cheking of domain #1
                $.ajax({
                    
                    url:'https://apis.freename.io/api/v1/resolver/FNS/'+domain,
                    method:'GET',
                    async: false,
                    dataType:'json',
                    error: function(){


                        checkDomainMessage ='Domain not found';


                    },
                    success: function(e){

                        

                        if('data' in e){

                            if('records' in e.data){

                                for (k in e.data.records){

                                    record = e.data.records[k]
                           
                                    if(record.type == "BTC" && record.value.length > 10 ){

                                        checkDomainBitcoinAddress =record.value;

                                        rn = true;

                                        break

                                    }else{  checkDomainMessage ='Address not found'; }
              

                                }

                            }else{ console.log('errorAPI: no key "records"') }

                        }else{  console.log('errorAPI: no key "data"') }




                    }

                });
               


                //Cheking of domain #2
                // if(!rn && this.apiAuth()){

                //     $.ajax({

                //         url:apiUrl+'/domain/'+domain+'/'+apiToken,
                //         method:'GET',
                //         async: false,
                //         dataType:'json',
                //         error: function(){

                //              checkDomainMessage ='errorAPI: check domain. Please try later';

                //              rn = false;
                //         },
                //         success: function(e){

                //             if(typeof(e[0]) != "undefined"){

                //                 checkDomainBitcoinAddress = e[0];

                //                 rn = true; 

                //             }else{

                //                 checkDomainMessage = 'Recipient '+' "'+domain+'" does not have a valid wallet, associated with that Domain address';

                //                rn = false;

                //             }
                            
                //         }
                            
                            

                //     });


                // }


            }


            return rn;

       

    },


    "checkGiftCard": function (giftCard)
    {


        if(checkGiftCardLock==0){

            r_gc = false;

            checkGiftCardMessage = ''

            result = giftCard.match(/(STARBUCKS|AMAZON|VISA)[0-9]{1,2}/g);

            if(result != null && this.apiAuth()){

                //encode current domain
                cd = cuDomain.replace(/[/]/g,"|");

                cd = encodeURIComponent(cd);

                $.ajax({

                    url:apiUrl+'/giftcard/'+giftCard+'/'+cd+'/'+apiToken,
                    method:'GET',
                    async: false,
                    dataType:'json',
                    error: function(e){

                         checkGiftCardLock=1

                         checkGiftCardMessage = e.responseText


                         r_gc = false;

                        
                    },
                    success: function(e){

                        checkGiftCardLock=1

                        if(typeof(e['address']) != "undefined"){
                          
                            checkGiftCardBitcoinAddress = e['address']

                            checkGiftCardAmount = e['btc_expected']

                            checkGiftCardQR_code = e['qr_code']

                            checkGiftCardName = giftCard
                        

                            transactionKey = e['transactionKey']



                            r_gc= true; 

                        }
                        
                    }
                        
                        

                });


            }


            

        }

        return r_gc;

    },

    //0 - uncorrect email
    //1 - error set email
    //2 - success
    "setEmailGiftCard":function(email)
    {
        rn = 0; 

        if(this.checkEmail(email)){


            $.ajax({

                url:apiUrl+'/setEmail/'+email+'/'+transactionKey,
                method:'GET',
                async: false,
                error: function(e){

                    rn = 1; 
                    
                },
                success: function(e){

                    rn = 2;
                    
                }
                    
                    

            });

        }


        return rn; 

    },

    "checkPay": function ()
    {
        
        
        $.ajax({

            url:apiUrl+'/chPy/'+transactionKey,
            method:'GET',
            // async: false,
            dataType:'json',
            error: function(){

                rn= false;

                console.log("error checkGiftCardPay")

            },
            success: function(e){

                // status:
                // 0 - transaction expire 
                // 1 - waiting payment 
                // 2 - received payment full 
                // 3 - received payment low

                if(typeof(e['status']) != "undefined"){

                    rn = e;


                }else{

                    rn= false;

                    console.log("error checkGiftCardPay")

                }

                
            }
          

        });

       
        return rn;

    },



    "checkNFC": function ( address )
    {
        var result = address.match(/^(nfc18)$/gi);
        return result != null ? true : false;
    },
    "send": function ()
    {
        
        if (!this.check())
        {
            return;
        }
        
        if (this.encrypted)
        {
            if ($("#password").val() == "")
            {
                setMsg("Your wallet is encrypted. Please enter a password.");
            }

            var passcode = CryptoJS.AES.decrypt(this.passcode, $("#password").val());
            var passcode = passcode.toString(CryptoJS.enc.Utf8);

            if (!passcode)
            {
                setMsg("Wrong Password!");
                return;
            }
        }
        else
        {
            var passcode = this.passcode;
        }

        // Generate Ethereum wallet from passcode (brain wallet)
        try {
            if (typeof ethers === 'undefined' || typeof ethers.utils === 'undefined') {
                throw new Error('Ethers.js library not loaded');
            }
            
            var entropyHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(passcode));
            var privateKey = ethers.utils.hexlify(ethers.utils.arrayify(entropyHash).slice(0, 32));
            
            // Configure provider for Sepolia testnet
            var provider;
            if (USE_TESTNET) {
                // Create network object for Sepolia
                var sepoliaNetwork = {
                    name: 'sepolia',
                    chainId: SEPOLIA_CHAIN_ID
                };
                
                // ALWAYS use StaticJsonRpcProvider to avoid network detection issues
                // StaticJsonRpcProvider doesn't try to auto-detect the network
                // This prevents "could not detect network" errors
                try {
                    provider = new ethers.providers.StaticJsonRpcProvider(SEPOLIA_RPC_URL, sepoliaNetwork);
                    console.log("✅ Using StaticJsonRpcProvider (no network detection)");
                } catch (e) {
                    console.error("StaticJsonRpcProvider failed, trying JsonRpcProvider:", e);
                    // Only use JsonRpcProvider as last resort, but still with explicit network
                    provider = new ethers.providers.JsonRpcProvider(SEPOLIA_RPC_URL, sepoliaNetwork);
                }
                console.log("Provider configured for Sepolia:", SEPOLIA_RPC_URL);
                console.log("Network:", sepoliaNetwork);
            } else {
                provider = ethers.getDefaultProvider('homestead'); // Mainnet
            }
            
            var ethWallet = new ethers.Wallet(privateKey, provider);
            console.log("Wallet created with address:", ethWallet.address);
            
            this.txSec = ethWallet.privateKey;
            this.ethProvider = provider; // Store provider for transaction sending
            this.ethWallet = ethWallet; // Store wallet instance
            
            // Verify provider connection (non-blocking, don't wait for it)
            provider.getBlockNumber().then(function(blockNumber) {
                console.log("✅ Provider connected! Latest block:", blockNumber);
            }).catch(function(err) {
                console.warn("⚠️ Provider connection check (non-critical):", err.message);
            });
        } catch (error) {
            console.error('Error generating wallet from passcode:', error);
            setMsg('Error: ' + error.message);
            return;
        }

        if ( this.useFiat )
        {
            var btcValue = parseFloat($("#txtAmount").val()) / this.price;
            btcValue = btcFormat( btcValue );
            this.txAmount = btcValue;
        }
        else
        {
            this.txAmount = parseFloat($("#txtAmount").val());
            this.txAmount = btcFormat( this.txAmount );
        }

        if (psp.checkAddress($("#txtAddress").val())) {

            this.txDest = $('#txtAddress').val().replace(/ /g,'');

                    
        } else if (psp.checkEmail($("#txtAddress").val())) {

            var random = randomstring();
            var url = document.location.protocol + "//" + document.location.hostname + document.location.pathname + "#" + random;
            
            // Generate Ethereum wallet from random string
            try {
                if (typeof ethers === 'undefined' || typeof ethers.utils === 'undefined') {
                    throw new Error('Ethers.js library not loaded');
                }
                
                var entropyHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(random));
                var privateKey = ethers.utils.hexlify(ethers.utils.arrayify(entropyHash).slice(0, 32));
                var ethWallet = new ethers.Wallet(privateKey);
                var address = ethWallet.address;
                this.txDest = address;
            } catch (error) {
                console.error('Error generating temporary wallet:', error);
                setMsg('Error generating wallet: ' + error.message);
                return;
            }
            var recipient = $("#txtAddress").val();
            var amount = this.txAmount;

            this.afterSendSuccessful = function() {
                $.post("mail.php", { sender: prompt("Please enter your name so the recipient knows who sent them Bitcoin."), recipient: recipient, amount: amount, url: url }, function(data) {
                    data == "1" ? alert("An email with a link to a temporary wallet containing " + amount + " ETH has been successfully sent to the chosen recipient.") : prompt("Failed to send an email to the chosen recipient. Please manually send an email to the intended recipient with the following link to a temporary wallet containing their " + this.txAmount + " ETH. Select the text in the box below and press Ctrl-C to copy it.", url);
                });
            };
            
        }
        /*else if (psp.checkTwitter($("#txtAddress").val())) {

            var random = randomstring();
            var url = document.location.protocol + "//" + document.location.hostname + document.location.pathname + "#" + random;
            
            // Generate Ethereum wallet from random string
            try {
                if (typeof ethers === 'undefined' || typeof ethers.utils === 'undefined') {
                    throw new Error('Ethers.js library not loaded');
                }
                
                var entropyHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(random));
                var privateKey = ethers.utils.hexlify(ethers.utils.arrayify(entropyHash).slice(0, 32));
                var ethWallet = new ethers.Wallet(privateKey);
                var address = ethWallet.address;
                this.txDest = address;
            } catch (error) {
                console.error('Error generating temporary wallet:', error);
                setMsg('Error generating wallet: ' + error.message);
                return;
            }
            var amount = this.txAmount;

            this.afterSendSuccessful = function() {
                window.open("https://twitter.com/messages/compose?text=" + encodeURIComponent("Hey, I'm sending you Ethereum! Exactly " + amount + " ETH is located at the following secure link. Please do not share this link with anyone or you may lose your Ethereum. " + url))
            };

        }*/
        else if (psp.checkNFC($("#txtAddress").val())) {

            var random = randomstring();
            var url = document.location.protocol + "//" + document.location.hostname + document.location.pathname + "#" + random;
            
            // Generate Ethereum wallet from random string
            try {
                if (typeof ethers === 'undefined' || typeof ethers.utils === 'undefined') {
                    throw new Error('Ethers.js library not loaded');
                }
                
                var entropyHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(random));
                var privateKey = ethers.utils.hexlify(ethers.utils.arrayify(entropyHash).slice(0, 32));
                var ethWallet = new ethers.Wallet(privateKey);
                var address = ethWallet.address;
                this.txDest = address;
            } catch (error) {
                console.error('Error generating temporary wallet:', error);
                setMsg('Error generating wallet: ' + error.message);
                return;
            }
            var amount = this.txAmount;

            $('#confirmSend').data("url",url);

            if ("NDEFReader" in window){

                try {

                    const ndef = new NDEFReader();

                    ndef.write( { records: [{ recordType: "url", data: url }] }, { overwrite: true }) 
                      .then(function(){
                        $("#confirmAddress").html( 'NFC tag written successfully!' );
                        $('#confirmSend').removeAttr("disabled");
                        $('#confirmSend').text("Close");
                        $('#confirmSend').data("status","close");
                      }, function(){
                        $("#confirmAddress").html( 'Failed on write NFC tag!<br>Try again' );
                        $('#confirmSend').removeAttr("disabled");
                        $('#confirmSend').text("Write Tag");
                        $('#confirmSend').data("status","again");
                      })
                      .catch(function(error){
                        $("#confirmAddress").html( 'Failed on write NFC tag. Error: ' + error + ";<br>Try again" );
                        $('#confirmSend').removeAttr("disabled");
                        $('#confirmSend').text("Write Tag");
                        $('#confirmSend').data("status","again");
                      });

                } catch (error) {

                    $("#confirmAddress").html( 'Failed on write NFC tag. Error: ' + error + ";<br>Try again" );
                    $('#confirmSend').removeAttr("disabled");
                    $('#confirmSend').text("Write Tag");
                    $('#confirmSend').data("status","again");

                }

            }else{

                $("#confirmAddress").html( 'Sorry! NFC is not supported in your device' );
                $('#confirmSend').removeAttr("disabled");
                $('#confirmSend').text("Close");
                $('#confirmSend').data("status","close");

            }

        }else if (psp.checkDomain($("#txtAddress").val())) {

            this.txDest = checkDomainBitcoinAddress;

                    
         }

        else if (psp.checkGiftCard($("#txtAddress").val())) {

            this.txDest = checkGiftCardBitcoinAddress;

            this.txAmount = checkGiftCardAmount;
                
        }

        // Send Ethereum transaction using ethers.js
        this.sendEthereumTransaction();

    },

    "sendEthereumTransaction": function () {
        // Disable send button
        $("#sendBtn").attr("disabled", "disabled");
        $("#sendBtn").html("Sending...");
        $("#fiatPrice").hide();

        // Check if wallet and provider are set
        if (!this.ethWallet || !this.ethProvider) {
            setMsg("Error: Wallet not properly initialized. Please try again.");
            $("#sendBtn").removeAttr("disabled");
            $("#sendBtn").html("Send");
            return;
        }

        // Get recipient address and amount
        var recipientAddress = this.txDest;
        var amount = this.txAmount; // Amount in ETH

        // Validate recipient address
        if (!ethers.utils.isAddress(recipientAddress)) {
            setMsg("Error: Invalid recipient address");
            $("#sendBtn").removeAttr("disabled");
            $("#sendBtn").html("Send");
            return;
        }

        // Validate amount
        if (!amount || amount <= 0) {
            setMsg("Error: Invalid amount");
            $("#sendBtn").removeAttr("disabled");
            $("#sendBtn").html("Send");
            return;
        }

        // Convert ETH to Wei
        var amountWei = ethers.utils.parseEther(amount.toString());
        console.log("Sending transaction:");
        console.log("  To:", recipientAddress);
        console.log("  Amount:", amount, "ETH");
        console.log("  Amount (Wei):", amountWei.toString());

        // Get gas price - estimate from network or use default
        var self = this;
        
        // Use a promise chain that handles network errors gracefully
        Promise.resolve()
        .then(function() {
            // Try to get gas price from network
            return self.ethProvider.getGasPrice();
        })
        .then(function(gasPrice) {
            console.log("Gas price:", ethers.utils.formatUnits(gasPrice, "gwei"), "gwei");
            return gasPrice;
        })
        .catch(function(gasError) {
            // Fallback to default if estimation fails
            console.log("Gas price estimation failed, using default 20 gwei");
            return ethers.utils.parseUnits("20", "gwei");
        })
        .then(function(gasPrice) {
            // Send transaction with the gas price (either estimated or default)
            console.log("Sending transaction with gas price:", ethers.utils.formatUnits(gasPrice, "gwei"), "gwei");
            return self.ethWallet.sendTransaction({
                to: recipientAddress,
                value: amountWei,
                gasPrice: gasPrice
            });
        })
        .then(function(tx) {
            console.log("Transaction sent:", tx.hash);
            setMsg("Transaction sent! Hash: " + tx.hash);
            
            // Wait for transaction to be mined
            $("#sendBtn").html("Confirming...");
            return tx.wait();
        })
        .then(function(receipt) {
            console.log("Transaction confirmed:", receipt);
            setMsg("Transaction confirmed! Hash: " + receipt.transactionHash);
            
            // Call success callback if exists
            if (self.afterSendSuccessful) {
                self.afterSendSuccessful();
            }
            
            // Update balance and history
            setTimeout(function() {
                self.getBalance();
                self.getHistory();
            }, 2000);
            
            // Reset UI
            $("#sendBtn").removeAttr("disabled");
            $("#sendBtn").html("Send");
            $("#txtAmount").val("");
            $("#txtAddress").val("");
            
            // Show success message
            psp.txComplete();
        })
        .catch(function(error) {
            console.error("Transaction error:", error);
            
            var errorMsg = "Transaction failed: ";
            if (error.message) {
                errorMsg += error.message;
            } else if (error.reason) {
                errorMsg += error.reason;
            } else {
                errorMsg += "Unknown error";
            }
            
            setMsg(errorMsg);
            
            // Reset UI
            $("#sendBtn").removeAttr("disabled");
            $("#sendBtn").html("Send");
        });
    },

    "sendAndNFC": function ()
    {
        if (!this.check())
        {
            return;
        }

        if (this.encrypted)
        {
            if ($("#password").val() == "")
            {
                setMsg("Your wallet is encrypted. Please enter a password.");
            }

            var passcode = CryptoJS.AES.decrypt(this.passcode, $("#password").val());
            var passcode = passcode.toString(CryptoJS.enc.Utf8);

            if (!passcode)
            {
                setMsg("Wrong Password!");
                return;
            }
        }
        else
        {
            var passcode = this.passcode;
        }

        // Generate Ethereum wallet from passcode (brain wallet)
        try {
            if (typeof ethers === 'undefined' || typeof ethers.utils === 'undefined') {
                throw new Error('Ethers.js library not loaded');
            }
            
            var entropyHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(passcode));
            var privateKey = ethers.utils.hexlify(ethers.utils.arrayify(entropyHash).slice(0, 32));
            
            // Configure provider for Sepolia testnet
            var provider;
            if (USE_TESTNET) {
                // Create network object for Sepolia
                var sepoliaNetwork = {
                    name: 'sepolia',
                    chainId: SEPOLIA_CHAIN_ID
                };
                
                // ALWAYS use StaticJsonRpcProvider to avoid network detection issues
                // StaticJsonRpcProvider doesn't try to auto-detect the network
                // This prevents "could not detect network" errors
                try {
                    provider = new ethers.providers.StaticJsonRpcProvider(SEPOLIA_RPC_URL, sepoliaNetwork);
                    console.log("✅ Using StaticJsonRpcProvider (no network detection)");
                } catch (e) {
                    console.error("StaticJsonRpcProvider failed, trying JsonRpcProvider:", e);
                    // Only use JsonRpcProvider as last resort, but still with explicit network
                    provider = new ethers.providers.JsonRpcProvider(SEPOLIA_RPC_URL, sepoliaNetwork);
                }
                console.log("Provider configured for Sepolia:", SEPOLIA_RPC_URL);
                console.log("Network:", sepoliaNetwork);
            } else {
                provider = ethers.getDefaultProvider('homestead'); // Mainnet
            }
            
            var ethWallet = new ethers.Wallet(privateKey, provider);
            console.log("Wallet created with address:", ethWallet.address);
            
            this.txSec = ethWallet.privateKey;
            this.ethProvider = provider; // Store provider for transaction sending
            this.ethWallet = ethWallet; // Store wallet instance
            
            // Verify provider connection (non-blocking, don't wait for it)
            provider.getBlockNumber().then(function(blockNumber) {
                console.log("✅ Provider connected! Latest block:", blockNumber);
            }).catch(function(err) {
                console.warn("⚠️ Provider connection check (non-critical):", err.message);
            });
        } catch (error) {
            console.error('Error generating wallet from passcode:', error);
            setMsg('Error: ' + error.message);
            return;
        }

        if ( this.useFiat )
        {
            var btcValue = parseFloat($("#txtAmount").val()) / this.price;
            btcValue = btcFormat( btcValue );
            this.txAmount = btcValue;
        }
        else
        {
            this.txAmount = parseFloat($("#txtAmount").val());
            this.txAmount = btcFormat( this.txAmount );
        }

        if (psp.checkAddress($("#txtAddress").val())) {
            this.txDest = $('#txtAddress').val().replace(/ /g,'');
        } else if (psp.checkEmail($("#txtAddress").val())) {
            var random = randomstring();
            var url = document.location.protocol + "//" + document.location.hostname + document.location.pathname + "#" + random;
            
            // Generate Ethereum wallet from random string
            try {
                if (typeof ethers === 'undefined' || typeof ethers.utils === 'undefined') {
                    throw new Error('Ethers.js library not loaded');
                }
                
                var entropyHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(random));
                var privateKey = ethers.utils.hexlify(ethers.utils.arrayify(entropyHash).slice(0, 32));
                var ethWallet = new ethers.Wallet(privateKey);
                var address = ethWallet.address;
                this.txDest = address;
            } catch (error) {
                console.error('Error generating temporary wallet:', error);
                setMsg('Error generating wallet: ' + error.message);
                return;
            }
            var recipient = $("#txtAddress").val();
            var amount = this.txAmount;

            var nextAction = function(){
                $.post("mail.php", { sender: prompt("Please enter your name so the recipient knows who sent them Bitcoin."), recipient: recipient, amount: amount, url: url }, function(data) {
                    data == "1" ? alert("An email with a link to a temporary wallet containing " + amount + " BTC has been successfully sent to the chosen F.") : prompt("Failed to send an email to the chosen recipient. Please manually send an email to the intended recipient with the following link to a temporary wallet containing their " + this.txAmount + " BTC. Select the text in the box below and press Ctrl-C to copy it.", url);
                });
            };

            this.afterSendSuccessful = function() {
                if ("NDEFReader" in window){
                    try {
                        const ndef = new NDEFReader();
                        //await ndef.write(url)
                        ndef.write( { records: [{ recordType: "url", data: url }] }, { overwrite: true }) 
                          .then(function(){
                            alert('NFC tag written successfully!');
                            nextAction();
                          }, function(){
                            alert('Failed on write NFC tag!');
                            nextAction();
                          })
                          .catch(function(error){
                            alert('Failed on write NFC tag. Error: ' + error );
                            nextAction();
                          });
                        //log("> Message written");
                    } catch (error) {
                        alert('Failed on write NFC tag. Error: ' + error );
                        nextAction();
                    }
                }
               
            };
        } else if (psp.checkTwitter($("#txtAddress").val())) {
            var random = randomstring();
            var url = document.location.protocol + "//" + document.location.hostname + document.location.pathname + "#" + random;
            
            // Generate Ethereum wallet from random string
            try {
                if (typeof ethers === 'undefined' || typeof ethers.utils === 'undefined') {
                    throw new Error('Ethers.js library not loaded');
                }
                
                var entropyHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(random));
                var privateKey = ethers.utils.hexlify(ethers.utils.arrayify(entropyHash).slice(0, 32));
                var ethWallet = new ethers.Wallet(privateKey);
                var address = ethWallet.address;
                this.txDest = address;
            } catch (error) {
                console.error('Error generating temporary wallet:', error);
                setMsg('Error generating wallet: ' + error.message);
                return;
            }
            var amount = this.txAmount;

            var nextAction = function(){
                window.open("https://twitter.com/messages/compose?text=" + encodeURIComponent("Hey, I'm sending you Ethereum! Exactly " + amount + " ETH is located at the following secure link. Please do not share this link with anyone or you may lose your Ethereum. " + url));
            };

            this.afterSendSuccessful = function() {
                if ("NDEFReader" in window){
                    try {
                        const ndef = new NDEFReader();
                        ndef.write( { records: [{ recordType: "url", data: url }] }, { overwrite: true }) 
                          .then(function(){
                            alert('NFC tag written successfully!');
                            nextAction();
                          }, function(){
                            alert('Failed on write NFC tag!');
                            nextAction();
                          })
                          .catch(function(error){
                            alert('Failed on write NFC tag. Error: ' + error );
                            nextAction();
                          });
                    } catch (error) {
                        alert('Failed on write NFC tag. Error: ' + error );
                        nextAction();
                    }
                }
            };
        }
        
        // Send Ethereum transaction using ethers.js
        this.sendEthereumTransaction();

    },
    
    "sweep": function ( code, ethWallet )
    {
        if (code !== null) {
            // Generate Ethereum wallet from code
            var entropyHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(code));
            var privateKey = ethers.utils.hexlify(ethers.utils.arrayify(entropyHash).slice(0, 32));
            ethWallet = new ethers.Wallet(privateKey);
        }

        var address = ethWallet.address;
        this.txSec = ethWallet.privateKey;
        this.txDest = psp.address;

        var url = "https://api.blockcypher.com/v1/btc/main/addrs/" + address + "/balance";

        psp.sweeping = psp.address;
        psp.address = address;

        $.ajax(
        {
            type: "GET",
            url: url,
            async: true,
            error: function () {
                $('#apiErrorBox').show();
            },
            data:
            {}
        }).done(function (msg)
        {
            // @TODO: This does not do per kb calculations, it should
            // balance = msg / 100000000;

            fee = psp.txFeePerKb * 100000000;
            amount = msg.final_balance - fee;



            if ( fee < msg.final_balance )
            {
                txSendLock = 1
                
                amount = amount / 100000000;
                psp.txAmount = amount.toFixed(8);
                txGetUnspent();
                $("#sendBtn").attr("disabled", "disabled");
                $("#sendBtn").html("Sending...");
            }
            else
            {
                //alert("Not enough funds to sweep ??");
                alert("Not enough funds to sweep or funds less than fee");
                psp.address = psp.sweeping;
                psp.sweeping="";
                $('#settingsModal').modal('hide')
            }
        });
    },

    "resetInvoiceID": function ()
    {
        microtime = new Date().getTime();
        microHash = Bitcoin.Crypto.SHA256( microtime.toString() );
        invoiceID = microHash.substring(0, 10);
        $("#txtInvoiceID").val( invoiceID );
    },

    "openSmartRequestBox": function ()
    {
        $("#settingsTitle .glyphicon, #settingsInvoice").show();
        $("#youtubeLinkBox").hide();
        $("#settingsTitleText").html( "Payment Request Manager" );

        psp.resetInvoiceID();
        psp.updateInvoices( "SmartRequest" );

        $("#invoiceType").val("SmartRequest");
        $("#headerBalance").html( "Paid" );
        $("#headerAmount").html( "Requested" );
        $("#btnCreateInvoice, #btnNewRequest").html( "Create Payment Request");
    },

    "openSmartFundBox": function ()
    {
        $("#settingsTitle .glyphicon, #settingsInvoice").show();
        $("#settingsTitleText").html( "Fundraiser Manager" );
        $("#youtubeLinkBox").show();
        $("#txtYoutube").val("");

        microtime = new Date().getTime();
        microHash = Bitcoin.Crypto.SHA256( microtime.toString() );
        invoiceID = microHash.substring(0, 10);

        $("#txtInvoiceID").val( invoiceID );

        psp.updateInvoices( "SmartFund" );

        $("#invoiceType").val("SmartFund");
        $("#headerBalance").html( "Raised" );
        $("#headerAmount").html( "Goal" );
        $("#btnCreateInvoice, #btnNewRequest").html( "Create Fundraiser");
    },

    "openImportRequest": function ()
    {
        type = $("#invoiceType").val();
        $("#importRequestBox").slideDown();
        $("#settingsInvoice, #requestForm").hide();
    },

    "generate": function ()
    {
        $("#txtReceiveAmount").blur();
        $('html, body').animate({ scrollTop: 0 }, 'fast');

        setTimeout( function () {
            $("#request").modal("show");
            psp.generateNow();
        }, 1000);
    },

    "checkInvoice": function ()
    {
        if ( !psp.address )
        {
            return false;
        }

        if ( isNaN( $("#txtInvoiceAmount").val() ) || $("#txtInvoiceAmount").val() <= 0 || $("#txtInvoiceAmount").val() == "" || $("#txtInvoiceTitle").val() == "" )
        {
            return false;
        }

        if ( $("#txtInvoiceID").val() == "" )
        {
            return false;
        }

        if ( $("#txtYoutube").val() !== "" )
        {
            if ( getVideoID( $("#txtYoutube").val() ) == false )
            {
                return false;
            }
        }

        return true;
    },

    "createInvoice": function ()
    {
        if ( !this.checkInvoice() )
        {
            return false;
        }

        // Generate Ethereum wallet from passcode + invoice ID
        try {
            if (typeof ethers === 'undefined' || typeof ethers.utils === 'undefined') {
                throw new Error('Ethers.js library not loaded');
            }
            
            var combinedString = this.passcode + "_" + $("#txtInvoiceID").val();
            var entropyHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(combinedString));
            var privateKey = ethers.utils.hexlify(ethers.utils.arrayify(entropyHash).slice(0, 32));
            var ethWallet = new ethers.Wallet(privateKey);
            var address = ethWallet.address;
        } catch (error) {
            console.error('Error generating invoice wallet:', error);
            setMsg('Error: ' + error.message);
            return;
        }

        amount = parseFloat( $("#txtInvoiceAmount").val() );
        title = $("#txtInvoiceTitle").val();
        type = $("#invoiceType").val();
        video = $("#txtYoutube").val();

        invoice = {address:address,"amount":amount,title:title,invoiceid:$("#txtInvoiceID").val(),description:$("#txtInvoiceDescription").val(),myAddress:psp.address, type:type, video:video};
        invoices = localStorage.invoices;

        if ( !invoices )
        {
            localStorage.invoices =  JSON.stringify([invoice]);    
        }
        else
        {
            invoices = JSON.parse( invoices );
            invoices.push( invoice );
            localStorage.invoices =  JSON.stringify(invoices);    
        }

        $("#txtInvoiceTitle, #txtInvoiceAmount, #txtInvoiceDescription").val("");

        // $("#settingsModal").modal("hide");

        $("#requestForm").hide();
        $("#invoiceCountLine").show();

        // $("#newRequestMsg").html("Your " + htmlEncode(invoice.type) + " has been created. You can access your " + htmlEncode(invoice.type) + " in the future by clicking on the settings icon in the top bar." ).show();
        // setTimeout(function ()
        // {
        //     $("#newRequestMsg").slideUp();
        // }, 5000);

        delete invoice.myAddress;

        urlHash =  btoa( encodeURIComponent( JSON.stringify(invoice) ));

        psp.updateInvoices( invoice.type );

        $("#btnNewRequest").show();
    },

    "generateNow": function ()
    {
        amount = $("#txtReceiveAmount").val();

        if ( this.useFiat2 )
        {
            amount = parseFloat( amount ) / this.price;
            amount = btcFormat( amount );
        }


        $("#receiveQR").attr("src", generateQRCode("ethereum:"+this.address+"?value="+amount));
//      $("#receiveQR").attr("src", "https://chart.googleapis.com/chart?cht=qr&chs=300x300&chl=bitcoin%3A" + this.address + "%3Famount%3D" + amount + "&chld=H|0");
        $("#generateAmount").html(amount);
        $("#generateAddress").html( this.address );
    },

    "updateInvoices": function ( type )
    {
        if ( !type )
        {
            type = "SmartFund";
        }

        invoices = localStorage.invoices;

        $("#invoicesBody").html("");
        $("#settingsChoices").hide();

        myInvoiceCount = 0;

        if ( invoices && invoices != '[]' )
        {
            invoices = JSON.parse( invoices );
            addresses = [];
            for ( i in invoices )
            {
                if ( invoices[i].myAddress == psp.address && (invoices[i].type==type || !invoices[i].type) )
                {
                    addresses.push( invoices[i].address );
                    myInvoiceCount ++;
                    $("#invoicesBody").prepend( "<tr><td><a class='openInvoice' invoiceNum='" + i + "'>" + htmlEncode( invoices[i].title ) + "</a></td><td>" + htmlEncode( invoices[i].invoiceid ) + "</td><td class='hidden-sm hidden-xs' id='inv_" + invoices[i].address + "'></td><td >" + htmlEncode( invoices[i].amount.toFixed(8) ) + "</td><td style='text-align:right;'><a class='openInvoiceWallet' title='Open " + getTypeName( type ) + " Wallet' invoiceNum='" + i + "'><span class='glyphicon glyphicon-folder-open'></span></a> <a class='sweepInvoice' title='Sweep Funds' invoiceNum='" + i + "'><span class='glyphicon glyphicon-log-in'></span></a> <a class='deleteInvoice' title='Delete' invoiceNum='" + i + "'><span class='glyphicon glyphicon-trash'></span></a></td></tr>" );
                }
            }
        }

        $("#invoiceCount").html(myInvoiceCount);
        $(".invoiceType").html( getTypeName( type ) );

        if ( myInvoiceCount < 1 )
        {
            $("#invoiceTx, #invoiceCountLine").hide();
            $("#noInvoice").show();
        }
        else
        {
            $("#noInvoice").hide();
            $("#invoiceTx, #invoiceCountLine").show();
            $.ajax(
            {
                type: "GET",
                url: "https://blockchain.info/multiaddr?cors=true&active=" + addresses.join("|"),
                async: true,
                dataType: "json",
                data:
                {}
            }).done(function (msg)
            {
                for ( i in msg.addresses)
                {
                    address = msg.addresses[i].address;
                    balance = msg.addresses[i].final_balance;
                    balance = (balance / 100000000);
                    balance = balance.toFixed(8);

                    $("#inv_" + address).html( balance );
                }

                $("#invoicesBody td:nth-child(4):empty").html("0.00000000");
            });
        }

        $("#invoicesBody td:nth-child(5) a").tooltip(); //Tooltips
    },
    "getBalanceFallback": function () {
        // Fallback method using alternative RPC endpoints
        console.log("Trying fallback RPC endpoints...");
        var fallbackRPCs = [
            "https://ethereum-sepolia-rpc.publicnode.com",
            "https://rpc.sepolia.org"
        ];
        
        var self = this;
        var tryNextRPC = function(index) {
            if (index >= fallbackRPCs.length) {
                console.error("All RPC endpoints failed");
                $('#apiErrorBox').show();
                return;
            }
            
            var rpcUrl = fallbackRPCs[index];
            console.log("Trying fallback RPC:", rpcUrl);
            
            $.ajax({
                type: "POST",
                url: rpcUrl,
                contentType: "application/json",
                data: JSON.stringify({
                    jsonrpc: "2.0",
                    method: "eth_getBalance",
                    params: [self.address, "latest"],
                    id: 1
                }),
                success: function(rpcMsg) {
                    if (rpcMsg && rpcMsg.result) {
                        var balanceWei = parseInt(rpcMsg.result, 16);
                        self.balance = balanceWei / 1000000000000000000;
                        var spendable = self.balance - self.txFeePerKb;
                        if (spendable < 0) spendable = 0;
                        
                        console.log("✅ Balance fetched from fallback RPC!");
                        console.log("Balance (ETH):", self.balance);
                        
                        $("#btcBalance").html( btcFormat( self.balance ) );
                        $("#spendable").html("?" + btcFormat( spendable ) );
                        self.getFiatPrice();
                        setTimeout( function () {self.getHistory()}, 1000);
                    } else {
                        tryNextRPC(index + 1);
                    }
                },
                error: function() {
                    tryNextRPC(index + 1);
                }
            });
        };
        
        tryNextRPC(0);
    },
    "getHistory": function ()
    {
        // Use Etherscan API to get Ethereum transaction history
        // Using public endpoint (no API key required for basic queries, but rate limited)
        // Sepolia testnet API for testing
        var etherscanApi = USE_TESTNET ? "https://api-sepolia.etherscan.io/api" : "https://api.etherscan.io/api";
        var url = etherscanApi + "?module=account&action=txlist&address=" + this.address + "&startblock=0&endblock=99999999&page=1&offset=100&sort=desc";

        $("#txTable tbody").html("");
        $.ajax(
        {
            type: "GET",
            url: url,
            async: true,
            dataType: "json",
            error: function(xhr, status, error) {
                console.error('Error fetching transaction history:', error);
                $('#apiErrorBox').show();
            },
            data:
            {}
        }).done(function (msg)
        {
            if (msg && msg.status === "1" && msg.result && Array.isArray(msg.result) && msg.result.length > 0)
            {
                var txCount = 0;
                for ( i=0; i<msg.result.length && i<100; i++ ) // Check up to 100 transactions
                {
                    var tx = msg.result[i];
                    if (!tx || !tx.hash) continue;
                    
                    // Check if transaction is incoming (to this address) or outgoing (from this address)
                    var isIncoming = tx.to && tx.to.toLowerCase() === psp.address.toLowerCase();
                    var isOutgoing = tx.from && tx.from.toLowerCase() === psp.address.toLowerCase();
                    
                    // Only show transactions where this address is involved
                    if (!isIncoming && !isOutgoing) {
                        continue;
                    }
                    
                    var amount = parseFloat(tx.value || 0) / 1000000000000000000; // Convert from Wei to ETH
                    
                    // Format time
                    var txTime = moment.unix( parseInt(tx.timeStamp || 0) ).format( "MMM D YYYY [<span class='time'>]h:mma[</span>]" );
                    
                    // Calculate confirmations
                    var confirmations = tx.confirmations ? parseInt(tx.confirmations) : 0;
                    
                    // Transaction hash link to Etherscan (Sepolia testnet for testing)
                    var explorerUrl = USE_TESTNET ? "https://sepolia.etherscan.io" : "https://etherscan.io";
                    var txLink = explorerUrl + "/tx/" + tx.hash;
                    var txHashShort = tx.hash.substring(0,30) + '...';
                    
                    // Amount display (positive for incoming, negative for outgoing)
                    var amountDisplay = isIncoming ? btcFormat(amount) : btcFormat(-amount);
                    var amountColor = isIncoming ? "#F49500" : "#52B3EA";
                    
                    var row = '<tr>' +
                        '<td><a href="' + txLink + '" target="_blank">' + txTime + '</a></td>' +
                        '<td class="hidden-sm hidden-xs"><a href="' + txLink + '" target="_blank">' + txHashShort + '</a></td>' +
                        '<td class="hidden-sm hidden-xs">' + formatMoney(confirmations) + '</td>' +
                        '<td style="color:' + amountColor + '; text-align:right; padding-right:30px;"><a href="' + txLink + '" target="_blank">' + amountDisplay + '</a></td>' +
                        '</tr>';
                    
                    $("#txTable tbody").append(row);
                    txCount++;
                    
                    if (txCount >= 50) break; // Limit display to 50 transactions
                }
                
                if (txCount > 0) {
                    $("#txBox").show();
                    $("#noTx, #txList .break").hide();
                } else {
                    $("#txBox").hide();
                    $("#noTx").show();
                }
            }
            else
            {
                $("#txBox").hide();
                $("#noTx").show();
            }
        });
    },  

    "setTxFeePerKb": function ( fee )
    {
        this.txFeePerKb = parseFloat( fee );
        setCookie( "txFeePerKb", parseFloat(fee), 100 );
    },

    "get24Chart": function() 
    {
        if ( this.chartLoaded )
        {
            $("#chartBox").slideDown();
            return;
        }

        $.ajax({
           type: "GET",
           url: "https://api.bitcoinaverage.com/history/" + psp.currency + "/per_minute_24h_sliding_window.csv",
           dataType: "text",
           success: function(allText) 
            {
                psp.chartLoaded = true;
                var allTextLines = allText.split(/\r\n|\n/);
                var headers = allTextLines[0].split(',');
                var lines = [];

                for (var i=1; i<allTextLines.length; i++) {
                    var data = allTextLines[i].split(',');
                    if (data.length == headers.length) {
                        var tarr = [];
                        for (var j=0; j<headers.length; j++) {
                            tarr.push(data[j]);
                        }
                        lines.push(tarr);
                    }
                }

                hours = [];
                for ( i in lines )
                {
                    if ( i % 2 == 0 )
                    {
                        var date = new Date( lines[i][0] + " GMT");
                        unix = date.getTime()  ;
                        hours.push( [unix, lines[i][1] ] );
                    }
                }

                $("#chartBox").slideDown();

                $.plot("#chart24", [ hours ],
                    {       
                           xaxis: {mode:"time", timeformat: "%H", timezone: "browser", tickSize: [3, "hour"]},
                           colors: ["#F49500"],
                           grid: {
                            color: "#64657A",
                            borderColor:"#3E3F4D",
                            borderWidth:1
                           }
                   }
                );
            }
        });
    },

    "getBalance": function ()
    {
        console.log("Fetching balance for address:", this.address);
        console.log("Network:", USE_TESTNET ? "Sepolia Testnet" : "Mainnet");
        
        // For Sepolia, use direct RPC call since Etherscan API V1 is deprecated
        if (USE_TESTNET) {
            // Use direct RPC call for Sepolia
            var rpcUrl = "https://ethereum-sepolia-rpc.publicnode.com";
            console.log("Using RPC:", rpcUrl);
            
            $.ajax({
                type: "POST",
                url: rpcUrl,
                contentType: "application/json",
                data: JSON.stringify({
                    jsonrpc: "2.0",
                    method: "eth_getBalance",
                    params: [this.address, "latest"],
                    id: 1
                }),
                success: function(rpcMsg) {
                    if (rpcMsg && rpcMsg.result) {
                        var balanceWei = parseInt(rpcMsg.result, 16);
                        psp.balance = balanceWei / 1000000000000000000;
                        var spendable = psp.balance - psp.txFeePerKb;
                        if (spendable < 0) spendable = 0;
                        
                        console.log("✅ Balance fetched successfully from RPC!");
                        console.log("Balance (Wei):", balanceWei);
                        console.log("Balance (ETH):", psp.balance);
                        console.log("Spendable (ETH):", spendable);
                        
                        $("#btcBalance").html( btcFormat( psp.balance ) );
                        $("#spendable").html("?" + btcFormat( spendable ) );
                        psp.getFiatPrice();
                        setTimeout( function () {psp.getHistory()}, 1000);
                    } else {
                        console.error("RPC error:", rpcMsg);
                        // Try fallback RPC
                        psp.getBalanceFallback();
                    }
                },
                error: function(xhr, status, error) {
                    console.error("RPC call failed:", error);
                    // Try fallback RPC
                    psp.getBalanceFallback();
                }
            });
            return;
        }
        
        // For Mainnet, use Etherscan API
        var url = "https://api.etherscan.io/api?module=account&action=balance&address=" + this.address + "&tag=latest";
        console.log("Using API: Mainnet Etherscan");

        $.ajax(
        {
            type: "GET",
            url: url,
            async: true,
            dataType: "json",
            error: function (xhr, status, error) {
                console.error('Error fetching balance from Etherscan:', error);
                console.log('Trying alternative API...');
                
                // Try Alchemy public RPC for Sepolia as fallback
                if (USE_TESTNET) {
                    var alchemyUrl = "https://eth-sepolia.g.alchemy.com/v2/demo";
                    $.ajax({
                        type: "POST",
                        url: alchemyUrl,
                        contentType: "application/json",
                        data: JSON.stringify({
                            jsonrpc: "2.0",
                            method: "eth_getBalance",
                            params: [psp.address, "latest"],
                            id: 1
                        }),
                        success: function(alchemyMsg) {
                            if (alchemyMsg && alchemyMsg.result) {
                                var balanceWei = parseInt(alchemyMsg.result, 16);
                                psp.balance = balanceWei / 1000000000000000000;
                                var spendable = psp.balance - psp.txFeePerKb;
                                if (spendable < 0) spendable = 0;
                                
                                console.log("Balance fetched from Alchemy!");
                                console.log("Balance (ETH):", psp.balance);
                                
                                $("#btcBalance").html( btcFormat( psp.balance ) );
                                $("#spendable").html("?" + btcFormat( spendable ) );
                                psp.getFiatPrice();
                                setTimeout( function () {psp.getHistory()}, 1000);
                                return;
                            }
                        },
                        error: function() {
                            console.error('Alchemy API also failed');
                        }
                    });
                }
                
                // Try alternative API if Etherscan fails
                var altUrl = "https://api.ethplorer.io/getAddressInfo/" + psp.address + "?apiKey=freekey";
                $.ajax({
                    type: "GET",
                    url: altUrl,
                    async: true,
                    dataType: "json",
                    error: function() {
                        $('#apiErrorBox').show();
                    },
                    success: function(altMsg) {
                        if (altMsg && altMsg.ETH) {
                            psp.balance = parseFloat(altMsg.ETH.balance) || 0;
                            var spendable = psp.balance - psp.txFeePerKb;
                            if (spendable < 0)
                                spendable = 0;

                            $("#btcBalance").html( btcFormat( psp.balance ) );
                            $("#spendable").html("?" + btcFormat( spendable ) );
                            psp.getFiatPrice();
                            setTimeout( function () {psp.getHistory()}, 1000);
                        } else {
                            $('#apiErrorBox').show();
                        }
                    }
                });
            },
            data:
            {}
        }).done(function (msg)
        {
            console.log("Etherscan API Response:", msg);
            
            // Handle response - check if result exists and is a valid number
            if (msg && msg.result) {
                var balanceWei = msg.result;
                
                // Check if result is a valid number string (Wei amount)
                // Even if status is "0" with deprecated warning, result might still contain balance
                if (typeof balanceWei === 'string' && /^[0-9]+$/.test(balanceWei)) {
                    psp.balance = parseFloat(balanceWei) / 1000000000000000000; // Convert from Wei to ETH
                    var spendable = psp.balance - psp.txFeePerKb;
                    if (spendable < 0)
                        spendable = 0;

                    console.log("✅ Balance fetched successfully!");
                    console.log("Balance (Wei):", balanceWei);
                    console.log("Balance (ETH):", psp.balance);
                    console.log("Spendable (ETH):", spendable);

                    $("#btcBalance").html( btcFormat( psp.balance ) );
                    $("#spendable").html("?" + btcFormat( spendable ) );
                    psp.getFiatPrice();
                    setTimeout( function () {psp.getHistory()}, 1000);
                    return;
                } else {
                    console.warn("Invalid balance result:", balanceWei);
                }
            }
            
            // If we get here, API call failed or returned error
            if (msg && msg.message) {
                console.error('Etherscan API error message:', msg.message);
                // Etherscan returned an error message
                console.error('Etherscan API error:', msg.message);
                // Try alternative API
                var altUrl = "https://api.ethplorer.io/getAddressInfo/" + psp.address + "?apiKey=freekey";
                $.ajax({
                    type: "GET",
                    url: altUrl,
                    async: true,
                    dataType: "json",
                    error: function() {
                        $('#apiErrorBox').show();
                    },
                    success: function(altMsg) {
                        if (altMsg && altMsg.ETH) {
                            psp.balance = parseFloat(altMsg.ETH.balance) || 0;
                            var spendable = psp.balance - psp.txFeePerKb;
                            if (spendable < 0)
                                spendable = 0;

                            $("#btcBalance").html( btcFormat( psp.balance ) );
                            $("#spendable").html("?" + btcFormat( spendable ) );
                            psp.getFiatPrice();
                            setTimeout( function () {psp.getHistory()}, 1000);
                        } else {
                            $('#apiErrorBox').show();
                        }
                    }
                });
            } else {
                // Unknown error, try direct RPC call for Sepolia
                console.log("Etherscan API failed, trying direct RPC call...");
                
                if (USE_TESTNET && typeof SEPOLIA_RPC_ALTERNATIVES !== 'undefined' && SEPOLIA_RPC_ALTERNATIVES.length > 0) {
                    // Try first RPC endpoint
                    var rpcUrl = SEPOLIA_RPC_ALTERNATIVES[0];
                    $.ajax({
                        type: "POST",
                        url: rpcUrl,
                        contentType: "application/json",
                        data: JSON.stringify({
                            jsonrpc: "2.0",
                            method: "eth_getBalance",
                            params: [psp.address, "latest"],
                            id: 1
                        }),
                        success: function(rpcMsg) {
                            if (rpcMsg && rpcMsg.result) {
                                var balanceWei = parseInt(rpcMsg.result, 16);
                                psp.balance = balanceWei / 1000000000000000000;
                                var spendable = psp.balance - psp.txFeePerKb;
                                if (spendable < 0) spendable = 0;
                                
                                console.log("Balance fetched from RPC!");
                                console.log("Balance (ETH):", psp.balance);
                                
                                $("#btcBalance").html( btcFormat( psp.balance ) );
                                $("#spendable").html("?" + btcFormat( spendable ) );
                                psp.getFiatPrice();
                                setTimeout( function () {psp.getHistory()}, 1000);
                                return;
                            }
                        },
                        error: function() {
                            console.error('RPC call failed');
                            $('#apiErrorBox').show();
                        }
                    });
                } else {
                    // Try alternative API
                    var altUrl = "https://api.ethplorer.io/getAddressInfo/" + psp.address + "?apiKey=freekey";
                    $.ajax({
                        type: "GET",
                        url: altUrl,
                        async: true,
                        dataType: "json",
                        error: function() {
                            $('#apiErrorBox').show();
                        },
                        success: function(altMsg) {
                            if (altMsg && altMsg.ETH) {
                                psp.balance = parseFloat(altMsg.ETH.balance) || 0;
                                var spendable = psp.balance - psp.txFeePerKb;
                                if (spendable < 0)
                                    spendable = 0;

                                $("#btcBalance").html( btcFormat( psp.balance ) );
                                $("#spendable").html("?" + btcFormat( spendable ) );
                                psp.getFiatPrice();
                                setTimeout( function () {psp.getHistory()}, 1000);
                            } else {
                                $('#apiErrorBox').show();
                            }
                        }
                    });
                }
            }
        });
    },

     "getFiatPrefix": function()
    {
        switch ( this.currency )
        {
            case "AUD":
            case "USD":
            case "CAD":
            case "CLP":
            case "HKD":
            case "NZD":
            case "SGD":
                return "$";
                break;
            case "BRL":
                return "R$"; 
            case "CNY":
                return "¥";            
            case "DKK":
                return "kr";
            case "EUR":
                return "€";            
            case "GBP":
                return "£";            
            case "INR":
                return "";
            case "ISK":
                return "kr";            
            case "JPY":
                return "¥";
            case "KRW":
                return "₩";            
            case "PLN":
                return "zł";
            case "RUB":
                return "руб ";            
            case "SEK":
                return "kr ";
            case "TWD":
                return "NT$";
            case "THB":
                return "T฿";
            default:
                return "$";
        }
    },

    "getFiatValue": function ()
    {
        this.fiatValue = this.price * psp.balance;
        $("#fiatValue").html( this.getFiatPrefix() + formatMoney(  this.fiatValue.toFixed(2) ) );
        $("#currentPrice").html( this.getFiatPrefix() + formatMoney(  psp.price.toFixed(2)  ));
    },

    "getFiatPrice": function ()
    {
        currency = this.currency;

        $.ajax({
            type: "GET",
            url: "ticker2.php",
            async: true,
            data: {},
            dataType: "json"
        }).done(function (msg) {
            price = msg[currency].last;
            psp.price = price;
            price = price.toFixed(2);
            $("#price").html(psp.getFiatPrefix()+formatMoney(price) ).show();
            $("#currencyValue").html( psp.currency );
            $(".currency").animate({opacity:1});
            psp.getFiatValue();
        });
    },

    "amountFiatValue": function ()
    {
        var amount = $("#txtAmount").val();
        amount = parseFloat(amount);
        if (!amount)
        {
            amount = 0;
        }

        if ( psp.useFiat )
        {
            var btcValue = amount / this.price;
            btcValue = btcFormat( btcValue );
            $("#fiatPrice").html("(฿" + btcValue + ")");
        }
        else
        {
            var fiatValue = this.price * amount;
            fiatValue = fiatValue.toFixed(2);
            $("#fiatPrice").html("(" + this.getFiatPrefix() + formatMoney(fiatValue) + ")");
        }
    },

    "amountFiatValue2": function ()
    {
        var amount = $("#txtReceiveAmount").val();
        amount = parseFloat(amount);
        if (!amount)
        {
            amount = 0;
        }

        if ( psp.useFiat2 )
        {
            var btcValue = amount / this.price;
            btcValue = btcFormat( btcValue );
            $("#fiatPrice2").html("(฿" + btcValue + ")");
        }
        else
        {
            var fiatValue = this.price * amount;
            fiatValue = fiatValue.toFixed(2);
            $("#fiatPrice2").html("(" + this.getFiatPrefix() + formatMoney(fiatValue) + ")");
        }
    },

    "prepareReset": function ()
    {
        setMsg("Are you sure you want to generate a new address? <strong>This will delete your current one and all funds associated with it.</strong> <br/><button id='confirmReset'>Yes</button> <button id='noReset'>No</button>");
    },

    "reset": function ()
    {
        $("#errorBox").hide();

        // chrome.storage.local.set(
        // {
        //     'encrypted': false
        // }, function () {});

        $("#balanceBox").hide();
        $("#password").hide();
        $("#preparePassword").show();

        this.encrypted = false;
        this.passcode = "";
        this.address = "";
        this.txSec = "";
        entroMouse.string = "";
        entroMouse.start();
    },

    "txComplete": function ()
    {   



        setMsg("Payment Sent!", true);
        $("#sendBtn").removeAttr("disabled");
        $("#sendBtn").html("Send");

        this.txSec = "";

        if ( psp.sweeping != "" )
        {
            alert("Payment Sent!")
            psp.address = psp.sweeping;
            this.sweeping = "";
            $('#settingsModal').modal('hide')
        }

        $("#password").val("");
        $("#txtAmount").val("").css({"font-size":"14px"});
        $("#txtAddress").val("");
        $("#fiatPrice").show();
        $("#oneNameInfo").hide();

        this.getBalance();
        playBeep();

        psp.getBalanceBlock = true;

        setTimeout( function ()
        {
            psp.getBalanceBlock = false;
        }, 1000);

        if (this.afterSendSuccessful) this.afterSendSuccessful();


        if(r_gc){

            $('#confirmSend').hide();
            $('.closeConfirm').hide();
        }

    },

    "exportWallet": function ()
    {
        if (!this.encrypted)
        {
            setMsg("" + psp.passcode);
        }
        else
        {
            if ($("#password").val() == "")
            {
                setMsg("Please enter password to decrypt wallet.");
                return;
            }

            var passcode = CryptoJS.AES.decrypt(this.passcode, $("#password").val());
            var passcode = passcode.toString(CryptoJS.enc.Utf8);

            if (!passcode)
            {
                setMsg("Incorrenct Password!");
                return;
            }

            setMsg("Brainwallet: " + passcode);
            $("#password").val("");
        }
    },

    "importWallet": function ()
    {
        setMsg("Importing a brain wallet will replace your current wallet. You will lose your balance if you haven't backed it up!<br/><input type='text' id='importBrainTxt' placeholder='Brainwallet'> <button id='confirmImport'>Import</button>");
    },

    "confirmImport": function ()
    {
        if (!$("#confirmImport").attr("confirmed"))
        {
            $("#confirmImport").html("Are you sure? Click to confirm!").attr("confirmed", "true");
            $("<button id='clearBox'>No</button>").insertAfter("#confirmImport");
            return;
        }

        try {
            // Check if ethers is loaded
            if (typeof ethers === 'undefined' || typeof ethers.utils === 'undefined') {
                throw new Error('Ethers.js library not loaded. Please refresh the page.');
            }

            psp.passcode = $("#importBrainTxt").val();
            
            if (!psp.passcode || psp.passcode.trim() === '') {
                throw new Error('Please enter a brain wallet passcode');
            }
            
            // Generate Ethereum wallet from brain wallet passcode
            var entropyHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(psp.passcode));
            
            // Create private key from hash (32 bytes)
            var privateKey = ethers.utils.hexlify(ethers.utils.arrayify(entropyHash).slice(0, 32));
            
            // Create Ethereum wallet from private key
            var ethWallet = new ethers.Wallet(privateKey);
            
            if (!ethWallet || !ethWallet.address) {
                throw new Error('Failed to generate wallet address');
            }
            
            var address = ethWallet.address;

            psp.address = address;
        } catch (error) {
            console.error('Error importing brain wallet:', error);
            console.error('Error details:', error.stack);
            setMsg("Error importing brain wallet: " + error.message);
            return;
        }

        $("#password").hide();
        $("#preparePassword").show();

        this.encrypted = false;
        this.txSec = "";

        chrome.storage.local.set(
        {
            'code': psp.passcode,
            'encrypted': false,
            'address': address
        }, function ()
        {
            psp.open();
        });

        setMsg("Brainwallet imported succesfully!");
    }
};

function popup(txt)
{
    setGPGMsg('<textarea id="gpgBox" readonly></textarea>');
    $("#gpgBox").val(txt);
}

function popupMsg(txt)
{
    // txt = txt.replace(/\n/g, '<br />');

    setGPGMsg('<div id="messageBox">' + txt + '</div>');
}

$(document).ready(function ()
{
    var code = window.location.hash;
});

Date.prototype.format = function (format) //author: meizz
{
    var o = {
        "M+": this.getMonth() + 1, //month
        "d+": this.getDate(), //day
        "H+": this.getHours(), //hour
        "h+": ((this.getHours() % 12)==0)?"12":(this.getHours() % 12), //hour
        "z+": ( this.getHours()>11 )?"pm":"am", //hour
        "m+": this.getMinutes(), //minute
        "s+": this.getSeconds(), //second
        "q+": Math.floor((this.getMonth() + 3) / 3), //quarter
        "S": this.getMilliseconds() //millisecond
    }

    if (/(y+)/.test(format)) format = format.replace(RegExp.$1, (this.getFullYear() + "").substr(4 - RegExp.$1.length));
    for (var k in o)
        if (new RegExp("(" + k + ")").test(format))
            format = format.replace(RegExp.$1,
                RegExp.$1.length == 1 ? o[k] :
                ("00" + o[k]).substr(("" + o[k]).length));
    return format;
}

function formatMoney(x)
{
    return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}



function htmlEncode(value)
{
    //create a in-memory div, set it's inner text(which jQuery automatically encodes)
    //then grab the encoded contents back out.  The div never exists on the page.

    return $('<div/>').text(value).html();
}

function s2hex(s)
{
    return Bitcoin.convert.bytesToHex(Bitcoin.convert.stringToBytes(s))
}

function playBeep()
{
    var snd = document.getElementById('noise');
    snd.src = 'balance.wav';
    snd.load();
    snd.play();
}

function playBaron()
{
    var snd = document.getElementById('noise');
    psp.snd = snd;
    snd.src = 'baron.mp3';
    snd.load();
    snd.play();
}

function playTurn()
{
    var snd = document.getElementById('noise');
    psp.snd = snd;
    snd.src = 'turn.mp3';
    snd.load();
    snd.play();
}

String.prototype.startsWith = function(text) {
    return (this.length >= text.length && this.substring(0, text.length) === text);
}

function ajax(url,success,data) {
    var xhr = new XMLHttpRequest();
    xhr.onreadystatechange = function () {
        if (xhr.readyState == 4) {
            if (xhr.status === 200) {
                success(xhr.responseText);
                xhr.close;
            } else {
                // Blockchain.info weirdness... This isn't actually a server error, but a 'no results'

                if ( psp.sweeping != "" )
                {
                    alert("Blockchain error...")
                    this.sweeping = "";
                    $('#settingsModal').modal('hide')

                }


                if (url.startsWith('https://blockchain.info/unspent') && xhr.status === 500 && xhr.responseText === "No free outputs to spend") {
                } else {
                    setMsg("Server Error: Please try again later (some transactions may require waiting until 1 confirmation)", false, true);
                    // console.log('ajax error', xhr);
                }
            }
        }
    }


    xhr.open(data ? "POST" : "GET", url, true);

    if (data) xhr.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');
    xhr.send(data);



}

function tx_fetch(url, onSuccess, onError, postdata)
{
    $.ajax(
    {
        url: url,
        data: postdata || '',
        type: "POST",
        success: function (res)
        {
            onSuccess(JSON.stringify(res));
        },
        error: function (xhr, opt, err)
        {
            // console.log("error!");
        }
    });
}

function setMsg( msg, green, dontHide )
{
    $("#errorBox").slideDown();
    $("#errorBox").html(msg);

    if (green) {
        $("#errorBox").addClass("green");
    } else {
        $("#errorBox").removeClass("green");
    }

    if (!dontHide) {
        setTimeout(function () {
            $("#errorBox").slideUp();
        }, 5000);
    }
}




function generateQRCode(str) {

    document.getElementById("qrcode").innerHTML ="";


    // Create a new instance of QRCode
    var qrcode = new QRCode(document.getElementById("qrcode"), {

        text: str,

        width: 300,

        height: 300,

        colorDark : "#000000",

        colorLight : "#ffffff",

        correctLevel : QRCode.CorrectLevel.H
    });

    // Get the canvas element where the QR code is rendered
    var canvas = document.getElementById("qrcode").getElementsByTagName("canvas")[0];


    return canvas.toDataURL("image/png");



}


