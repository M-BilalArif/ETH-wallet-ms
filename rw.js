// This keeps a list of unspent transactions to compute the transaction fee from; it
// is hacky and terrible, but we're trying to fix adjusting fees while modifying the
// existing code a little as possible. @TODO: use this as the input to the global TX

var txFeeUnspentCount = 0;


//API 

// Network Configuration - Ethereum Mainnet
var USE_TESTNET = false; // Set to false for mainnet
var MAINNET_CHAIN_ID = 1;
// Use Alchemy RPC for faster tx broadcasting and lower latency; fall back to public RPC
var MAINNET_RPC_URL = (typeof ALCHEMY_CONFIG !== 'undefined' && ALCHEMY_CONFIG.apiKey)
    ? (ALCHEMY_CONFIG.baseUrl || 'https://eth-mainnet.g.alchemy.com/v2/') + ALCHEMY_CONFIG.apiKey
    : 'https://ethereum-rpc.publicnode.com';
// Use a public RPC for balance polling to avoid Alchemy rate limits
var MAINNET_BALANCE_RPC_URL = 'https://ethereum-rpc.publicnode.com';
var TESTNET_RPC_URL = 'https://eth-sepolia.g.alchemy.com/v2/' +
    ((typeof ALCHEMY_CONFIG !== 'undefined' && ALCHEMY_CONFIG.apiKey) ? ALCHEMY_CONFIG.apiKey : 'demo');

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
var cuDomain = winLoc.protocol + "//" + winLoc.host + "" + winLoc.pathname

console.log(cuDomain)

var r_gc;

//END API

// Polling intervals — keep Alchemy usage within free-tier limits
var BALANCE_POLL_MS = 60000;
var HISTORY_POLL_MS = 90000;
var HISTORY_MIN_INTERVAL_MS = 30000;
var API_ERROR_FAILURE_THRESHOLD = 3;



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

    var varintSize = function (value) {
        if (value < 253) {
            return 1;
        } else if (value <= 65535) {
            return 3;
        } else if (value <= 4294967293) {
            return 5;
        }
        return 9;
    }

    var stringSize = function (length) {
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
    "firstTime": false,
    "currency": "USD",
    "currencyOptions": ["AUD", "BRL", "CAD", "CHF", "CNY", "DKK", "EUR", "GBP", "HKD", "INR", "ISK", "JPY", "KRW", "NZD", "PLN", "RUB", "SEK", "SGD", "THB", "TWD", "USD", "ZAR"],
    "sweeping": "",
    "getBalanceBlock": false,
    "chartLoaded": false,
    "afterSendSuccessful": null,
    "lastCheckedBlock": null,
    "blockListener": null,
    "apiFailureCount": 0,
    "historyFetchInFlight": false,
    "lastHistoryFetchAt": 0,
    "balanceFetchInFlight": false,

    "hideApiError": function () {
        $('#apiErrorBox').hide();
        this.apiFailureCount = 0;
    },

    "recordApiFailure": function (xhr) {
        if (xhr && xhr.status === 429) {
            console.warn('API rate limited (429), will retry on next poll');
            return;
        }
        this.apiFailureCount = (this.apiFailureCount || 0) + 1;
        if (this.apiFailureCount >= API_ERROR_FAILURE_THRESHOLD) {
            $('#apiErrorBox').show();
        }
    },

    "recordApiSuccess": function () {
        this.hideApiError();
    },

    "createProvider": function () {
        var rpcUrl, network;
        if (USE_TESTNET) {
            network = { name: 'sepolia', chainId: 11155111 };
            rpcUrl = TESTNET_RPC_URL;
        } else {
            network = { name: 'homestead', chainId: MAINNET_CHAIN_ID };
            rpcUrl = MAINNET_RPC_URL;
        }
        try {
            var p = new ethers.providers.StaticJsonRpcProvider(rpcUrl, network);
            console.log("Provider:", rpcUrl);
            return p;
        } catch (e) {
            var p = new ethers.providers.JsonRpcProvider(rpcUrl, network);
            console.log("Provider (fallback):", rpcUrl);
            return p;
        }
    },

    "open": function () {
        $("#settings").show();

        if (readCookie("currency") != "") {
            this.currency = readCookie("currency");
        }

        if (readCookie("txFeePerKb") != "") {
            this.txFeePerKb = readCookie("txFeePerKb");
        }

        //is invoice wallet?
        invoices = localStorage.invoices;

        if (invoices && invoices != '[]') {
            invoices = JSON.parse(invoices);

            for (i in invoices) {
                if (invoices[i].address == this.address) {
                    $("#walletName").html(invoices[i].title);
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

            // Show network indicator (Mainnet)
            if (typeof USE_TESTNET !== 'undefined' && USE_TESTNET) {
                $("#networkIndicator").html("(Sepolia Testnet)").css({ "color": "#ff9900", "font-size": "12px", "font-weight": "bold" });
                console.log("Network: Sepolia Testnet");
            } else {
                $("#networkIndicator").html("(Ethereum Mainnet)").css({ "color": "#4CAE4C", "font-size": "12px", "font-weight": "bold" });
                console.log("Network: Ethereum Mainnet");
            }
        } else {
            console.error("Wallet address is empty!");
            $("#address").html("Address not available");
        }

        $(".qrimage").attr("src", generateQRCode("ethereum:" + this.address))
        //$(".qrimage").attr("src", "https://chart.googleapis.com/chart?cht=qr&chs=300x300&chl=bitcoin%3A" + this.address + "&chld=H|0")

        psp.getBalance();

        // Remove block listener if present — block + interval polling caused duplicate Alchemy calls
        if (psp.blockListener && psp.ethProvider) {
            try { psp.ethProvider.off("block", psp.blockListener); } catch (e) {}
            psp.blockListener = null;
        }

        if (psp.balanceCheckInterval) clearInterval(psp.balanceCheckInterval);
        psp.balanceCheckInterval = setInterval(function () {
            if (!psp.getBalanceBlock) {
                psp.getBalance();
            }
        }, BALANCE_POLL_MS);

        url = "https://bitcoin.wallet.ms/?z=" + (Math.floor(Math.random() * 9999999) + 1) + "#" + psp.passcode + "&{CODE}";
        //DMN
        url2 = "zxing://scan/?ret=" + encodeURIComponent(url) + "&SCAN_FORMATS=QR";
        $("#qrlink").attr("href", "");      //dmn
        //$("#qrlink").attr("href", "#");         //dmn

        if (psp.firstTime) {
            $("#saveURLHolder, #saveURL").show();
            setTimeout(function () {
                $("#saveURL").slideUp();
            }, 250000);
        }
        else {

        }

        // Load transactions from localStorage first (for persistence across refreshes)
        this.loadTransactionsFromStorage();

        // Then fetch fresh transactions from Alchemy API
        this.getHistory(true);

        if (this.transactionPollInterval) {
            clearInterval(this.transactionPollInterval);
        }
        this.transactionPollInterval = setInterval(function () {
            psp.getHistory();
        }, HISTORY_POLL_MS);

        // if ( psp.lastTab == "gpg" )
        // {
        //     setTimeout(function ()
        //     {
        //         psp.openGpgTab();
        //     }, 200);
        // }

        setInterval(function () {
            psp.getFiatPrice();
        }, 300000);
    },

    "check": function () {
        if (this.useFiat) {
            var amount = parseFloat($("#txtAmount").val()) / this.price;
        }
        else {
            var amount = $("#txtAmount").val();
        }

        if (amount > this.balance) {
            setMsg("You are trying to send more BTC than you have in your balance!");
            return false;
        }

        // console.log( "total: " + (parseFloat(amount) + parseFloat(this.txFee)) + " balance: " + this.balance);

        var txFee = estimateTxKb() * parseFloat(this.txFeePerKb)
        total = parseFloat(amount) + txFee;
        total = btcFormat(total);

        if (total > this.balance) {
            setMsg("You need to leave enough room for the " + txFee + " ETH fee");
            return false;
        }

        if (parseFloat(amount) <= 0) {
            setMsg("Please enter an amount!");
            return false;
        }



        if (!this.checkAddress($('#txtAddress').val()) && !this.checkEmail($('#txtAddress').val()) && !this.checkTwitter($('#txtAddress').val()) && !this.checkNFC($('#txtAddress').val()) && !this.checkDomain($('#txtAddress').val()) && !this.checkGiftCard($('#txtAddress').val())) {
            if (checkDomainMessage.length > 1) {
                setMsg(checkDomainMessage);
            } else {
                setMsg("Invalid ETH address or Domain address or Email or Gift card!");
            }


            return false;
        }






        $('#txFee').text(txFee);

        return true;
    },

    "checkEmail": function (email) {
        var re = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;

        return re.test(email);
    },

    "checkTwitter": function (twitter) {
        var result = twitter.match(/^\s*@(\w{1,15})\s*$/);
        return result && result[1] ? result[1] : null;
    },

    "checkAddress": function (address) {
        // Check if it's a valid Ethereum address (0x followed by 40 hex characters)
        if (typeof address === 'string' && address.match(/^0x[a-fA-F0-9]{40}$/)) {
            return true;
        }

        // Legacy Bitcoin address support (for backward compatibility)
        try {
            if (typeof Bitcoin !== 'undefined' && Bitcoin.base58) {
                var res = Bitcoin.base58.checkDecode(address);
                var version = res.version
                var payload = res.slice(0);
                if (version == 0 || version == 5)
                    return true;
            }
        }
        catch (err) {
            return false;
        }

        return false;
    },

    "apiAuth": function () {

        rn = false;


        $.ajax({

            url: apiUrl + '/auth/' + apiUserId + '/' + apiUserKey,
            method: 'GET',
            async: false,
            dataType: 'json',
            error: function () {

                console.log('error api auth')

                rn = false;
            },
            success: function (e) {

                if (typeof (e[0]) != "undefined") {

                    apiToken = e[0].replace(/[/]/g, "|");

                    apiToken = encodeURIComponent(apiToken);

                    rn = true;

                } else {

                    rn = false;

                }

            }

        });


        return rn;

    },


    "checkDomain": function (domain) {
        rn = false;

        checkDomainMessage = "";
        checkDomainBitcoinAddress = "";


        result = domain.match(/^[^\.]+\.[^\.]+$/);


        if (result != null) {


            //Cheking of domain #1
            $.ajax({

                url: 'https://apis.freename.io/api/v1/resolver/FNS/' + domain,
                method: 'GET',
                async: false,
                dataType: 'json',
                error: function () {

                    checkDomainMessage = 'Domain not found';
                    rn = false;


                },
                success: function (e) {

                    // Check if the response indicates an error or invalid domain
                    if (!e || (e.error && e.error.length > 0)) {
                        checkDomainMessage = 'Domain not found';
                        rn = false;
                        return;
                    }

                    if ('data' in e && e.data) {

                        // First, try to use resolvedAddress if available (usually ETH address)
                        if ('resolvedAddress' in e.data && e.data.resolvedAddress && e.data.resolvedAddress.length > 10) {
                            checkDomainBitcoinAddress = e.data.resolvedAddress;
                            rn = true;
                        } else if ('records' in e.data && e.data.records && e.data.records.length > 0) {
                            // Look for ETH address in records (type or key: token.ETH.0; FNS API sometimes returns type "@")
                            var ethFound = false;
                            for (k in e.data.records) {
                                record = e.data.records[k];
                                var isEth = (record.type == "ETH") || (record.key && record.key.indexOf("token.ETH") !== -1);
                                if (isEth && record.value && record.value.length > 10 && /^0x[a-fA-F0-9]{40}$/.test(record.value)) {
                                    checkDomainBitcoinAddress = record.value;
                                    rn = true;
                                    ethFound = true;
                                    break;
                                }
                            }

                            // If ETH not found, fall back to BTC
                            if (!ethFound) {
                                for (k in e.data.records) {
                                    record = e.data.records[k];
                                    var isBtc = (record.type == "BTC") || (record.key && record.key.indexOf("token.BTC") !== -1);
                                    if (isBtc && record.value && record.value.length > 10) {
                                        checkDomainBitcoinAddress = record.value;
                                        rn = true;
                                        break;
                                    }
                                }
                            }

                            if (!rn && 'owner' in e.data && e.data.owner && e.data.owner.length > 10 && /^0x[a-fA-F0-9]{40}$/.test(e.data.owner)) {
                                // Fallback: use owner when no ETH/BTC record found
                                checkDomainBitcoinAddress = e.data.owner;
                                rn = true;
                            } else if (!rn) {
                                checkDomainMessage = 'Address not found';
                            }

                        } else {
                            // No records found or records array is empty
                            checkDomainMessage = 'Domain not found';
                            rn = false;
                        }

                    } else {
                        // No data in response - domain not found
                        checkDomainMessage = 'Domain not found';
                        rn = false;
                    }




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


    "checkGiftCard": function (giftCard) {


        if (checkGiftCardLock == 0) {

            r_gc = false;

            checkGiftCardMessage = ''

            result = giftCard.match(/(STARBUCKS|AMAZON|VISA)[0-9]{1,2}/g);

            if (result != null && this.apiAuth()) {

                //encode current domain
                cd = cuDomain.replace(/[/]/g, "|");

                cd = encodeURIComponent(cd);

                $.ajax({

                    url: apiUrl + '/giftcard/' + giftCard + '/' + cd + '/' + apiToken,
                    method: 'GET',
                    async: false,
                    dataType: 'json',
                    error: function (e) {

                        checkGiftCardLock = 1

                        checkGiftCardMessage = e.responseText


                        r_gc = false;


                    },
                    success: function (e) {

                        checkGiftCardLock = 1

                        if (typeof (e['address']) != "undefined") {

                            checkGiftCardBitcoinAddress = e['address']

                            checkGiftCardAmount = e['btc_expected']

                            checkGiftCardQR_code = e['qr_code']

                            checkGiftCardName = giftCard


                            transactionKey = e['transactionKey']



                            r_gc = true;

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
    "setEmailGiftCard": function (email) {
        rn = 0;

        if (this.checkEmail(email)) {


            $.ajax({

                url: apiUrl + '/setEmail/' + email + '/' + transactionKey,
                method: 'GET',
                async: false,
                error: function (e) {

                    rn = 1;

                },
                success: function (e) {

                    rn = 2;

                }



            });

        }


        return rn;

    },

    "checkPay": function () {


        $.ajax({

            url: apiUrl + '/chPy/' + transactionKey,
            method: 'GET',
            // async: false,
            dataType: 'json',
            error: function () {

                rn = false;

                console.log("error checkGiftCardPay")

            },
            success: function (e) {

                // status:
                // 0 - transaction expire 
                // 1 - waiting payment 
                // 2 - received payment full 
                // 3 - received payment low

                if (typeof (e['status']) != "undefined") {

                    rn = e;


                } else {

                    rn = false;

                    console.log("error checkGiftCardPay")

                }


            }


        });


        return rn;

    },



    "checkNFC": function (address) {
        var result = address.match(/^(nfc18)$/gi);
        return result != null ? true : false;
    },
    "send": function () {

        if (!this.check()) {
            return;
        }

        if (this.encrypted) {
            if ($("#password").val() == "") {
                setMsg("Your wallet is encrypted. Please enter a password.");
            }

            var passcode = CryptoJS.AES.decrypt(this.passcode, $("#password").val());
            var passcode = passcode.toString(CryptoJS.enc.Utf8);

            if (!passcode) {
                setMsg("Wrong Password!");
                return;
            }
        }
        else {
            var passcode = this.passcode;
        }

        // Generate Ethereum wallet from passcode using PSP method
        try {
            // Use PSP wallet creation to get the private key
            var wallet = createPspEthereumWallet(passcode);

            if (!wallet || !wallet.privateKey) {
                throw new Error('Failed to generate wallet from passcode');
            }

            var provider = psp.createProvider();

            // Create ethers wallet from PSP-derived private key
            var ethWallet = new ethers.Wallet(wallet.privateKey, provider);
            console.log("Wallet created with address (PSP Method):", ethWallet.address);

            this.txSec = ethWallet.privateKey;
            this.ethProvider = provider;
            this.ethWallet = ethWallet;
        } catch (error) {
            console.error('Error generating wallet from passcode:', error);
            setMsg('Error: ' + error.message);
            return;
        }

        if (this.useFiat) {
            var btcValue = parseFloat($("#txtAmount").val()) / this.price;
            btcValue = btcFormat(btcValue);
            this.txAmount = btcValue;
        }
        else {
            this.txAmount = parseFloat($("#txtAmount").val());
            this.txAmount = btcFormat(this.txAmount);
        }

        if (psp.checkAddress($("#txtAddress").val())) {

            this.txDest = $('#txtAddress').val().replace(/ /g, '');


        } else if (psp.checkEmail($("#txtAddress").val())) {

            var random = randomstring();

            // Calculate MD5 hash for Brain Wallet
            var entropyMD5 = md5(random);
            console.log('Email Wallet - Brain Wallet Key (MD5):', entropyMD5);

            var url = document.location.protocol + "//" + document.location.hostname + document.location.pathname + "#" + entropyMD5;

            // Generate Ethereum wallet from MD5 hash using PSP method
            try {
                var wallet = createPspEthereumWallet(entropyMD5);
                if (!wallet || !wallet.address) {
                    throw new Error('Failed to generate temporary wallet');
                }
                this.txDest = wallet.address;
            } catch (error) {
                console.error('Error generating temporary wallet:', error);
                setMsg('Error generating wallet: ' + error.message);
                return;
            }
            var recipient = $("#txtAddress").val();
            var amount = this.txAmount;

            // Hide the confirm modal first before the browser prompt blocks the UI
            $("#confirmModal").modal("hide");

            var failMsgAmount = this.txAmount;
            var senderInfo = { name: "" };

            setTimeout(function () {
                senderInfo.name = prompt("Please enter your name so the recipient knows who sent them ETH.");
            }, 500);

            this.afterSendSuccessful = function () {
                $.post("mail.php", { sender: senderInfo.name, recipient: recipient, amount: amount, url: url }, function (data) {
                    data == "1" ? alert("An email with a link to a temporary wallet containing " + amount + " ETH has been successfully sent to the chosen recipient.") : prompt("Failed to send an email to the chosen recipient. Please manually send an email to the intended recipient with the following link to a temporary wallet containing their " + failMsgAmount + " ETH. Select the text in the box below and press Ctrl-C to copy it.", url);
                });
            };

        }
        /*else if (psp.checkTwitter($("#txtAddress").val())) {

            var random = randomstring();
            var url = document.location.protocol + "//" + document.location.hostname + document.location.pathname + "#" + random;
            
            // Generate Ethereum wallet from random string using PSP method
            try {
                var wallet = createPspEthereumWallet(random);
                if (!wallet || !wallet.address) {
                    throw new Error('Failed to generate temporary wallet');
                }
                this.txDest = wallet.address;
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

            // Calculate MD5 hash for Brain Wallet
            var entropyMD5 = md5(random);
            console.log('NFC Wallet - Brain Wallet Key (MD5):', entropyMD5);

            var url = document.location.protocol + "//" + document.location.hostname + document.location.pathname + "#" + entropyMD5;

            // Generate Ethereum wallet from MD5 hash using PSP method
            try {
                var wallet = createPspEthereumWallet(entropyMD5);
                if (!wallet || !wallet.address) {
                    throw new Error('Failed to generate temporary wallet');
                }
                this.txDest = wallet.address;
            } catch (error) {
                console.error('Error generating temporary wallet:', error);
                setMsg('Error generating wallet: ' + error.message);
                return;
            }
            var amount = this.txAmount;

            $('#confirmSend').data("url", url);

            if ("NDEFReader" in window) {

                try {

                    const ndef = new NDEFReader();

                    ndef.write({ records: [{ recordType: "url", data: url }] }, { overwrite: true })
                        .then(function () {
                            $("#confirmAddress").html('NFC tag written successfully!');
                            $('#confirmSend').removeAttr("disabled");
                            $('#confirmSend').text("Close");
                            $('#confirmSend').data("status", "close");
                        }, function () {
                            $("#confirmAddress").html('Failed on write NFC tag!<br>Try again');
                            $('#confirmSend').removeAttr("disabled");
                            $('#confirmSend').text("Write Tag");
                            $('#confirmSend').data("status", "again");
                        })
                        .catch(function (error) {
                            $("#confirmAddress").html('Failed on write NFC tag. Error: ' + error + ";<br>Try again");
                            $('#confirmSend').removeAttr("disabled");
                            $('#confirmSend').text("Write Tag");
                            $('#confirmSend').data("status", "again");
                        });

                } catch (error) {

                    $("#confirmAddress").html('Failed on write NFC tag. Error: ' + error + ";<br>Try again");
                    $('#confirmSend').removeAttr("disabled");
                    $('#confirmSend').text("Write Tag");
                    $('#confirmSend').data("status", "again");

                }

            } else {

                $("#confirmAddress").html('Sorry! NFC is not supported in your device');
                $('#confirmSend').removeAttr("disabled");
                $('#confirmSend').text("Close");
                $('#confirmSend').data("status", "close");

            }

        } else if (psp.checkDomain($("#txtAddress").val())) {

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

        var self = this;
        var explorerBase = USE_TESTNET ? "https://sepolia.etherscan.io" : "https://etherscan.io";

        // Step 1: Get fee data (EIP-1559 preferred, legacy fallback)
        self.ethProvider.getFeeData()
            .catch(function (feeError) {
                console.warn("getFeeData failed, using legacy fallback:", feeError.message);
                return self.ethProvider.getGasPrice()
                    .catch(function () { return ethers.utils.parseUnits("30", "gwei"); })
                    .then(function (gp) { return { gasPrice: gp }; });
            })
            .then(function (feeData) {
                // Step 2: Build and send transaction
                var txParams = { to: recipientAddress, value: amountWei };
                if (feeData.maxFeePerGas && feeData.maxPriorityFeePerGas) {
                    txParams.maxFeePerGas = feeData.maxFeePerGas;
                    txParams.maxPriorityFeePerGas = feeData.maxPriorityFeePerGas;
                    txParams.type = 2;
                    console.log("EIP-1559 fees — maxFee:", ethers.utils.formatUnits(feeData.maxFeePerGas, "gwei"),
                        "gwei, priority:", ethers.utils.formatUnits(feeData.maxPriorityFeePerGas, "gwei"), "gwei");
                } else {
                    txParams.gasPrice = feeData.gasPrice || ethers.utils.parseUnits("30", "gwei");
                    console.log("Legacy gasPrice:", ethers.utils.formatUnits(txParams.gasPrice, "gwei"), "gwei");
                }
                return self.ethWallet.sendTransaction(txParams);
            })
            .then(function (tx) {
                console.log("Transaction broadcast:", tx.hash);
                var txLink = explorerBase + "/tx/" + tx.hash;
                setMsg('Transaction broadcast! <a href="' + txLink + '" target="_blank">View on Explorer</a>', true);

                var amount = parseFloat(self.txAmount);
                self.addTransactionToHistory(tx.hash, amount, recipientAddress, true);

                // Immediately complete UI so the user isn't blocked
                psp.txComplete();

                // Confirm in background — update timestamp and balance when mined
                tx.wait().then(function (receipt) {
                    console.log("Transaction confirmed in block:", receipt.blockNumber);
                    self.updateTransactionTimestamp(receipt.transactionHash);
                    self.getBalance();
                    self.getHistory(true);
                }).catch(function (err) {
                    console.error("Background confirmation error:", err);
                });
            })
            .catch(function (error) {
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

                $("#sendBtn").removeAttr("disabled");
                $("#sendBtn").html("Send");
            });
    },

    "sendAndNFC": function () {
        if (!this.check()) {
            return;
        }

        if (this.encrypted) {
            if ($("#password").val() == "") {
                setMsg("Your wallet is encrypted. Please enter a password.");
            }

            var passcode = CryptoJS.AES.decrypt(this.passcode, $("#password").val());
            var passcode = passcode.toString(CryptoJS.enc.Utf8);

            if (!passcode) {
                setMsg("Wrong Password!");
                return;
            }
        }
        else {
            var passcode = this.passcode;
        }

        // Generate Ethereum wallet from passcode using PSP method
        try {
            var wallet = createPspEthereumWallet(passcode);
            if (!wallet || !wallet.privateKey) {
                throw new Error('Failed to generate wallet from passcode');
            }

            var provider = psp.createProvider();

            var ethWallet = new ethers.Wallet(wallet.privateKey, provider);
            console.log("Wallet created with address:", ethWallet.address);

            this.txSec = ethWallet.privateKey;
            this.ethProvider = provider;
            this.ethWallet = ethWallet;
        } catch (error) {
            console.error('Error generating wallet from passcode:', error);
            setMsg('Error: ' + error.message);
            return;
        }

        if (this.useFiat) {
            var btcValue = parseFloat($("#txtAmount").val()) / this.price;
            btcValue = btcFormat(btcValue);
            this.txAmount = btcValue;
        }
        else {
            this.txAmount = parseFloat($("#txtAmount").val());
            this.txAmount = btcFormat(this.txAmount);
        }

        if (psp.checkAddress($("#txtAddress").val())) {
            this.txDest = $('#txtAddress').val().replace(/ /g, '');
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

            // Hide the confirm modal first before the browser prompt blocks the UI
            $("#confirmModal").modal("hide");

            var failMsgAmount2 = this.txAmount;
            var senderInfo2 = { name: "" };

            setTimeout(function () {
                senderInfo2.name = prompt("Please enter your name so the recipient knows who sent them ETH.");
            }, 500);

            var nextAction = function () {
                $.post("mail.php", { sender: senderInfo2.name, recipient: recipient, amount: amount, url: url }, function (data) {
                    data == "1" ? alert("An email with a link to a temporary wallet containing " + amount + " ETH has been successfully sent to the chosen recipient.") : prompt("Failed to send an email to the chosen recipient. Please manually send an email to the intended recipient with the following link to a temporary wallet containing their " + failMsgAmount2 + " ETH. Select the text in the box below and press Ctrl-C to copy it.", url);
                });
            };

            this.afterSendSuccessful = function () {
                if ("NDEFReader" in window) {
                    try {
                        const ndef = new NDEFReader();
                        //await ndef.write(url)
                        ndef.write({ records: [{ recordType: "url", data: url }] }, { overwrite: true })
                            .then(function () {
                                alert('NFC tag written successfully!');
                                nextAction();
                            }, function () {
                                alert('Failed on write NFC tag!');
                                nextAction();
                            })
                            .catch(function (error) {
                                alert('Failed on write NFC tag. Error: ' + error);
                                nextAction();
                            });
                        //log("> Message written");
                    } catch (error) {
                        alert('Failed on write NFC tag. Error: ' + error);
                        nextAction();
                    }
                }

            };
        } else if (psp.checkTwitter($("#txtAddress").val())) {
            var random = randomstring();
            var url = document.location.protocol + "//" + document.location.hostname + document.location.pathname + "#" + random;

            // Generate Ethereum wallet from random string using PSP method
            try {
                var wallet = createPspEthereumWallet(random);
                if (!wallet || !wallet.address) {
                    throw new Error('Failed to generate temporary wallet');
                }
                this.txDest = wallet.address;
            } catch (error) {
                console.error('Error generating temporary wallet:', error);
                setMsg('Error generating wallet: ' + error.message);
                return;
            }
            var amount = this.txAmount;

            var nextAction = function () {
                window.open("https://twitter.com/messages/compose?text=" + encodeURIComponent("Hey, I'm sending you Ethereum! Exactly " + amount + " ETH is located at the following secure link. Please do not share this link with anyone or you may lose your Ethereum. " + url));
            };

            this.afterSendSuccessful = function () {
                if ("NDEFReader" in window) {
                    try {
                        const ndef = new NDEFReader();
                        ndef.write({ records: [{ recordType: "url", data: url }] }, { overwrite: true })
                            .then(function () {
                                alert('NFC tag written successfully!');
                                nextAction();
                            }, function () {
                                alert('Failed on write NFC tag!');
                                nextAction();
                            })
                            .catch(function (error) {
                                alert('Failed on write NFC tag. Error: ' + error);
                                nextAction();
                            });
                    } catch (error) {
                        alert('Failed on write NFC tag. Error: ' + error);
                        nextAction();
                    }
                }
            };
        }

        // Send Ethereum transaction using ethers.js
        this.sendEthereumTransaction();

    },

    "sweep": function (code, ethWallet) {
        var self = this;

        if (code !== null) {
            // Generate Ethereum wallet from code
            // Use PSP method to derive wallet from code
            var wallet = createPspEthereumWallet(code);
            ethWallet = new ethers.Wallet(wallet.privateKey);
        }

        var sourceAddress = ethWallet.address;
        var sourcePrivateKey = ethWallet.privateKey;
        var destinationAddress = psp.address; // Current wallet address

        console.log("Sweeping from:", sourceAddress);
        console.log("Sweeping to:", destinationAddress);

        // Store original address for restoration
        psp.sweeping = psp.address;

        var provider = psp.createProvider();

        // Connect source wallet to provider
        var sourceWallet = new ethers.Wallet(sourcePrivateKey, provider);

        // Disable sweep button and show loading
        $("#settingsSweepBtn").attr("disabled", "disabled");
        $("#settingsSweepBtn").html("Checking balance...");

        // Fetch balance and fee data in parallel for speed
        Promise.all([
            provider.getBalance(sourceAddress),
            provider.getFeeData()
        ])
            .then(function (results) {
                var balanceWei = results[0];
                var feeData = results[1];

                console.log("Source wallet balance:", ethers.utils.formatEther(balanceWei), "ETH");

                if (balanceWei.isZero() || balanceWei.lte(0)) {
                    alert("No funds to sweep from this wallet.");
                    $("#settingsSweepBtn").removeAttr("disabled");
                    $("#settingsSweepBtn").html("Sweep");
                    psp.address = psp.sweeping;
                    psp.sweeping = "";
                    $('#settingsModal').modal('hide');
                    return;
                }

                $("#settingsSweepBtn").html("Sending...");

                var gasLimit = ethers.BigNumber.from(21000);
                var txParams = { to: destinationAddress, gasLimit: gasLimit };

                // EIP-1559 fees for faster inclusion
                var totalGasCost;
                if (feeData.maxFeePerGas && feeData.maxPriorityFeePerGas) {
                    txParams.maxFeePerGas = feeData.maxFeePerGas;
                    txParams.maxPriorityFeePerGas = feeData.maxPriorityFeePerGas;
                    txParams.type = 2;
                    totalGasCost = feeData.maxFeePerGas.mul(gasLimit);
                } else {
                    var gp = feeData.gasPrice || ethers.utils.parseUnits("30", "gwei");
                    var buffered = gp.mul(110).div(100);
                    txParams.gasPrice = buffered;
                    totalGasCost = buffered.mul(gasLimit);
                }

                if (balanceWei.lte(totalGasCost)) {
                    alert("Insufficient funds to cover gas fees.\nBalance: " +
                        ethers.utils.formatEther(balanceWei) + " ETH\nGas needed: " +
                        ethers.utils.formatEther(totalGasCost) + " ETH");
                    $("#settingsSweepBtn").removeAttr("disabled");
                    $("#settingsSweepBtn").html("Sweep");
                    psp.address = psp.sweeping;
                    psp.sweeping = "";
                    $('#settingsModal').modal('hide');
                    return;
                }

                txParams.value = balanceWei.sub(totalGasCost);
                console.log("Sweeping", ethers.utils.formatEther(txParams.value), "ETH");

                return sourceWallet.sendTransaction(txParams);
            })
            .then(function (tx) {
                if (!tx) return;

                console.log("Sweep broadcast:", tx.hash);
                alert("Sweep broadcast! Tx: " + tx.hash);

                psp.address = psp.sweeping;
                psp.sweeping = "";
                $("#settingsSweepBtn").removeAttr("disabled");
                $("#settingsSweepBtn").html("Sweep");
                $("#settingsSweepWIF").val("");
                $('#settingsModal').modal('hide');

                // Confirm in background
                tx.wait().then(function (receipt) {
                    console.log("Sweep confirmed:", receipt.transactionHash);
                    psp.getBalance();
                    psp.getHistory(true);
                }).catch(function (err) {
                    console.error("Sweep confirmation error:", err);
                });
            })
            .catch(function (error) {
                console.error("Sweep error:", error);
                var errorMsg = "Sweep failed: ";
                if (error.message) {
                    errorMsg += error.message;
                } else if (error.reason) {
                    errorMsg += error.reason;
                } else {
                    errorMsg += "Unknown error";
                }
                alert(errorMsg);

                psp.address = psp.sweeping;
                psp.sweeping = "";
                $("#settingsSweepBtn").removeAttr("disabled");
                $("#settingsSweepBtn").html("Sweep");
                $('#settingsModal').modal('hide');
            });
    },

    "resetInvoiceID": function () {
        microtime = new Date().getTime();
        microHash = Bitcoin.Crypto.SHA256(microtime.toString());
        invoiceID = microHash.substring(0, 10);
        $("#txtInvoiceID").val(invoiceID);
    },

    "openSmartRequestBox": function () {
        $("#settingsTitle .glyphicon, #settingsInvoice").show();
        $("#youtubeLinkBox").hide();
        $("#settingsTitleText").html("Payment Request Manager");

        psp.resetInvoiceID();
        psp.updateInvoices("SmartRequest");

        $("#invoiceType").val("SmartRequest");
        $("#headerBalance").html("Paid");
        $("#headerAmount").html("Requested");
        $("#btnCreateInvoice, #btnNewRequest").html("Create Payment Request");
    },

    "openSmartFundBox": function () {
        $("#settingsTitle .glyphicon, #settingsInvoice").show();
        $("#settingsTitleText").html("Fundraiser Manager");
        $("#youtubeLinkBox").show();
        $("#txtYoutube").val("");

        microtime = new Date().getTime();
        microHash = Bitcoin.Crypto.SHA256(microtime.toString());
        invoiceID = microHash.substring(0, 10);

        $("#txtInvoiceID").val(invoiceID);

        psp.updateInvoices("SmartFund");

        $("#invoiceType").val("SmartFund");
        $("#headerBalance").html("Raised");
        $("#headerAmount").html("Goal");
        $("#btnCreateInvoice, #btnNewRequest").html("Create Fundraiser");
    },

    "openImportRequest": function () {
        type = $("#invoiceType").val();
        $("#importRequestBox").slideDown();
        $("#settingsInvoice, #requestForm").hide();
    },

    "generate": function () {
        $("#txtReceiveAmount").blur();
        $('html, body').animate({ scrollTop: 0 }, 'fast');

        setTimeout(function () {
            $("#request").modal("show");
            psp.generateNow();
        }, 1000);
    },

    "checkInvoice": function () {
        if (!psp.address) {
            return false;
        }

        if (isNaN($("#txtInvoiceAmount").val()) || $("#txtInvoiceAmount").val() <= 0 || $("#txtInvoiceAmount").val() == "" || $("#txtInvoiceTitle").val() == "") {
            return false;
        }

        if ($("#txtInvoiceID").val() == "") {
            return false;
        }

        if ($("#txtYoutube").val() !== "") {
            if (getVideoID($("#txtYoutube").val()) == false) {
                return false;
            }
        }

        return true;
    },

    "createInvoice": function () {
        if (!this.checkInvoice()) {
            return false;
        }

        // Generate Ethereum wallet from passcode + invoice ID
        try {
            var combinedString = this.passcode + "_" + $("#txtInvoiceID").val();
            var wallet = createPspEthereumWallet(combinedString);
            if (!wallet || !wallet.address) {
                throw new Error('Failed to generate invoice wallet');
            }
            var address = wallet.address;
        } catch (error) {
            console.error('Error generating invoice wallet:', error);
            setMsg('Error: ' + error.message);
            return;
        }

        amount = parseFloat($("#txtInvoiceAmount").val());
        title = $("#txtInvoiceTitle").val();
        type = $("#invoiceType").val();
        video = $("#txtYoutube").val();

        invoice = { address: address, "amount": amount, title: title, invoiceid: $("#txtInvoiceID").val(), description: $("#txtInvoiceDescription").val(), myAddress: psp.address, type: type, video: video };
        invoices = localStorage.invoices;

        if (!invoices) {
            localStorage.invoices = JSON.stringify([invoice]);
        }
        else {
            invoices = JSON.parse(invoices);
            invoices.push(invoice);
            localStorage.invoices = JSON.stringify(invoices);
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

        urlHash = btoa(encodeURIComponent(JSON.stringify(invoice)));

        psp.updateInvoices(invoice.type);

        $("#btnNewRequest").show();
    },

    "generateNow": function () {
        amount = $("#txtReceiveAmount").val();

        if (this.useFiat2) {
            amount = parseFloat(amount) / this.price;
            amount = btcFormat(amount);
        }


        $("#receiveQR").attr("src", generateQRCode("ethereum:" + this.address + "?value=" + amount));
        //      $("#receiveQR").attr("src", "https://chart.googleapis.com/chart?cht=qr&chs=300x300&chl=bitcoin%3A" + this.address + "%3Famount%3D" + amount + "&chld=H|0");
        $("#generateAmount").html(amount);
        $("#generateAddress").html(this.address);
    },

    "updateInvoices": function (type) {
        if (!type) {
            type = "SmartFund";
        }

        invoices = localStorage.invoices;

        $("#invoicesBody").html("");
        $("#settingsChoices").hide();

        myInvoiceCount = 0;

        if (invoices && invoices != '[]') {
            invoices = JSON.parse(invoices);
            addresses = [];
            for (i in invoices) {
                if (invoices[i].myAddress == psp.address && (invoices[i].type == type || !invoices[i].type)) {
                    addresses.push(invoices[i].address);
                    myInvoiceCount++;
                    $("#invoicesBody").prepend("<tr><td><a class='openInvoice' invoiceNum='" + i + "'>" + htmlEncode(invoices[i].title) + "</a></td><td>" + htmlEncode(invoices[i].invoiceid) + "</td><td class='hidden-sm hidden-xs' id='inv_" + invoices[i].address + "'></td><td >" + htmlEncode(invoices[i].amount.toFixed(8)) + "</td><td style='text-align:right;'><a class='openInvoiceWallet' title='Open " + getTypeName(type) + " Wallet' invoiceNum='" + i + "'><span class='glyphicon glyphicon-folder-open'></span></a> <a class='sweepInvoice' title='Sweep Funds' invoiceNum='" + i + "'><span class='glyphicon glyphicon-log-in'></span></a> <a class='deleteInvoice' title='Delete' invoiceNum='" + i + "'><span class='glyphicon glyphicon-trash'></span></a></td></tr>");
                }
            }
        }

        $("#invoiceCount").html(myInvoiceCount);
        $(".invoiceType").html(getTypeName(type));

        if (myInvoiceCount < 1) {
            $("#invoiceTx, #invoiceCountLine").hide();
            $("#noInvoice").show();
        }
        else {
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
                }).done(function (msg) {
                    for (i in msg.addresses) {
                        address = msg.addresses[i].address;
                        balance = msg.addresses[i].final_balance;
                        balance = (balance / 100000000);
                        balance = balance.toFixed(8);

                        $("#inv_" + address).html(balance);
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
            "https://ethereum-rpc.publicnode.com",
            "https://eth.llamarpc.com",
            "https://rpc.ankr.com/eth"
        ];

        var self = this;
        var tryNextRPC = function (index) {
            if (index >= fallbackRPCs.length) {
                console.error("All RPC endpoints failed");
                self.recordApiFailure(null);
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
                success: function (rpcMsg) {
                    if (rpcMsg && rpcMsg.result) {
                        var balanceWei = parseInt(rpcMsg.result, 16);
                        self.balance = balanceWei / 1000000000000000000;
                        var spendable = self.balance - self.txFeePerKb;
                        if (spendable < 0) spendable = 0;

                        console.log("✅ Balance fetched from fallback RPC!");
                        console.log("Balance (ETH):", self.balance);

                        $("#btcBalance").html(btcFormat(self.balance));
                        $("#spendable").html("?" + btcFormat(spendable));
                        self.getFiatPrice();
                        self.recordApiSuccess();
                    } else {
                        tryNextRPC(index + 1);
                    }
                },
                error: function () {
                    tryNextRPC(index + 1);
                }
            });
        };

        tryNextRPC(0);
    },

    "addTransactionToHistory": function (txHash, amount, toAddress, isOutgoing) {
        var self = this;
        var explorerUrl = USE_TESTNET ? "https://sepolia.etherscan.io" : "https://etherscan.io";
        var txLink = explorerUrl + "/tx/" + txHash;
        var txHashShort = txHash.substring(0, 30) + '...';

        // Use current time temporarily for pending transaction
        var now = new Date();
        var txTime = moment.utc(now).format("MMM D YYYY [<span class='time'>]h:mma[</span>] UTC");
        var timestamp = now.getTime();

        // Amount display without sign, color handles direction
        var amountDisplay = btcFormat(Math.abs(amount));
        var amountColor = isOutgoing ? "#FF0000" : "#008000"; // Red for Sent, Green for Received
        var typeLabel = isOutgoing ? "Sent" : "Received";

        // Confirmations (pending)
        var confirmations = "Pending";

        var row = '<tr data-tx-hash="' + txHash + '" data-tx-timestamp="' + timestamp + '" data-tx-pending="true">' +
            '<td><a href="' + txLink + '" target="_blank">' + txTime + ' (Pending)</a></td>' +
            '<td style="color:' + amountColor + '; font-weight:bold;">' + typeLabel + '</td>' +
            '<td class="hidden-sm hidden-xs"><a href="' + txLink + '" target="_blank">' + txHashShort + '</a></td>' +
            '<td class="hidden-sm hidden-xs">' + confirmations + '</td>' +
            '<td style="color:' + amountColor + '; text-align:right; padding-right:30px;"><a href="' + txLink + '" target="_blank">' + amountDisplay + '</a></td>' +
            '</tr>';

        var $tbody = $("#txTable tbody");

        // Show table
        $("#txBox").show();
        $("#noTx, #txList .break").hide();

        if ($tbody.find('tr[data-tx-hash="' + txHash + '"]').length === 0) {
            $tbody.prepend(row);
            this.saveTransactionsToStorage();
        }
    },

    "updateTransactionTimestamp": function (txHash) {
        var self = this;

        // Get transaction receipt to find block number
        var rpcUrl = self.ethProvider ? self.ethProvider.connection.url : MAINNET_RPC_URL;

        $.ajax({
            type: "POST",
            url: rpcUrl,
            contentType: "application/json",
            data: JSON.stringify({
                jsonrpc: "2.0",
                method: "eth_getTransactionReceipt",
                params: [txHash],
                id: 1
            }),
            success: function (response) {
                if (response && response.result && response.result.blockNumber) {
                    var blockNumber = response.result.blockNumber;

                    // Fetch block timestamp
                    self.getBlockTimestamp(blockNumber).then(function (timestamp) {
                        // Update the row with actual blockchain timestamp
                        var $row = $("#txTable tbody tr[data-tx-hash='" + txHash + "']");
                        if ($row.length > 0) {
                            var explorerUrl = USE_TESTNET ? "https://sepolia.etherscan.io" : "https://etherscan.io";
                            var txLink = explorerUrl + "/tx/" + txHash;
                            var txTime = moment.utc(timestamp).format("MMM D YYYY [<span class='time'>]h:mma[</span>] UTC");

                            // Update timestamp
                            $row.attr('data-tx-timestamp', timestamp);
                            $row.removeAttr('data-tx-pending');
                            $row.find('td:eq(0)').html('<a href="' + txLink + '" target="_blank">' + txTime + '</a>');
                            $row.find('td:eq(3)').html('Confirmed');

                            // Re-sort transactions by timestamp
                            var $tbody = $("#txTable tbody");
                            var rows = $tbody.find('tr').get();

                            rows.sort(function (a, b) {
                                var aTime = parseInt($(a).attr('data-tx-timestamp')) || 0;
                                var bTime = parseInt($(b).attr('data-tx-timestamp')) || 0;
                                return bTime - aTime;
                            });

                            $.each(rows, function (index, row) {
                                $tbody.append(row);
                            });

                            // Save updated transactions
                            self.saveTransactionsToStorage();
                        }
                    }).catch(function (error) {
                        console.error('Error updating transaction timestamp:', error);
                    });
                }
            },
            error: function (error) {
                console.error('Error fetching transaction receipt:', error);
            }
        });
    },

    "updateTransactionConfirmations": function (txHash, confirmations) {
        // Update confirmations for a specific transaction
        var $row = $("#txTable tbody tr[data-tx-hash='" + txHash + "']");
        if ($row.length > 0) {
            $row.find('td:eq(3)').html(formatMoney(confirmations));
        }
    },

    "loadTransactionsFromStorage": function () {
        // Load saved transactions from localStorage for persistence across page refreshes
        var storageKey = 'eth_transactions_v2_' + this.address.toLowerCase();
        var savedTransactions = localStorage.getItem(storageKey);

        if (savedTransactions) {
            try {
                var transactions = JSON.parse(savedTransactions);
                var $tbody = $("#txTable tbody");

                if (transactions && transactions.length > 0) {
                    // Clear existing rows first
                    $tbody.empty();

                    // Sort by timestamp (newest first)
                    transactions.sort(function (a, b) {
                        return b.timestamp - a.timestamp;
                    });

                    // Add all saved transactions
                    for (var i = 0; i < transactions.length; i++) {
                        var tx = transactions[i];
                        $tbody.append(tx.row);
                    }

                    $("#txBox").show();
                    $("#noTx, #txList .break").hide();
                }
            } catch (e) {
                console.error('Error loading transactions from storage:', e);
            }
        }
    },

    "saveTransactionsToStorage": function () {
        // Save all current transactions to localStorage for persistence
        var storageKey = 'eth_transactions_v2_' + this.address.toLowerCase();
        var transactions = [];

        $("#txTable tbody tr").each(function () {
            var $row = $(this);
            var txHash = $row.attr('data-tx-hash');
            if (txHash) {
                // Extract timestamp from the row data attribute or use current time
                var timestamp = parseInt($row.attr('data-tx-timestamp')) || Date.now();
                transactions.push({
                    hash: txHash,
                    row: $row[0].outerHTML,
                    timestamp: timestamp
                });
            }
        });

        // Save to localStorage (limit to 100 transactions to avoid storage issues)
        if (transactions.length > 100) {
            transactions = transactions.slice(0, 100);
        }

        localStorage.setItem(storageKey, JSON.stringify(transactions));
    },

    "getHistory": function (force) {
        var self = this;
        var now = Date.now();

        if (self.historyFetchInFlight) {
            return;
        }
        if (!force && self.lastHistoryFetchAt && (now - self.lastHistoryFetchAt) < HISTORY_MIN_INTERVAL_MS) {
            return;
        }

        self.historyFetchInFlight = true;

        var alchemyApiKey = (typeof ALCHEMY_CONFIG !== 'undefined' && ALCHEMY_CONFIG.apiKey)
            ? ALCHEMY_CONFIG.apiKey
            : "6orsFfrj2DIos0ZT-Yg3_";
        var alchemyBaseUrl = USE_TESTNET
            ? "https://eth-sepolia.g.alchemy.com/v2/"
            : ((typeof ALCHEMY_CONFIG !== 'undefined' && ALCHEMY_CONFIG.baseUrl)
                ? ALCHEMY_CONFIG.baseUrl
                : "https://eth-mainnet.g.alchemy.com/v2/");
        var alchemyUrl = alchemyBaseUrl + alchemyApiKey;

        // Get existing transaction hashes
        var existingHashes = {};
        $("#txTable tbody tr").each(function () {
            var hash = $(this).attr('data-tx-hash');
            if (hash) {
                existingHashes[hash.toLowerCase()] = $(this);
            }
        });

        // Helper to fetch transfers
        var fetchTransfers = function (params) {
            return $.ajax({
                type: "POST",
                url: alchemyUrl,
                contentType: "application/json",
                data: JSON.stringify({
                    "jsonrpc": "2.0",
                    "id": 1,
                    "method": "alchemy_getAssetTransfers",
                    "params": params
                }),
                dataType: "json"
            });
        };

        // Use last checked block for incremental fetching (full scan on first load)
        var fromBlock = self.lastCheckedBlock || "0x0";

        var outgoingParams = [{
            "fromBlock": fromBlock,
            "toBlock": "latest",
            "fromAddress": this.address,
            "category": ["external", "internal", "erc20", "erc721"],
            "withMetadata": true,
            "maxCount": "0x64"
        }];

        var incomingParams = [{
            "fromBlock": fromBlock,
            "toBlock": "latest",
            "toAddress": this.address,
            "category": ["external", "internal", "erc20", "erc721"],
            "withMetadata": true,
            "maxCount": "0x64"
        }];

        $.when(fetchTransfers(outgoingParams), fetchTransfers(incomingParams))
            .done(function (outgoingArgs, incomingArgs) {
                self.recordApiSuccess();
                // $.when returns [data, textStatus, jqXHR] for each promise
                var outgoingResponse = outgoingArgs[0];
                var incomingResponse = incomingArgs[0];

                var transfers = [];
                if (outgoingResponse && outgoingResponse.result && outgoingResponse.result.transfers) {
                    transfers = transfers.concat(outgoingResponse.result.transfers);
                }
                if (incomingResponse && incomingResponse.result && incomingResponse.result.transfers) {
                    transfers = transfers.concat(incomingResponse.result.transfers);
                }

                // Deduplicate transfers by hash
                var uniqueTransfers = {};
                var combinedTransfers = [];
                transfers.forEach(function (t) {
                    if (t && t.hash && !uniqueTransfers[t.hash]) {
                        uniqueTransfers[t.hash] = true;
                        combinedTransfers.push(t);
                    }
                });

                var newTransactions = [];
                var updatedTransactions = false;

                // Process each transaction
                var processedCount = 0;
                var totalToProcess = combinedTransfers.length;

                var finalize = function () {
                    newTransactions.sort(function (a, b) {
                        return b.timestamp - a.timestamp;
                    });

                    for (var i = 0; i < newTransactions.length; i++) {
                        $("#txTable tbody").prepend(newTransactions[i].row);
                    }

                    if (newTransactions.length > 0 || updatedTransactions) {
                        self.saveTransactionsToStorage();
                    }

                    if ($("#txTable tbody tr").length > 0) {
                        $("#txBox").show();
                        $("#noTx, #txList .break").hide();
                    } else {
                        $("#txBox").hide();
                        $("#noTx").show();
                    }

                    // Track highest block for incremental fetching next time
                    var maxBlock = 0;
                    combinedTransfers.forEach(function (t) {
                        if (t.blockNum) {
                            var bn = parseInt(t.blockNum, 16);
                            if (bn > maxBlock) maxBlock = bn;
                        }
                    });
                    if (maxBlock > 0) {
                        self.lastCheckedBlock = "0x" + maxBlock.toString(16);
                    }
                };

                if (totalToProcess === 0) {
                    finalize();
                    return;
                }

                combinedTransfers.forEach(function (transfer) {
                    var txHash = transfer.hash;
                    var txHashLower = txHash.toLowerCase();

                    // Check if incoming or outgoing
                    var isIncoming = transfer.to && transfer.to.toLowerCase() === self.address.toLowerCase();

                    var $existingRow = existingHashes[txHashLower];

                    // Get block number
                    var blockNum = transfer.blockNum ? parseInt(transfer.blockNum, 16) : 0;
                    var blockNumHex = transfer.blockNum || "0x0";

                    // Calculate confirmations
                    var confirmations = blockNum > 0 ? "Confirmed" : "Pending";

                    if ($existingRow && $existingRow.length > 0) {
                        // Update existing transaction confirmations only
                        $existingRow.find('td:eq(3)').html(confirmations);
                        updatedTransactions = true;
                        processedCount++;
                        if (processedCount === totalToProcess) finalize();
                    } else {
                        // New transaction - fetch block timestamp
                        (function (txData) {
                            self.getBlockTimestamp(blockNumHex).then(function (timestamp) {
                                // Format time in UTC using the blockchain timestamp
                                var txTime = moment.utc(timestamp).format("MMM D YYYY [<span class='time'>]h:mma[</span>] UTC");

                                // Get amount
                                var amount = 0;
                                var asset = txData.asset || "ETH";

                                if (txData.category === "external" || txData.category === "internal") {
                                    if (txData.value !== undefined && txData.value !== null) {
                                        amount = parseFloat(txData.value);
                                    }
                                } else if (txData.category === "erc20") {
                                    if (txData.value !== undefined && txData.value !== null) {
                                        amount = parseFloat(txData.value);
                                    }
                                    asset = txData.asset || "Token";
                                } else {
                                    amount = 1;
                                    asset = txData.asset || "NFT";
                                }

                                // Format amount and set colors/labels
                                var amountDisplay = btcFormat(Math.abs(amount));
                                var amountColor = txData.isIncoming ? "#008000" : "#FF0000";
                                var typeLabel = txData.isIncoming ? "Received" : "Sent";

                                if (asset !== "ETH") {
                                    amountDisplay += " " + asset;
                                }

                                // Transaction link
                                var explorerUrl = USE_TESTNET ? "https://sepolia.etherscan.io" : "https://etherscan.io";
                                var txLink = explorerUrl + "/tx/" + txData.hash;
                                var txHashShort = txData.hash.substring(0, 30) + '...';

                                // Create row HTML
                                var row = '<tr data-tx-hash="' + txData.hash + '" data-tx-timestamp="' + timestamp + '">' +
                                    '<td><a href="' + txLink + '" target="_blank">' + txTime + '</a></td>' +
                                    '<td style="color:' + amountColor + '; font-weight:bold;">' + typeLabel + '</td>' +
                                    '<td class="hidden-sm hidden-xs"><a href="' + txLink + '" target="_blank">' + txHashShort + '</a></td>' +
                                    '<td class="hidden-sm hidden-xs">' + confirmations + '</td>' +
                                    '<td style="color:' + amountColor + '; text-align:right; padding-right:30px;"><a href="' + txLink + '" target="_blank">' + amountDisplay + '</a></td>' +
                                    '</tr>';

                                newTransactions.push({
                                    row: row,
                                    timestamp: timestamp,
                                    hash: txData.hash
                                });

                                processedCount++;
                                if (processedCount === totalToProcess) finalize();
                            }).catch(function (error) {
                                console.error('Error fetching block timestamp for tx:', txData.hash, error);
                                processedCount++;
                                if (processedCount === totalToProcess) finalize();
                            });
                        })({
                            hash: txHash,
                            blockNum: blockNumHex,
                            category: transfer.category,
                            value: transfer.value,
                            asset: transfer.asset,
                            isIncoming: isIncoming
                        });
                    }
                });
            })
            .fail(function (xhr, status, error) {
                console.error('Error fetching transaction history:', error);
                if (xhr && (xhr.status === 0 || xhr.status >= 400)) {
                    self.recordApiFailure(xhr);
                }
            })
            .always(function () {
                self.historyFetchInFlight = false;
                self.lastHistoryFetchAt = Date.now();
            });
    },
    "getBlockTimestamp": async function (blockNumber) {
        // Fetch block details including timestamp from blockchain
        var self = this;

        return new Promise(function (resolve, reject) {
            $.ajax({
                type: "POST",
                url: self.ethProvider ? self.ethProvider.connection.url : MAINNET_RPC_URL,
                contentType: "application/json",
                data: JSON.stringify({
                    jsonrpc: "2.0",
                    method: "eth_getBlockByNumber",
                    params: [blockNumber, false],
                    id: 1
                }),
                success: function (response) {
                    if (response && response.result && response.result.timestamp) {
                        // Convert hex timestamp to decimal
                        var timestamp = parseInt(response.result.timestamp, 16) * 1000;
                        resolve(timestamp);
                    } else {
                        reject(new Error("No timestamp in block"));
                    }
                },
                error: function (error) {
                    reject(error);
                }
            });
        });
    },

    "setTxFeePerKb": function (fee) {
        this.txFeePerKb = parseFloat(fee);
        setCookie("txFeePerKb", parseFloat(fee), 100);
    },

    "get24Chart": function () {
        if (this.chartLoaded) {
            $("#chartBox").slideDown();
            return;
        }

        $.ajax({
            type: "GET",
            url: "https://api.bitcoinaverage.com/history/" + psp.currency + "/per_minute_24h_sliding_window.csv",
            dataType: "text",
            success: function (allText) {
                psp.chartLoaded = true;
                var allTextLines = allText.split(/\r\n|\n/);
                var headers = allTextLines[0].split(',');
                var lines = [];

                for (var i = 1; i < allTextLines.length; i++) {
                    var data = allTextLines[i].split(',');
                    if (data.length == headers.length) {
                        var tarr = [];
                        for (var j = 0; j < headers.length; j++) {
                            tarr.push(data[j]);
                        }
                        lines.push(tarr);
                    }
                }

                hours = [];
                for (i in lines) {
                    if (i % 2 == 0) {
                        var date = new Date(lines[i][0] + " GMT");
                        unix = date.getTime();
                        hours.push([unix, lines[i][1]]);
                    }
                }

                $("#chartBox").slideDown();

                $.plot("#chart24", [hours],
                    {
                        xaxis: { mode: "time", timeformat: "%H", timezone: "browser", tickSize: [3, "hour"] },
                        colors: ["#F49500"],
                        grid: {
                            color: "#64657A",
                            borderColor: "#3E3F4D",
                            borderWidth: 1
                        }
                    }
                );
            }
        });
    },

    "getBalance": function () {
        if (this.balanceFetchInFlight) {
            return;
        }
        this.balanceFetchInFlight = true;
        var self = this;

        console.log("Fetching balance for address:", this.address);

        if (USE_TESTNET) {
            var rpcUrl = TESTNET_RPC_URL;
        } else {
            var rpcUrl = MAINNET_BALANCE_RPC_URL;

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
                success: function (rpcMsg) {
                    self.balanceFetchInFlight = false;
                    if (rpcMsg && rpcMsg.result) {
                        var balanceWei = parseInt(rpcMsg.result, 16);
                        psp.balance = balanceWei / 1000000000000000000;
                        var spendable = psp.balance - psp.txFeePerKb;
                        if (spendable < 0) spendable = 0;

                        console.log("✅ Balance fetched successfully from RPC!");
                        console.log("Balance (Wei):", balanceWei);
                        console.log("Balance (ETH):", psp.balance);
                        console.log("Spendable (ETH):", spendable);

                        $("#btcBalance").html(btcFormat(psp.balance));
                        $("#spendable").html("?" + btcFormat(spendable));
                        psp.getFiatPrice();
                        psp.recordApiSuccess();
                    } else {
                        console.error("RPC error:", rpcMsg);
                        psp.getBalanceFallback();
                    }
                },
                error: function (xhr, status, error) {
                    self.balanceFetchInFlight = false;
                    console.error("RPC call failed:", error);
                    psp.recordApiFailure(xhr);
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
                    self.balanceFetchInFlight = false;
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
                            success: function (alchemyMsg) {
                                if (alchemyMsg && alchemyMsg.result) {
                                    var balanceWei = parseInt(alchemyMsg.result, 16);
                                    psp.balance = balanceWei / 1000000000000000000;
                                    var spendable = psp.balance - psp.txFeePerKb;
                                    if (spendable < 0) spendable = 0;

                                    console.log("Balance fetched from Alchemy!");
                                    console.log("Balance (ETH):", psp.balance);

                                    $("#btcBalance").html(btcFormat(psp.balance));
                                    $("#spendable").html("?" + btcFormat(spendable));
                                    psp.getFiatPrice();
                                    psp.recordApiSuccess();
                                    return;
                                }
                            },
                            error: function () {
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
                        error: function (xhr) {
                            psp.recordApiFailure(xhr);
                        },
                        success: function (altMsg) {
                            if (altMsg && altMsg.ETH) {
                                psp.balance = parseFloat(altMsg.ETH.balance) || 0;
                                var spendable = psp.balance - psp.txFeePerKb;
                                if (spendable < 0)
                                    spendable = 0;

                                $("#btcBalance").html(btcFormat(psp.balance));
                                $("#spendable").html("?" + btcFormat(spendable));
                                psp.getFiatPrice();
                                psp.recordApiSuccess();
                            } else {
                                psp.recordApiFailure(null);
                            }
                        }
                    });
                },
                data:
                    {}
            }).done(function (msg) {
                self.balanceFetchInFlight = false;
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

                        $("#btcBalance").html(btcFormat(psp.balance));
                        $("#spendable").html("?" + btcFormat(spendable));
                        psp.getFiatPrice();
                        psp.recordApiSuccess();
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
                        error: function (xhr) {
                            psp.recordApiFailure(xhr);
                        },
                        success: function (altMsg) {
                            if (altMsg && altMsg.ETH) {
                                psp.balance = parseFloat(altMsg.ETH.balance) || 0;
                                var spendable = psp.balance - psp.txFeePerKb;
                                if (spendable < 0)
                                    spendable = 0;

                                $("#btcBalance").html(btcFormat(psp.balance));
                                $("#spendable").html("?" + btcFormat(spendable));
                                psp.getFiatPrice();
                                psp.recordApiSuccess();
                            } else {
                                psp.recordApiFailure(null);
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
                            success: function (rpcMsg) {
                                if (rpcMsg && rpcMsg.result) {
                                    var balanceWei = parseInt(rpcMsg.result, 16);
                                    psp.balance = balanceWei / 1000000000000000000;
                                    var spendable = psp.balance - psp.txFeePerKb;
                                    if (spendable < 0) spendable = 0;

                                    console.log("Balance fetched from RPC!");
                                    console.log("Balance (ETH):", psp.balance);

                                    $("#btcBalance").html(btcFormat(psp.balance));
                                    $("#spendable").html("?" + btcFormat(spendable));
                                    psp.getFiatPrice();
                                    psp.recordApiSuccess();
                                    return;
                                }
                            },
                            error: function (xhr) {
                                console.error('RPC call failed');
                                psp.recordApiFailure(xhr);
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
                            error: function (xhr) {
                                psp.recordApiFailure(xhr);
                            },
                            success: function (altMsg) {
                                if (altMsg && altMsg.ETH) {
                                    psp.balance = parseFloat(altMsg.ETH.balance) || 0;
                                    var spendable = psp.balance - psp.txFeePerKb;
                                    if (spendable < 0)
                                        spendable = 0;

                                    $("#btcBalance").html(btcFormat(psp.balance));
                                    $("#spendable").html("?" + btcFormat(spendable));
                                    psp.getFiatPrice();
                                    psp.recordApiSuccess();
                                } else {
                                    psp.recordApiFailure(null);
                                }
                            }
                        });
                    }
                }
            });
    },

    "getFiatPrefix": function () {
        switch (this.currency) {
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

    "applyEthPriceDisplay": function (price) {
        if (price === undefined || price === null || isNaN(price) || price <= 0) {
            return false;
        }

        this.price = price;
        var disp = formatMoney(price.toFixed(2));
        $("#price").html(this.getFiatPrefix() + disp);
        $("#pricePill").css("display", "inline-flex");
        return true;
    },

    "getFiatValue": function () {
        this.fiatValue = this.price * psp.balance;
        $("#fiatValue").html(this.getFiatPrefix() + formatMoney(this.fiatValue.toFixed(2)));
        $("#currentPrice").html(this.getFiatPrefix() + formatMoney(psp.price.toFixed(2)));
    },

    "getFiatPrice": function () {
        currency = this.currency;

        // Use Alchemy API + Chainlink Oracle to get ETH price in USD
        $.ajax({
            type: "POST",
            url: "https://eth-mainnet.g.alchemy.com/v2/OnpOfkjdhDSDQDerF4EbZ",
            headers: { 'Content-Type': 'application/json' },
            data: JSON.stringify({
                "jsonrpc": "2.0",
                "method": "eth_call",
                "params": [
                    {
                        "to": "0x5f4ec3df9cbd43714fe2740f5e3616155c5b8419",
                        "data": "0x50d25bcd"
                    },
                    "latest"
                ],
                "id": 1
            }),
            dataType: "json"
        }).done(function (data) {
            if (data && data.result) {
                const hexResult = data.result;
                const price = parseInt(hexResult, 16) / 100000000;

                psp.price = price;

                psp.applyEthPriceDisplay(price);

                $("#currencyValue").html(psp.currency);
                $(".currency").animate({ opacity: 1 });
                psp.getFiatValue();
            }
        });
    },

    "amountFiatValue": function () {
        var amount = $("#txtAmount").val();
        amount = parseFloat(amount);
        if (!amount) {
            amount = 0;
        }

        if (psp.useFiat) {
            // User entered USD amount, show ETH equivalent
            var ethValue = amount / this.price;
            ethValue = btcFormat(ethValue);
            $("#fiatPrice").html("(ETH " + ethValue + ")");
        }
        else {
            // User entered ETH amount, show USD equivalent
            var fiatValue = this.price * amount;
            fiatValue = fiatValue.toFixed(2);
            $("#fiatPrice").html("(" + this.getFiatPrefix() + formatMoney(fiatValue) + ")");
        }
    },

    "amountFiatValue2": function () {
        var amount = $("#txtReceiveAmount").val();
        amount = parseFloat(amount);
        if (!amount) {
            amount = 0;
        }

        if (psp.useFiat2) {
            // User entered USD amount, show ETH equivalent
            var ethValue = amount / this.price;
            ethValue = btcFormat(ethValue);
            $("#fiatPrice2").html("(ETH " + ethValue + ")");
        }
        else {
            // User entered ETH amount, show USD equivalent
            var fiatValue = this.price * amount;
            fiatValue = fiatValue.toFixed(2);
            $("#fiatPrice2").html("(" + this.getFiatPrefix() + formatMoney(fiatValue) + ")");
        }
    },

    "prepareReset": function () {
        setMsg("Are you sure you want to generate a new address? <strong>This will delete your current one and all funds associated with it.</strong> <br/><button id='confirmReset'>Yes</button> <button id='noReset'>No</button>");
    },

    "reset": function () {
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

    "txComplete": function () {



        setMsg("Payment Sent!", true);
        $("#sendBtn").removeAttr("disabled");
        $("#sendBtn").html("Send");

        this.txSec = "";

        if (psp.sweeping != "") {
            alert("Payment Sent!")
            psp.address = psp.sweeping;
            this.sweeping = "";
            $('#settingsModal').modal('hide')
        }

        $("#password").val("");
        $("#txtAmount").val("").css({ "font-size": "14px" });
        $("#txtAddress").val("");
        $("#fiatPrice").show();
        $("#oneNameInfo").hide();

        this.getBalance();
        playBeep();

        psp.getBalanceBlock = true;

        setTimeout(function () {
            psp.getBalanceBlock = false;
        }, 1000);

        if (this.afterSendSuccessful) {
            this.afterSendSuccessful();
            this.afterSendSuccessful = null;
        }


        if (r_gc) {

            $('#confirmSend').hide();
            $('.closeConfirm').hide();
        }

    },

    "exportWallet": function () {
        if (!this.encrypted) {
            setMsg("" + psp.passcode);
        }
        else {
            if ($("#password").val() == "") {
                setMsg("Please enter password to decrypt wallet.");
                return;
            }

            var passcode = CryptoJS.AES.decrypt(this.passcode, $("#password").val());
            var passcode = passcode.toString(CryptoJS.enc.Utf8);

            if (!passcode) {
                setMsg("Incorrenct Password!");
                return;
            }

            setMsg("Brainwallet: " + passcode);
            $("#password").val("");
        }
    },

    "importWallet": function () {
        setMsg("Importing a brain wallet will replace your current wallet. You will lose your balance if you haven't backed it up!<br/><input type='text' id='importBrainTxt' placeholder='Brainwallet'> <button id='confirmImport'>Import</button>");
    },

    "confirmImport": function () {
        if (!$("#confirmImport").attr("confirmed")) {
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

            // Generate Ethereum wallet from brain wallet passcode using PSP MD5 flow
            var wallet = createPspEthereumWallet(psp.passcode);

            if (!wallet || !wallet.address) {
                throw new Error('Failed to generate wallet address');
            }

            var address = wallet.address;

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
            }, function () {
                psp.open();
            });

        setMsg("Brainwallet imported succesfully!");
    }
};

function popup(txt) {
    setGPGMsg('<textarea id="gpgBox" readonly></textarea>');
    $("#gpgBox").val(txt);
}

function popupMsg(txt) {
    // txt = txt.replace(/\n/g, '<br />');

    setGPGMsg('<div id="messageBox">' + txt + '</div>');
}

$(document).ready(function () {
    var code = window.location.hash;
});

Date.prototype.format = function (format) //author: meizz
{
    var o = {
        "M+": this.getMonth() + 1, //month
        "d+": this.getDate(), //day
        "H+": this.getHours(), //hour
        "h+": ((this.getHours() % 12) == 0) ? "12" : (this.getHours() % 12), //hour
        "z+": (this.getHours() > 11) ? "pm" : "am", //hour
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

function formatMoney(x) {
    return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}



function htmlEncode(value) {
    //create a in-memory div, set it's inner text(which jQuery automatically encodes)
    //then grab the encoded contents back out.  The div never exists on the page.

    return $('<div/>').text(value).html();
}

function s2hex(s) {
    return Bitcoin.convert.bytesToHex(Bitcoin.convert.stringToBytes(s))
}

function playBeep() {
    var snd = document.getElementById('noise');
    snd.src = 'balance.wav';
    snd.load();
    snd.play();
}

function playBaron() {
    var snd = document.getElementById('noise');
    psp.snd = snd;
    snd.src = 'baron.mp3';
    snd.load();
    snd.play();
}

function playTurn() {
    var snd = document.getElementById('noise');
    psp.snd = snd;
    snd.src = 'turn.mp3';
    snd.load();
    snd.play();
}

String.prototype.startsWith = function (text) {
    return (this.length >= text.length && this.substring(0, text.length) === text);
}

function ajax(url, success, data) {
    var xhr = new XMLHttpRequest();
    xhr.onreadystatechange = function () {
        if (xhr.readyState == 4) {
            if (xhr.status === 200) {
                success(xhr.responseText);
                xhr.close;
            } else {
                // Blockchain.info weirdness... This isn't actually a server error, but a 'no results'

                if (psp.sweeping != "") {
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

function tx_fetch(url, onSuccess, onError, postdata) {
    $.ajax(
        {
            url: url,
            data: postdata || '',
            type: "POST",
            success: function (res) {
                onSuccess(JSON.stringify(res));
            },
            error: function (xhr, opt, err) {
                // console.log("error!");
            }
        });
}

function setMsg(msg, green, dontHide) {
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

    document.getElementById("qrcode").innerHTML = "";


    // Create a new instance of QRCode
    var qrcode = new QRCode(document.getElementById("qrcode"), {

        text: str,

        width: 300,

        height: 300,

        colorDark: "#000000",

        colorLight: "#ffffff",

        correctLevel: QRCode.CorrectLevel.H
    });

    // Get the canvas element where the QR code is rendered
    var canvas = document.getElementById("qrcode").getElementsByTagName("canvas")[0];


    return canvas.toDataURL("image/png");



}


