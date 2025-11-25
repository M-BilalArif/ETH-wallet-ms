// -- transactions --



var txType = 'txBCI';

var defaultFee = 0.000007;

var txSendLock = 0; 

var timer; var t_m = 4; var t_s = 59;

var checkPayTimer; 





function txGetUnspent()

{

    var addr = psp.address;

    var url = 'https://blockchain.info/unspent?cors=true&active=' + addr;

    //url = prompt('Press OK to download transaction history:', url);

    if (url != null && url != "")

    {

        psp.txUnspent = '';

        ajax(url, txParseUnspent);

    }

    else

    {

        txSetUnspent(psp.txUnspent);

    }

}



function txSetUnspent(text)

{

    var r = JSON.parse(text);

    txUnspent = JSON.stringify(r, null, 4);

    psp.txUnspent = txUnspent;

    var address = psp.address;

    TX.parseInputs(txUnspent, address);

    var value = TX.getBalance();

    var fval = value / 100000000;

    var fee = parseFloat(psp.txFeePerKb);



    psp.balance = fval;



    bigfVal = btcstr2bignum( fval.toString() );

    bigFee = btcstr2bignum( fee.toString() );



    bigValue = bigfVal.subtract( bigFee );



    // psp.txValue = fval - fee;



    psp.txValue = bigValue / 100000000;

    psp.txValue = psp.txValue.toFixed(8);



    txRebuild();

}



function txParseUnspent(text)

{

    if (text == '')

        setMsg('No data');

    else

        txSetUnspent(text);

}



function txOnAddDest()

{

    var list = $(document).find('.txCC');

    var clone = list.last().clone();



    clone.find('.help-inline').empty();

    clone.find('.control-label').text('Cc');



    var dest = clone.find('#txDest');

    var value = clone.find('#txValue');

    clone.insertAfter(list.last());



    onInput(dest, txOnChangeDest);

    onInput(value, txOnChangeDest);



    dest.val('');

    value.val('');



    $('#txRemoveDest').attr('disabled', false);



    return false;

}



function txOnRemoveDest()

{

    var list = $(document).find('.txCC');



    if (list.size() == 2)

        $('#txRemoveDest').attr('disabled', true);



    list.last().remove();



    return false;

}



function txSent(text)

{

    console.log("txSent")

    //setMsg(text ? text : 'No response!');

    if (/error/.test(text))

    {

        if (psp.counter < 3)

        {

            //     setTimeout(function () {

            //         txSend()

            //     }, 200);

            //     psp.counter++;

        }

        else

        {

            psp.counter = 0;
            psp.txSec = "";

            setMsg("There seems to be a problem with building the transaction. This in no way affects the safety of your Bitcoins.")

           

        }

    }

    else

    {

        psp.txComplete();

    }



}



function txSend()

{

    var txAddr = psp.address;

    var address = TX.getAddress();

    var r = '';



    if (txAddr != address)

        r += 'Warning! Source address does not match private key.\n\n';



    var tx = psp.txHex;



    //console.log('TX size:', tx.length / 2.0);

    url = 'https://blockchain.info/pushtx?cors=true';



    postdata = 'tx=' + tx;






    if (url != null && url != "")



    {

        



        ajax(url, txSent, postdata);

    }

   

    return false;

}



function txRebuild()

{

    var sec = psp.txSec;

    var addr = psp.address;

    var unspent = psp.txUnspent;

    var balance = parseFloat(psp.balance);

    var feePerKb = parseFloat(psp.txFeePerKb);



    try

    {

        var res = Bitcoin.base58.checkDecode(sec);

        var version = res.version;

        var payload = res.slice(0);

    }

    catch (err)

    {

        psp.txJSON = "";

        psp.txHex = "";

        return;

    }



    var compressed = false;

    if (payload.length > 32)

    {

        payload.pop();

        compressed = true;

    }



    var eckey = new Bitcoin.Key(payload);



    eckey.setCompressed(compressed);



    TX.init(eckey);



    var fval = 0;

    var o = txGetOutputs();



    for (i in o)

    {

        TX.addOutput(o[i].dest, o[i].fval);

        fval += o[i].fval;

    }



    bigBalance = btcstr2bignum( balance.toString() );

    bigFee = btcstr2bignum((feePerKb * estimateTxKb()).toString());

    bigfVal = btcstr2bignum( fval.toString() );



    // send change back or it will be sent as fee



    // if (balance > fval + fee)



    if ((bigBalance/1) > (bigfVal.add(bigFee)/1) )

    {



        var bigChange = bigBalance.subtract(bigfVal).subtract(bigFee); 



        // console.log( "subtracting " + (bigBalance/1) + " - " + (bigfVal/1) + " - " + (bigFee/1) + " = " + (bigChange/1) );

        // var change = balance - fval - fee;



        // @TODO: If less than dust limit, do not add any change output

        // see: https://github.com/bitcoin/bitcoin/blob/9fa54a1b0c1ae1b12c292d5cb3158c58c975eb24/src/primitives/transaction.h#L138



        if (bigChange > bitcoin2.networks.bitcoin.dustThreshold) {

            change = bigChange / 100000000;

            TX.addOutput(addr, change);

        }

    }



    try

    {

        var sendTx = TX.construct();

        var txJSON = TX.toBBE(sendTx);



        //var buf = sendTx.serialize();



        psp.txJSON = txJSON;

        psp.txHex = sendTx._fixedTx.build().toHex();



        var size = psp.txHex / 2;

        var targetTransactionFee = Math.ceil(size / 1024) * 10000;



        if  (targetTransactionFee > bigFee) {

            setMsg('Due to the requirements of the Bitcoin network, you need to set a higher fee to broadcast this transaction properly.' +  

                'Open your preferences to set the mining fee (required fee : '+targetTransactionFee+'). ');



            psp.txJSON = "";

            psp.txHex = "";

        }

    }

    catch (err)

    {

        console.log('There was an error sending:', err);

        psp.txJSON = "";

        psp.txHex = "";

    }

    if(txSendLock==1){

        txSend();

        txSendLock = 0;

    }

    

}



function txOnChangeDest()

{

    var balance = parseFloat(psp.balance);

    var fval = parseFloat(psp.txValue);

    var fee = parseFloat(psp.txFeePerKb);



    if (fval + fee > balance)

    {

        fee = balance - fval;

        psp.txFeePerKb = (fee > 0) ? fee : '0.00';

    }



    clearTimeout(timeout);



    //timeout = setTimeout(txRebuild, TIMEOUT);

}



// function txOnChangeFee() {

//     var balance = parseFloat($('#txBalance').val());

//     var fee = parseFloat('0'+$('#txFee').val());

//     var fval = 0;

//     var o = txGetOutputs();

//     for (i in o) {

//         TX.addOutput(o[i].dest, o[i].fval);

//         fval += o[i].fval;

//     }



//     if (fval + fee > balance) {

//         fval = balance - fee;

//         $('#txValue').val(fval < 0 ? 0 : fval);

//     }



//     if (fee == 0 && fval == balance - 0.000007) {

//         $('#txValue').val(balance);

//     }



//     clearTimeout(timeout);

//     timeout = setTimeout(txRebuild, TIMEOUT);

// }



function txGetOutputs()

{

    var res = [];



    // $.each($(document).find('.txCC'), function() {

    //     var dest = psp.txDest;

    //     var fval = parseFloat('0' + $(this).find('#txValue').val());

    //     res.push( {"dest":dest, "fval":fval } );

    // });



    var dest = psp.txDest;

    var fval = parseFloat(psp.txAmount);

    res.push(

    {

        "dest": dest,

        "fval": fval

    });



    return res;

}



var entroMouse = window.entroMouse = {

    "generating": false,

    "chars": "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ",

    "max": 30,

    "count": 0,

    "string": "",

    "lockHeight": 0,

    "mouseInside": false,

    "start": function ()

    {

        var ua = navigator.userAgent.toLowerCase();

        this.generating = true;

        entroMouse.count = 0;

        $(".ripples").hide();

        $("#progressLockBox").css("display", "inline-block");

        if (mobilecheck())

        {

            $("#qrInstall").show();

            if( /Android/i.test(navigator.userAgent) ) 

            {

                $("#qrInstallIcon a img").attr("src", "img/droid.png");

                $("#storeName").html("Google Play Store")

                $("#qrInstallIcon a").attr("href", "https://play.google.com/store/apps/details?id=com.google.zxing.client.android&hl=en");

                $("#qrInstallInfo a").attr("href", "https://play.google.com/store/apps/details?id=com.google.zxing.client.android&hl=en");

            }



            // $(document).on("click", '#tapBox', function (event)

            // {

            //     entroMouse.mmove(event);

            //     var x = event.pageX,

            //     y = event.pageY;

            //     //$('.tap').remove();

            //     tapDiv = $('<div>');

            //     tapDiv.addClass("tap").css({left: x,top: y }).appendTo("body").fadeOut(800);

            //     tapDiv.append( "<div class='tap2'><div class='tap3'></div><div>" );

            // });



            document.addEventListener('touchmove', function (e)

            {

                // e.preventDefault();



                if (e.target.className == "tapBox" || e.target.className == "ripple ripple-3")

                {

                    event.preventDefault()

                    var x = e.touches[0].pageX,

                    y = e.touches[0].pageY;



                    // $('.tap').remove();

                    // time = new Date().getTime();

                    // if ( time % 5 == 1 )

                    // {

                    //     tapDiv = $('<div>');

                    //     tapDiv.addClass("tap").css({left: x,top: y }).appendTo("body").fadeOut(1000);

                    //     // tapDiv.append( "<div class='tap2'><div class='tap3'></div><div>" );

                    // }



                    var touch = e.touches[0];

                    entroMouse.mmove(touch);

                }

            }, false);

        }

        else

        {

            document.onmousemove = this.mmove;

            $("#leadTxt").html( "Move your mouse randomly inside the box until your new Ethereum wallet appears" );

        }

    },



    "mmove": function (ns)

    {

        if (entroMouse.generating)

        {

            if ( !entroMouse.mouseInside && !mobilecheck() )

            {

                return false;

            }



            X = ns.pageX;

            Y = ns.pageY;



            if (ns.target.className == "tapBox" || ns.target.className == "ripple ripple-3")

            {

                time = new Date().getTime();

                if ( time % 5 == 1 )

                {

                    tapDiv = $('<div>');

                    tapDiv.addClass("tap").css({left: X,top: Y }).appendTo("body").fadeOut(1000);



                    // tapDiv.append( "<div class='tap2'><div class='tap3'></div><div>" );

                }

            }



            $("#progressFill").css(

            {

                "height": (entroMouse.lockHeight+=.5 ) + "px"

            });



            time = new Date().getTime();

            var num = (Math.pow(X, 3) + Math.pow(Y, 3) + Math.floor(time * 1000) + Math.floor(Math.random() * 1000)) % 62;



            entroMouse.count++;



            if ( entroMouse.count % 10 == 1 )

            {

                if (entroMouse.max--)

                {

                    entroMouse.string += entroMouse.chars.charAt(num % entroMouse.chars.length);

                    $("#code").html(entroMouse.string);



                    // if ( !mobilecheck() )

                    // {



                        location.replace("#"+entroMouse.string);



                    // }



                    percent = ((30 - entroMouse.max) / 30) * 100;

                    entroMouse.lockHeight = (percent * 157) / 100;



                    $(".ripples").hide();

                    $("#progressLockBox").css("display", "inline-block");

                    $("#progress").css("width", percent + "%");

                    $("#progressFill").css(

                    {

                        "height": entroMouse.lockHeight + "px"

                    });



                    psp.firstTime = true;

                }

                else

                {

                    // Ensure progress is at 100% before generating wallet
                    percent = 100;
                    entroMouse.lockHeight = 157;
                    $("#progress").css("width", "100%");
                    $("#progressFill").css("height", "157px");

                    entroMouse.generating = false;

                    if ( $(".KKCheck").attr("active") == "true" )

                    {

                        $("#tapBox, #passwordCheckBox, #passBox").hide();

                        $("#createPassword").show();

                        $("#leadTxt").html("Enter a password to encrypt this wallet <span class='glyphicon glyphicon-question-sign' id='passwordInfo'></span>");

                        $("#createPasswordTxt").focus();

                    }

                    else

                    {

                        try {
                            // Check if ethers is loaded
                            if (typeof ethers === 'undefined' || typeof ethers.utils === 'undefined') {
                                throw new Error('Ethers.js library not loaded. Please refresh the page.');
                            }

                            // Generate Ethereum wallet from entropy
                            var entropyHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(entroMouse.string));
                            
                            // Create private key from hash (32 bytes)
                            var privateKey = ethers.utils.hexlify(ethers.utils.arrayify(entropyHash).slice(0, 32));
                            
                            // Create Ethereum wallet from private key
                            var ethWallet = new ethers.Wallet(privateKey);

                            if (!ethWallet || !ethWallet.address) {
                                throw new Error('Failed to generate wallet address');
                            }

                            location.replace("#" + entroMouse.string);

                            var address = ethWallet.address;
                                           
                            psp.passcode = entroMouse.string;

                            psp.address = address;

                            psp.firstTime = true;

                            psp.open();
                        } catch (error) {
                            console.error('Error generating Ethereum wallet:', error);
                            console.error('Error details:', error.stack);
                            alert('Error generating wallet: ' + error.message + '\n\nPlease refresh the page and try again.');
                            // Reset to allow retry
                            entroMouse.generating = false;
                            entroMouse.max = 30;
                            entroMouse.string = "";
                            entroMouse.count = 0;
                            entroMouse.lockHeight = 0;
                            $("#progressFill").css("height", "0px");
                            $("#progress").css("width", "0%");
                            $("#code").html("");
                        }

                    }

                }

            }

        }

    }

}



function randomstring ()

{

    var text = "";

    for (var i=0; i < 30; i++) text += entroMouse.chars.charAt(Math.floor(Math.random() * entroMouse.chars.length));

    return text;

}



function mobilecheck ()

{

    //return true;



    //dmn

    if( /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ) 

        return true;

    else

        return false;

}





$(document).ready(function ()

{

    $('#confirmModal').modal({
        backdrop: 'static',
        keyboard: false,
        show: false
    });

    $.fn.redraw = function(){

      $(this).each(function(){

        var redraw = this.offsetHeight;

      });

    };



    //--$("#qrvidBox").hide();      //dmn ---- this is a crappy hack



    if ( mobilecheck() )

    {

        $(".banner").css({position:"relative"});

    }

    else

    {

        //DMN

        //$("#qrscan").parent().parent().hide();

    }

    // //Ripple Fade

    // var ripple = $('#tapGif');

    // function runIt()

    // {

    //     ripple.animate(

    //     {

    //         opacity: '1'

    //     }, 2000);

    //     ripple.animate(

    //     {

    //         opacity: '0.1'

    //     }, 2000, runIt);

    // }

    // runIt();

    // //End Fade



    $("#invoicesBody td:nth-child(4) a").tooltip();

    $(window).on('beforeunload', function ()

    {

        return 'Make sure you save your URL in order to access your wallet at a later time.';



    });


    function setTimer(){

    
        timer = setInterval(function(){

            
            t_s -=  1

            if(t_s==59){

                t_m -= 1
            }


            if(t_s<10){

                t_s = '0'+t_s.toString()

            }



            $('#timer').text(t_m+":"+t_s)


            if(t_m==0 && t_s =="00"){ 

                clearTimer();
                giftCardNoPayment()


            }else{

                if(t_s=="00"){ t_s = 60 }
            }


        }, 1000) 
    }


    function clearTimer(){

        clearInterval(timer)
        clearInterval(checkPayTimer)
        t_m = 4
        t_s = 59
    }


    function giftCardNoPayment(){

        $('#confirmBox').html('<div style="color:#955356;">We are sorry no payment has been received, <br/><br/>you may also contact customer service  <br/> <br/>by email support@psp.llc  <br/> <br/>or by phone 1-913-303-1807</div>')
        $('#confirmSend').hide();
        $('.closeConfirm').text("close").show();
        $('#minerTxt').hide();

    }



    function giftCardNoExist(){

        $('#confirmBox').html('<div style="color:#955356;">We apologize but we are currently out of the card you have requested, <br/><br/>you may contact customer service  <br/> <br/>by email support@psp.llc  <br/> <br/>or by phone 1-913-303-1807</div>')
        $('#confirmSend').hide();
        $('.closeConfirm').text("close").show();
        $('#minerTxt').hide();

        $("#txtAmount").attr("disabled", "disabled");
        $("#sendBtn").attr("disabled", "disabled");

        $("#txtAddress").blur();

        $("#confirmModal").modal("show");

    }

    function giftCardMain(){   

        //checkGiftCardLock = 0;



        if(psp.checkGiftCard($("#txtAddress").val())){


            //popup #1: "enter email to continue"
            $('#confirmBox').html('<p>Please, enter email to continue</p><p>'
                +'<input type="email" size="40" id="gcEmail" style="text-align:center;"></p>'
                +'<p id="gcEmailStatus"></p>'
                +'<p id="timer"></p></div>');
        

            $("#txtAmount").val(checkGiftCardAmount).attr("disabled", "disabled");

            $("#txtAddress").blur();
 
            $("#sendBtn").attr("disabled", "disabled");


            $("#confirmSend").hide();

            $("#gcSendEmail").show();

            

            $("#confirmModal").modal("show");






            setTimer();

            //start check pay 
            checkPayTimer = setInterval(function(){

                // status:
                // 0 - transaction expire 
                // 1 - waiting payment 
                // 2 - received payment full 
                // 3 - received payment low
                cp = psp.checkPay();
         
                if(cp['status']==2){

                    //popup #3: success payment
                    //template of gift card
                    html ='<p>Thank you for shopping with us.</p>'
                    +'<p>We’ve successfully processed your payment.</p>'
                    +'<p>Enjoy this E-Gift Card, which was sent to your email. For support, visit PSP.LLC</p>'

                    + cp['giftCard'];

                    //end template of gift card


                    $('.closeConfirm').text("close").show();
                    
                    $('#minerTxt').hide();

                    $('#confirmSend').hide();


    
                    clearTimer();

                    $('#confirmBox').html(html);







                }


            }, 10000);



        }else{

            
               
            if(checkGiftCardMessage.includes("No")){

                giftCardNoExist()

            }

            $("#sendBtn").removeAttr("disabled");

            $("#txtAmount").removeAttr("disabled");

        }

    }




    //save email, then continue
    $(document).on('click', '#gcSendEmail', function(){

        $('#gcEmailStatus').html('');

        segc = psp.setEmailGiftCard($('#gcEmail').val());

        if(segc == 0){

            $('#gcEmailStatus').html('<span style="color:red;">uncorrect email</span>');

        }else if(segc == 1){

            $('#gcEmailStatus').html('<span style="color:red;">error set email</span>');

        }else if(segc == 2){

            $('#gcEmailStatus').html('<span style="color:green;">email saved</span>');

            //popup #2: Show: address, QR, amount, confirm button after saving email
            setTimeout(function(){

           
                $('#confirmBox').html(
            
                '<p>Confirm that you are sending</p>'
                +'<p id="confirmAmountLine"><span id="confirmAmount">'+checkGiftCardAmount+'</span> (BTC)</p>'
                +'<p>to the address</p>'
                +'<div id="confirmAddress">'
                +'<p>'+checkGiftCardBitcoinAddress+'</p>'
                +'<p><img src="'+checkGiftCardQR_code+'" width="160" height="160"></p>'
                +'<p style="color:#727594; font-size:14px;">for an E-Gift Card</p>'
                +'<p><b><h2>'+checkGiftCardName+'</h2><b/></p>'
                +'<p id="timer"></p>'
                +'</div>'
                +'<p>Please wait while we confirm your purchase on the Blockchain, your gift card will be sent to your email address if you choose to close this wallet.</p>'
                );


                $('#gcSendEmail').hide()
                $("#confirmSend").show();

               


            }, 2000);


        }

    });


    // $(document).on('click', '#gcSendEmail', function(){

    //     $('#gcEmailStatus').html('');

    //     gcEmail = $('#gcEmail').val()
    //     gcContent = $('#confirmBox')[0].innerHTML


    //     console.log(gcContent)




    //     if(psp.checkEmail(gcEmail)){

    //         $.ajax({

    //             type:"POST",
    //             url:"api/gcEmail.php",
    //             data:{gcEmail:gcEmail, gcContent: gcContent, gcNum:checkGiftCardNum},
    //             dataType: "json",
    //             async:true,
    //             error: function(e){

    //                 $('#gcEmailStatus').html('<span style="color:red;">Email sending failed</span>');

    //             },
    //             success: function(e){

    //                 $('#gcEmailStatus').html('<span style="color:green;">Email sent successfully</span>');


    //             }



    //         })

    //         setTimeout(function(){
    //             $('#gcEmailStatus').html('');
    //         }, 5000);


    //     }else{

    //         //Error: eamil is not correct

    //         setTimeout(function(){
    //             $('#gcEmailStatus').html('<span style="color:red;">Email is not correct</span>');
    //         }, 1000);


    //     }
    // });





    // var ckd = 0
    // //Gift Card 
    // $(document).on("focus keyup", "#txtAddress", function(event){
    //     //Control keyup delay
    //     ckd = setTimeout(function(){  giftCardMain() }, 2000);
    // });


    setInterval(function(){

        result = $('#txtAddress').val().match(/(STARBUCKS|AMAZON|VISA)[0-9]{1,2}/g);

        if(result != null &&  checkGiftCardLock==0){

            $('#txtAmount').attr('disabled', 'disabled')


        }else{

            $('#txtAmount').removeAttr('disabled')

        }        


    },1000)




    $(document).on("click", '#sendBtn', function (event)

    {   

        giftCardMain()


        if (!psp.check())

        {

            return;

        }



        $("#confirmModal").modal("show");



        if ( psp.useFiat )

        {

            var btcValue = parseFloat($("#txtAmount").val()) / psp.price;

            btcValue = btcFormat( btcValue );

            txAmount = btcValue;

        }

        else

        {

            txAmount = parseFloat($("#txtAmount").val());

            txAmount = btcFormat( txAmount );

        }


        if( psp.checkGiftCard($("#txtAddress").val()) ){

            txAmount = checkGiftCardAmount;
        }


        //$("#txFee").html( psp.txFeePerKb );

        if(checkGiftCardLock==0){

            $("#confirmAmount").html( txAmount );

            $("#confirmAddress").html( $("#txtAddress").val() );

        }



        if (psp.checkAddress($("#txtAddress").val())) {

            $('#recipientType').text("Bitcoin address");

            $("#confirmAddress").html( $("#txtAddress").val() );

        }else if(psp.checkDomain($("#txtAddress").val())){



            $('#recipientType').text("Domain address");


            chStr  ='<p>'+$("#txtAddress").val()+'</p>'

                   +'<p style="color:#727594; font-size:14px;">with the wallet address</>'

                   +'<p>'+checkDomainBitcoinAddress+'</p>';



            $("#confirmAddress").html(chStr);

        }else if (psp.checkEmail($("#txtAddress").val())){

            $('#recipientType').text("email address");

            $("#confirmAddress").html( $("#txtAddress").val() );

        }

        else if (psp.checkTwitter($("#txtAddress").val())){

            $('#recipientType').text("Twitter handle");

            $("#confirmAddress").html( $("#txtAddress").val() );

        }else if (psp.checkNFC($("#txtAddress").val())){

            $('#confirmSend').attr("disabled", "disabled");

            $('#confirmSend').text("Scanning...");

            $('#recipientType').text("NFC Tag");

            $("#confirmAddress").html( $("#txtAddress").val() );

            if ("NDEFReader" in window){

                try{

                    $("#confirmAddress").html( 'NFC Tag Scanning...' );

                    const ndef = new NDEFReader();

                    ndef.scan();

                    ndef.addEventListener("readingerror", function(){

                        $("#confirmAddress").html( "Sorry! Cannot read data from the NFC tag. Try another one?" );

                        $('#confirmSend').text("Close");

                        $('#confirmSend').data("status","close");

                    });

                    ndef.addEventListener("reading", function({message, serialNumber}){

                        $("#confirmAddress").html( "Found a tag(SN): " + serialNumber );

                        $('#confirmSend').removeAttr("disabled");

                        $('#confirmSend').text("Write Tag");

                        $('#confirmSend').data("status","active");

                        //alert(`> Records: (${message.records.length})`);

                    });

                } catch (error) {

                    alert("Error on scanning: Error: " + error);

                }

            }else{

                $("#confirmAddress").html( 'Device does not support NFC' );

                $('#confirmSend').removeAttr("disabled");

                $('#confirmSend').text("Close");

                $('#confirmSend').data("status","close");

            }

        }

        //psp.send();

    });



    $(document).on("click", '#confirmSend', function (event)

    {   txSendLock = 1;



        if( $(this).data("status") == 'close' ){



            $(this).removeData("status");

            $(this).removeData("url");

            $(this).html("Confirm");

            $("#confirmModal").modal("hide");

            console.log("hide1")

            
        }else if( $('#confirmSend').data("status") == 'active' ){

           
            $(this).removeData("status");

            psp.send();



        }else if( $('#confirmSend').data("status") == 'again' ){

            

            var url = $('#confirmSend').data("url");



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

           psp.send();

        }else{

            if (psp.checkTwitter( $('#txtAddress').val() ) && !confirm("Are you sure you want to send BTC to this Twitter handle? The recipient of the Bitcoin must be following you to get your direct message.")) return;

            psp.send();

            $(this).removeData("status");

            $(this).removeData("url");

            $(this).html("Confirm");

            $("#confirmModal").modal("hide");

  
            if(r_gc){

                setTimeout(function(){

                    $("#confirmModal").modal("show");

                },4000);

            }

        }



    }); 



    $(document).on("click", '#scanNFC', function (event)

    {

        $('#confirmSend').attr("disabled", "disabled");

        

        if ("NDEFReader" in window){

            try{

                $('#confirmSend').text("Scanning...");

                $("#confirmAddress").html( 'NFC Tag Scanning...' );

                const ndef = new NDEFReader();

                ndef.scan();

                ndef.addEventListener("readingerror", function(){

                    $("#confirmAddress").html( "Sorry! Cannot read data from the NFC tag. Try another one?");

                    $('#confirmSend').text("Close");

                    $('#confirmSend').data("status","close");

                });

                ndef.addEventListener("reading", function({message, serialNumber}){

                    $("#confirmAddress").html( "Found a tag (SN): " + serialNumber );

                    $('#confirmSend').removeAttr("disabled");

                    $('#confirmSend').text("Write Tag");

                    $('#confirmSend').data("status","active");

                });

            } catch (error) {

                $("#confirmAddress").html( "Error on scanning: Error: " + error);

            }

        }else{

            $("#confirmAddress").html( 'Device does not support NFC' );

            $('#confirmSend').removeAttr("disabled");

            $('#confirmSend').text("Close");

            $('#confirmSend').data("status","close");

        }



    });



    $(document).on("click", '#passwordInfo', function (event)

    {

        $("#passwordInfoModal").modal("show");

    });



    $(document).on("click", '#settings', function (event)

    {

        if ( !psp.passcode )

            return;



        $("#defaultFeePlaceholder").text(defaultFee);

        $("#settingsChoices,#btnNewRequest").show();

        $("#settingsTitle .glyphicon, #settingsCurrency, #settingsMining, #settingsExport, #settingsSweep, #settingsInvoice, #requestForm, #importRequestBox").hide();

        $("#settingsTitleText").html( "Settings" );

        $("#settingsModal").modal("show");

        $("#currencySelect").html("");

        $("#chartBox").slideUp();



        for ( i in psp.currencyOptions )

        {

            $("#currencySelect").append( "<option value='" + psp.currencyOptions[i] + "'>" + psp.currencyOptions[i] + "</option>" );

        }



        $("#currencySelect").val( psp.currency );

    }); 







    $(document).on("click", '.closeModal, .closeConfirm', function (event)

    {

        $("#request, #infoModal, #confirmModal, #passwordInfoModal, #settingsModal").modal("hide");


        $("#sendBtn").removeAttr("disabled");

        //console.log("close/cancel")

        //Set defaul html template for modal, after close 
        if(r_gc || checkGiftCardMessage.includes("No")){

           
       
            $("#confirmBox").html('<p>Confirm that you are sending</p>'
                +'<p id="confirmAmountLine"><span id="confirmAmount"></span> (BTC)</p>'
                +'<p>to the following <span id="recipientType">address</span></p>'
                +'<div id="confirmAddress"></div>'
                +'<small><span id="generateAddress"></span></small>');

                $("#txtAddress").val("");
                $("#txtAmount").val("");

                

                $("#gcSendEmail").hide();

                $('#confirmSend').show();
                $('.closeConfirm').text("cancel").show();
                $('#minerTxt').show();



                clearTimer();

        }

        checkGiftCardLock = 0;


        



    });  



    $(document).on("change", '#currencySelect', function (event)

    {

        psp.currency = $(this).val();

        psp.getFiatPrice();



        if ( psp.useFiat )

        {

            $(".addonBox").html( psp.getFiatPrefix() );

        }



        if ( psp.useFiat2 )

        {

            $(".addonBox2").html( psp.getFiatPrefix() );

        }



        setCookie("currency", psp.currency, 100);

    });  



    $(document).on("click", '#qrInstallX', function (event)

    {

        $("#qrInstall").slideUp();

    }); 



    $(document).on("click", '#generateBtn', function (event)

    {



    });



    // $(document).on("click", '#passBtn', function (event)

    // {

    //     icon = $(this).find(".glyphicon");

    //     if ( icon.hasClass("glyphicon-unchecked") )

    //     {

    //         icon.removeClass("glyphicon-unchecked").addClass("glyphicon-check");

    //     }

    //     else

    //     {

    //         icon.removeClass("glyphicon-check").addClass("glyphicon-unchecked");

    //     }

    // });



    //DMN

    $(document).on("click", '#qrscan', function (event)

    {

        //$("#walletInfo").slideUp(); 

        //--$("#qrvidBox").slideDown();

        //decodeCode();

        $(window).off('beforeunload');

    });    



    $(document).on("click", '#passBoxTxt', function (event)

    {

        if ( $(".KKCheck").attr("active") != "true" )

        {

            $(".KKCheckInner").addClass("checkGreen");   

            $("#checkIcon").fadeIn();  

            $(".KKCheck").attr("active","true");

        }

        else

        {

            $(".KKCheckInner").removeClass("checkGreen");   

            $("#checkIcon").fadeOut();  

            $(".KKCheck").attr("active","false");

        }

    });



    $(document).on("keypress", '#openPasswordTxt', function (e)

    {

        var p = e.keyCode;

        if (p == 13)

        {

            $("#openWallet").trigger("click");

        }

    });  



    $(document).on("keypress", '#createPasswordTxt', function (e)

    {

        var p = e.keyCode;

        if (p == 13)

        {

            $(this).parent().find("button").trigger("click");

            // $("#openWallet").trigger("click");

        }

    });   



    $(document).on("mouseover", '#tapBox', function (e)

    {

        entroMouse.mouseInside = true;

    }); 



    $(document).on("click", '#changeType', function (e)

    {

        if ( $("#changeType .addonBox").html() != "img/ETHLogo.png" )

        {

            $("#changeType .addonBox").html("img/ETHLogo.png");

            psp.useFiat = false;

            psp.amountFiatValue();

            if ( !mobilecheck() )

                $("#txtAmount").focus();

        }

        else

        {

            $("#changeType .addonBox").html( psp.getFiatPrefix() );

            psp.useFiat = true;

            psp.amountFiatValue();

            if ( !mobilecheck() )

                $("#txtAmount").focus();

        }

    }); 



    $(document).on("click", '#changeType2', function (e)

    {

        if ( $("#changeType2 .addonBox2").html() != "img/ETHLogo.png" )

        {
            console.log("1")
            $("#changeType2 .addonBox2").html("img/ETHLogo.png");

            psp.useFiat2 = false;

            psp.amountFiatValue2();



            if ( !mobilecheck() )

                $("#txtReceiveAmount").focus();

        }

        else

        {    console.log("2")

            $("#changeType2 .addonBox2").html(psp.getFiatPrefix());

            psp.useFiat2 = true;

            psp.amountFiatValue2();

            if ( !mobilecheck() )

                $("#txtReceiveAmount").focus();

        }

    });



    $(document).on("mouseleave", '#tapBox', function (e)

    {

        entroMouse.mouseInside = false;

    });



    $(document).on("click", '#info', function (e)

    {

        $("#infoModal").modal("show");

    }); 



    $(document).on("click", '.openInvoice', function (e)

    {

        num = $(this).attr("invoiceNum");

        invoices = localStorage.invoices;

        invoices = JSON.parse( invoices );

        invoice = invoices[num];

        delete invoice.myAddress;

        urlHash =  btoa( encodeURIComponent( JSON.stringify(invoices[num]) ));

        window.open("http://bitcoin.wallet.ms/request/#" + urlHash,'_blank');

    }); 



    $(document).on("click", '.deleteInvoice', function (e)

    {

        if ( confirm("Are you sure you want to delete this "+ getTypeName( $("#invoiceType").val() ) +"?") )

        {

            num = $(this).attr("invoiceNum");

            invoices = localStorage.invoices;

            invoices = JSON.parse( invoices );

            type = invoices[num].type;

            invoices.splice( num, 1 );

            localStorage.invoices = JSON.stringify( invoices );

            psp.updateInvoices( type );

        }

    }); 



    $(document).on("click", '.sweepInvoice', function (e)

    {

        if ( confirm("Are you sure you want to sweep this "+ getTypeName( $("#invoiceType").val() ) +"?") )

        {

            num = $(this).attr("invoiceNum");

            invoices = localStorage.invoices;

            invoices = JSON.parse( invoices );

            invoice = invoices[num];

            psp.sweep( ethers.utils.keccak256(ethers.utils.toUtf8Bytes(psp.passcode + "_" + invoice.invoiceid))  );

        }

    }); 



    $(document).on("click", '.openInvoiceWallet', function (e)

    {

        num = $(this).attr("invoiceNum");

        invoices = localStorage.invoices;

        invoices = JSON.parse( invoices );

        urlHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(psp.passcode + "_" + invoices[num].invoiceid)) ;

        window.open("http://bitcoin.wallet.ms/#" + urlHash,'_blank');

    });



    $(document).on("click", '#createWallet', function (event)

    {

        psp.passcode = $("#createPasswordTxt").val();

        $("#leadTxt").animate({opacity:0},300);

        setTimeout(function ()

        {

            $("#leadTxt").html("Please re-enter your password to verify")

            $("#leadTxt").animate({opacity:1},300);

        }, 500);



        $("#createPasswordTxt").val("").focus();

        $(this).attr("id", "createWallet2");

        $(this).attr("disabled", "disabled").html("Confirm");

    });



    $(document).on("click", '#createWallet2', function (event)

    {

        if ( $("#createPasswordTxt").val() !=  psp.passcode )

        {

            $("#loginError").slideDown().html("Passwords did not match! Please try again");

            $("#leadTxt").html("Enter a password to secure this wallet");

            $("#createPasswordTxt").val("").focus();

            $(this).attr("id", "createWallet").html("Create Wallet");

            return false;

        }



        try {
            // Check if ethers is loaded
            if (typeof ethers === 'undefined' || typeof ethers.utils === 'undefined') {
                throw new Error('Ethers.js library not loaded. Please refresh the page.');
            }

            userPassHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes($("#createPasswordTxt").val()));

            var passHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(entroMouse.string + "!" + userPassHash));

            var passChk = passHash.substring(2, 12); // Remove '0x' prefix and get 10 chars

            // Generate Ethereum wallet from entropy + password
            var combinedString = entroMouse.string + "!" + userPassHash;
            var entropyHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(combinedString));
            
            // Create private key from hash (32 bytes)
            var privateKey = ethers.utils.hexlify(ethers.utils.arrayify(entropyHash).slice(0, 32));
            
            // Create Ethereum wallet from private key
            var ethWallet = new ethers.Wallet(privateKey);

            if (!ethWallet || !ethWallet.address) {
                throw new Error('Failed to generate wallet address');
            }

            location.replace("#" + entroMouse.string + "!" + passChk);

            var address = ethWallet.address;

            

            psp.passcode = entroMouse.string + "!" + userPassHash;

            psp.address = address;



            psp.open();
        } catch (error) {
            console.error('Error generating Ethereum wallet:', error);
            console.error('Error details:', error.stack);
            $("#loginError").slideDown().html("Error generating wallet: " + error.message + "<br>Please refresh the page and try again.");
            $(this).attr("id", "createWallet").html("Create Wallet");
        }

    });



    $(document).on("click", '#openWallet', function (event)

    {

        var code = window.location.hash.substring(1);

        if (code.indexOf("&") > 0)

        {

            codeArr = code.split("&");

            qrAddress = codeArr[1];

            code = codeArr[0];

            location.replace("#" + code);

        }



        var hashArr = code.split("!");

        try {
            // Check if ethers is loaded
            if (typeof ethers === 'undefined') {
                throw new Error('Ethers.js library not loaded');
            }

            userPassHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes($("#openPasswordTxt").val()));

            var passHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(hashArr[0] + "!" + userPassHash));

            var passChk = passHash.substring(2, 12); // Remove '0x' prefix and get 10 chars

            if (passChk == hashArr[1])

            {

                // Generate Ethereum wallet from entropy + password
                var combinedString = hashArr[0] + "!" + userPassHash;
                var entropyHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(combinedString));
                
                // Create private key from hash (32 bytes)
                var privateKey = ethers.utils.hexlify(ethers.utils.arrayify(entropyHash).slice(0, 32));
                
                // Create Ethereum wallet from private key
                var ethWallet = new ethers.Wallet(privateKey);

                location.replace("#" + hashArr[0] + "!" + passChk);

                var address = ethWallet.address;

                psp.passcode = hashArr[0] + "!" + userPassHash;

                psp.address = address;

                psp.open();
            }
            else
            {
                $("#loginError").slideDown().html("Wrong password!");
            }
        } catch (error) {
            console.error('Error opening wallet:', error);
            $("#loginError").slideDown().html("Error opening wallet. Please refresh the page and try again.");
        }

        if (window.qrAddress )

        {

            $("#sendBox").slideDown();

            $("#receiveBox").hide();

            //--$("#qrvidBox").hide();      //dmn

            $("#sendBoxBtn").addClass("active");

            $("#receiveBoxBtn").removeClass("active");

            $(".tabButton").addClass("tabsOn");

            $("#txtAddress").val(qrAddress);

        }

    });



    $(document).on("keyup", '#createPasswordTxt', function (event)

    {

        if ($(this).val().length > 0)

        {

            $("#createWallet, #createWallet2").removeAttr("disabled");

        }

        else

        {

            $("#createWallet, #createWallet2").attr("disabled", "disabled");

        }

    });



    $(document).on("keyup", '#importRequestID', function (event)

    {

        if ($(this).val().length > 0)

        {

            $("#importRequestBtn").removeAttr("disabled");

        }

        else

        {

            $("#importRequestBtn").attr("disabled", "disabled");

        }

    });



    $(document).on("click", '#importRequestBtn', function (event)

    {

        // Generate Ethereum wallet from passcode + invoice ID
        var combinedString = psp.passcode + "_" + $("#importRequestID").val();
        var entropyHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(combinedString));
        
        // Create private key from hash (32 bytes)
        var privateKey = ethers.utils.hexlify(ethers.utils.arrayify(entropyHash).slice(0, 32));
        var ethWallet = new ethers.Wallet(privateKey);

        var address = ethWallet.address;



        type = $("#invoiceType").val();

        invoice = {address:address,"amount":0,title: "Imported " + getTypeName( type ),invoiceid:$("#importRequestID").val(),description:"",myAddress:psp.address, type:type};

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



        $("#importRequestBox").slideUp();



        if ( type == "SmartFund" )

        {

            psp.openSmartFundBox();

        }

        else

        {

            psp.openSmartRequestBox();

        }

    });



    $(document).on("keyup", '#txtReceiveAmount', function (event)

    {

        if ($(this).val().length > 0 && $(this).val() > 0 )

        {

            $("#generateBtn").removeAttr("disabled");

            psp.amountFiatValue2();

        }

        else

        {

            $("#generateBtn").attr("disabled", "disabled");

            $("#fiatPrice2").html("");

        }

    });  



    $(document).on("keyup", '#txtFeeAmount', function (event)

    {

        if ($(this).val().length > 0 && $(this).val() > 0 && !isNaN( $(this).val() ) )

        {

            amount = $(this).val();

            amount = parseFloat(amount);

            var fiatValue = psp.price * amount;

            fiatValue = fiatValue.toFixed(2);

            $("#fiatPriceFee").html("(" + psp.getFiatPrefix() + formatMoney(fiatValue) + ")");

            psp.setTxFeePerKb( amount );

        }

        else

        {

            $("#fiatPriceFee").html("");

        }

    });  



    $(document).on("keyup", '#txtAmount', function (event)

    {

        amount = $(this).val();

        if ( psp.useFiat )

        {

            amount = parseFloat( amount ) / psp.price;

            amount = btcFormat( amount );

        }



        if ( $(this).val().length > 0 )

        {

            psp.amountFiatValue();

            $(this).css({"font-size":"24px"});

        }

        else

        {

            $("#fiatPrice").html("");

            $(this).css({"font-size":"14px"});

        }



        if ( $(this).val().length > 0 && parseFloat( amount ) <= psp.balance  && parseFloat(amount) * 100000000 > bitcoin2.networks.bitcoin.dustThreshold)

        {

            $("#sendBtn").removeAttr("disabled");

        }

        else

        {

            $("#sendBtn").attr("disabled", "disabled").html("Send");

        }



        if ( $("#txtAmount").val().toLowerCase() == "vapor" ) //Easter egg...SHHH!

        {

            playBeep();

            $("#btcBalance").html("0.00000000");

            $("#fiatValue").html("$0.00");

            $("#txtAmount").val("").css({"font-size":"14px"});

            setMsg("Payment Sent!", true);

        }



        if ( $("#txtAmount").val().toLowerCase() == "ballin" ) //Easter egg...SHHH!

        {

            playBeep();

            $("#btcBalance").html("9,237.82039284");

            cash = 9237.82039284 * psp.price;

            cash = cash.toFixed(2);

            $("#fiatValue").html(psp.getFiatPrefix() + formatMoney(cash));

            $("#txtAmount").val("").css({"font-size":"14px"});

        }



        if ( $("#txtAmount").val().toLowerCase() == "baron" ) //Easter egg...SHHH!

        {

            playBeep();

            setTimeout( function()

            {

                playBaron();

                $("#btcBalance").html("9,237.82039284");

                cash = 9237.82039284 * psp.price;

                cash = cash.toFixed(2);

                $("#fiatValue").html(psp.getFiatPrefix() + formatMoney(cash));

                $("#txtAmount").val("").css({"font-size":"14px"});

            }, 500);

        } 



        if ( $("#txtAmount").val().toLowerCase() == "tdfw" ) 

        {

            playTurn();

            $("#txtAmount").val("").css({"font-size":"14px"});

        } 



        if ( $("#txtAmount").val().toLowerCase() == "stop" ) //Easter egg...SHHH!

        {

            psp.snd.pause();

            $("#txtAmount").val("").css({"font-size":"14px"});

        }



        if ( $("#txtAmount").val().toLowerCase() == "max" || $("#txtAmount").val().toLowerCase() == "all" )

        {

            bigBalance = btcstr2bignum( psp.balance.toString() );

            bigFee = btcstr2bignum((estimateTxKb() * psp.txFeePerKb).toString());

            bigAmount = bigBalance.subtract( bigFee );

            // amount = psp.balance - psp.txFee;

            // amount = btcFormat( amount );

            amount = bigAmount / 100000000;

            amount = amount.toFixed(8);



            if ( amount <= 0 )

            {

                amount = 0;

            }

            else

            {

                $("#sendBtn").removeAttr("disabled");

            }



            $("#txtAmount").val( amount );

            psp.amountFiatValue();

        }

    }); 



    $(document).on("focus", '#txtAddress', function (event)

    {

        $(this).css({"background-color":"#FFFFFF", color:"#555555"});

        $("#oneNameInfo").hide();

    }); 



    $(document).on("click", '.qr-link img', function (event)

    {

        $(".smallQR").switchClass("smallQR", "bigQR",1);

        $(".bigQR").switchClass("bigQR", "smallQR",1);

    });



    $(document).on("click", '#btnNewRequest', function (event)

    {

        $("#requestForm").slideDown();

        $(this).hide();

    });



    $(document).on("blur", '#txtAddress', function (event)

    {

        if ( $(this).val().length > 0 && !psp.checkAddress( $(this).val() ) )

        {

            $("#oneNameName").html("Loading...");

            $("#oneNameImg").html("");

            $("#oneNameInfo").show();



            $.ajax(

            {

                type: "GET",

                url: "https://bitcoin.wallet.ms/lookup.php?id=" + $("#txtAddress").val(),

                async: true,

                cors: true ,

                dataType: "json",

                data:

                {}

            }).done(function (msg)

            {

                if ( msg.hasOwnProperty( "bitcoin" ) )

                {

                    $("#txtAddress").val(msg.bitcoin.address).css({color:"#4CAE4C"});

                    if ( msg.hasOwnProperty("name") )

                    {

                        $("#oneNameName").html( htmlEncode( msg.name.formatted ) );

                    }



                    if ( msg.hasOwnProperty("avatar") )

                    {

                        $("#oneNameImg").html("<img src=\"" + encodeURI(msg.avatar.url) + "\">");

                    }

                    else

                    {

                        $("#oneNameImg").html("");

                    }



                    if ( mobilecheck() )

                    {

                        $("#oneNameInfo").css({"right":"55px"});

                    }



                    $("#oneNameInfo").show();

                    //$("#txtAddress").val(msg.bitcoin.address).css({"background-color":"#52B3EA"});

                }

                else

                {

                    // $("#txtAddress").css({"background-color":"#DA9999"});

                    $("#oneNameInfo").hide();

                }

            });

        }

    }); 



    $(document).on("keyup", '#openPasswordTxt', function (event)

    {

        if ($(this).val().length > 0)

        {

            $("#openWallet").removeAttr("disabled");

        }

        else

        {

            $("#openWallet").attr("disabled", "disabled");

        }

    });



    function closeTabs()

    {

        $("#sendBox").slideUp();

        $("#receiveBox").slideUp();

        //--$("#qrvidBox").slideUp();           //dmn

        $("#sendBoxBtn").removeClass("active");

        $("#receiveBoxBtn").removeClass("active");

        $(".tabButton").removeClass("tabsOn");

    }



    $(document).on("click", '#receiveBoxBtn', function (event)

    {

        if ( $(this).hasClass("active") )

        {

            closeTabs();

        }

        else

        {     

            closeVideo();       

            $("#receiveBox").slideDown();

            $("#sendBox").hide();

            //--$("#qrvidBox").hide();

            $("#receiveBoxBtn").toggleClass("active", 250 );

            $("#sendBoxBtn").removeClass("active");

            $(".tabButton").addClass("tabsOn");



            if ( !mobilecheck() )

            {

                $("#txtReceiveAmount").focus();                

            }

        }

    });



    //DMN

    $(document).on("click", '#sendBoxBtn', function (event)

    {

        if ( $(this).hasClass("active") )

        {

            closeVideo();

            closeTabs();

        }

        else

        {

            $("#sendBox").slideDown();

            $("#receiveBox").hide();

            //--$("#qrvidBox").hide();      //dmn

            $("#sendBoxBtn").toggleClass("active", 250 );

            $("#receiveBoxBtn").removeClass("active");

            $(".tabButton").addClass("tabsOn");



            if ( !mobilecheck() )

            {

                $("#txtAddress").focus();                

            }

        }

    });



    $(document).on("click", '#generateBtn', function (event)

    {

        psp.generate();

    }); 



    $(document).on("keyup", '#requestForm input', function (event)

    {

        if ( psp.checkInvoice() )

        {

            $("#btnCreateInvoice").removeAttr("disabled");

        }

        else

        {

            $("#btnCreateInvoice").attr("disabled","disabled");

        }

    }); 



    $(document).on("click", '#requestHelp', function (event)

    {

        $("#requestHelpText").slideToggle();

    }); 



    $(document).on("click", '#settingsTitle', function (event)

    {

        $("#settingsChoices,#btnNewRequest").show();

        $("#settingsTitle .glyphicon, #settingsCurrency, #settingsMining, #settingsExport, #settingsSweep, #settingsInvoice, #requestForm, #importRequestBox").hide();

        $("#settingsTitleText").html( "Settings" );

    });



    $(document).on("click", '#choiceCurrency', function (event)

    {

        $("#settingsTitle .glyphicon, #settingsCurrency").show();

        $("#settingsChoices").hide();

        $("#settingsTitleText").html( "Set Currency" );

    });



    $(document).on("click", '#choiceSmartRequest', function (event)

    {

        psp.openSmartRequestBox();

    });



    $(document).on("click", '#choiceSmartFund', function (event)

    {

        psp.openSmartFundBox();

    });



    $(document).on("click", '.importRequest', function (event)

    {

        psp.openImportRequest();

    });



    $(document).on("click", '#cancelBtn', function (event)

    {

        $("#btnNewRequest").show();

        $("#requestForm").slideUp();

        psp.updateInvoices( $("#invoiceType").val() );

    }); 



    $(document).on("click", '#getStarted', function (event)

    {

        $("#noInvoice").slideUp();

        $("#requestForm").slideDown();

    });



    $(document).on("click", '#invoiceLinkReceive', function (event)

    {

        $("#request").modal("hide");

        $("#settingsModal").modal("show");

        psp.openInvoiceBox();

        $("#txtInvoiceAmount").val( $("#txtReceiveAmount").val() );

        $("#btnNewRequest").trigger("click");

    });



    $("#price").hover( function ()

    {

        $("#chartBox").stop(true);

        psp.get24Chart();

    }, function ()

    {

        $("#chartBox").stop(true);

        $("#chartBox").slideUp();

    });



    $(document).on("click", '#choiceExport', function (event)

    {

        $("#settingsTitle .glyphicon, #settingsExport").show();

        $("#settingsChoices").hide();

        $("#settingsTitleText").html( "Export Private Keys" );



        try {
            // Check if ethers is loaded
            if (typeof ethers === 'undefined') {
                throw new Error('Ethers.js library not loaded. Please refresh the page.');
            }

            // Generate Ethereum wallet from passcode
            var entropyHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(psp.passcode));
            
            // Create private key from hash (32 bytes)
            var privateKeyBytes = ethers.utils.arrayify(entropyHash).slice(0, 32);
            var ethWallet = new ethers.Wallet(ethers.utils.hexlify(privateKeyBytes));
            
            privateKey = ethWallet.privateKey;

            $("#txtBrain").val( psp.passcode );

            $("#txtPrivate").val( privateKey );
        } catch (error) {
            console.error('Error exporting wallet:', error);
            alert('Error exporting wallet: ' + error.message);
        }

    });



    $(document).on("click", '#choiceSweep', function (event)

    {

        $("#settingsTitle .glyphicon, #settingsSweep").show();

        $("#settingsChoices").hide();

        $("#settingsTitleText").html( "Sweep Private Keys" );

    });









    $(document).on("keyup", '#settingsSweepWIF', function (event)

    {

        if ($(this).val().length > 0)

        {

            $("#settingsSweepBtn").removeAttr("disabled");

        }

        else

        {

            $("#settingsSweepBtn").attr("disabled", "disabled");

        }

    });



    $(document).on("click", '#settingsSweepBtn', function (event)

    {

        try

        {

            // Accept Ethereum private key (hex format with or without 0x prefix)
            var privateKeyInput = $('#settingsSweepWIF').val().trim();
            
            // Remove 0x prefix if present
            if (privateKeyInput.startsWith('0x')) {
                privateKeyInput = privateKeyInput.substring(2);
            }
            
            // Validate it's a valid hex string and 64 characters (32 bytes)
            if (!/^[0-9a-fA-F]{64}$/.test(privateKeyInput)) {
                throw new Error("Invalid Ethereum private key format");
            }
            
            // Create Ethereum wallet from private key
            var ethWallet = new ethers.Wallet('0x' + privateKeyInput);

            if ( confirm("Are you sure you want to sweep this private key?") )

            {

                psp.sweep(null, ethWallet);

            }




        }

        catch (err)

        {

            alert("Failed to process this WIF Key. Please, enter correct or another WIF Key.");

            return;

        }





    });



    $("#settingsModal").on("hidden.bs.modal", function() {


       $("#settingsSweepWIF").val("")
       
    });



    $(document).on("click", '#choiceMining', function (event)

    {

        var fiatValue = psp.price * psp.txFeePerKb;

        fiatValue = fiatValue.toFixed(2);

        $("#fiatPriceFee").html("(" + psp.getFiatPrefix() + formatMoney(fiatValue) + ")");

        $("#txtFeeAmount").val( psp.txFeePerKb );

        $("#settingsTitle .glyphicon, #settingsMining").show();

        $("#settingsChoices").hide();

        $("#settingsTitleText").html( "Set Mining Fee" );

        $(".settingsOption").removeClass("optionActive");



        switch ( parseFloat( psp.txFeePerKb ) )

        {

            case defaultFee:

                $(".settingsOption[type='normal']").addClass("optionActive");

                break;

            default:

                $(".settingsOption[type='custom']").addClass("optionActive");

                $("#feeHolder").show();

                break;

        }

    });



    $(document).on("click", '.miningOptionLeft', function (event)

    {

        $(".settingsOption").removeClass("optionActive");

        $(this).find(".settingsOption").addClass("optionActive", 300);

        $("#feeHolder").hide();



        switch ( $(this).find(".settingsOption").attr("type") )

        {

            case "normal":

                psp.setTxFeePerKb( defaultFee );

                break;

            case "custom":

                $("#feeHolder").show();

                break;

            default:

                $(".settingsOption[type='custom']").addClass("optionActive", 300);

                break;

        }

    });



    $(document).on("click", '#btnCreateInvoice', function (event)

    {

        psp.createInvoice();

    });



    var code = window.location.hash.substring(1);



    qrLogin = false;



    if (code.indexOf("&") > 0)

    {

        qrLogin = true;

        codeArr = code.split("&");

        qrAddress = codeArr[1];

        code = codeArr[0];

        psp.passcode = code;

        urlArr = code.split("!");

        userPassHash =  urlArr[1];

        passHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(urlArr[0] + "!" + userPassHash));

        var passChk = passHash.substring(2, 12); // Remove '0x' prefix and get 10 chars

        location.replace("#" + urlArr[0] + "!" + passChk);

        if ( qrAddress )

        {

            $("#sendBox").slideDown();

            $("#receiveBox").hide();

            //--$("qrvidBox").hide();       //dmn

            $("#sendBoxBtn").addClass("active");

            $("#receiveBoxBtn").removeClass("active");

            $(".tabButton").addClass("tabsOn");



            qrAddress = decodeURIComponent(qrAddress);



            if ( qrAddress.indexOf(":") > 0 )

            {

                address = qrAddress.match(/[13][1-9A-HJ-NP-Za-km-z]{26,33}/g);

                address = address[0];

                uriAmount = qrAddress.match(/=[0-9\.]+/g);

                qrAddress = address;

                if ( uriAmount != null )

                {

                    uriAmount = uriAmount[0].replace("=", "");

                }



                if ( uriAmount )

                {

                    $("#txtAmount").val( uriAmount );

                }

            }



            $("#txtAddress").val(qrAddress);

        }

    }



    if (code.length > 9)

    {

        if (code.indexOf("!") > 0 && !qrLogin)

        {

            $(".progress, #tapBox, #passwordCheckBox, #passBox").hide();

            $("#generate").show();

            $("#openPassword").slideDown();



            if ( !mobilecheck() )

            {

                setTimeout( function ()

                {

                    $("#openPasswordTxt").focus();

                }, 500);

            }



            $("#leadTxt").html("Please enter password to open this wallet");

        }

        else

        {

            if ( qrLogin )

            {

                code = psp.passcode;

            }



            try {
                // Check if ethers is loaded
                if (typeof ethers === 'undefined') {
                    throw new Error('Ethers.js library not loaded');
                }

                // Generate Ethereum wallet from code/entropy
                var entropyHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(code));
                
                // Create private key from hash (32 bytes)
                var privateKey = ethers.utils.hexlify(ethers.utils.arrayify(entropyHash).slice(0, 32));
                
                // Create Ethereum wallet from private key
                var ethWallet = new ethers.Wallet(privateKey);

                var address = ethWallet.address;

                psp.passcode = code;

                psp.address = address;

                psp.open();
            } catch (error) {
                console.error('Error opening wallet:', error);
                alert('Error opening wallet. Please refresh the page and try again.');
            }

        }

    }

    else

    {

        entroMouse.start();

        $("#generate").show();

    }

});



function btcFormat (amount)

{

    // amount = parseFloat( amount );

    // amount = Math.floor(amount * 100000000) / 100000000

    // if ( amount == 0 )

    // {

    //     return amount.toFixed(8);

    // }

    // return amount;

    return amount.toFixed(8);

}



function htmlEncode(value){

  return $('<div/>').text(value).html();

}



function htmlDecode(value){

  return $('<div/>').html(value).text();

}



function getTypeName ( type )

{

    if ( type == "SmartRequest" )

    {

        return "Payment Request";

    }

    else

    {

        return "Fundraiser";

    }

}



function getVideoID(url) {

  var p = /^(?:https?:\/\/)?(?:www\.)?(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))((\w|-){11})(?:\S+)?$/;

  return (url.match(p)) ? RegExp.$1 : false;

}



//dmn

//if (mobilecheck())

//{

//    $("#qrInstall").show();

//    if( /Android/i.test(navigator.userAgent) ) 

//    {

//        $("#qrInstallIcon a img").attr("src", "img/droid.png");

//        $("#storeName").html("Google Play Store")

//        $("#qrInstallIcon a").attr("href", "https://play.google.com/store/apps/details?id=com.google.zxing.client.android&hl=en");

//        $("#qrInstallInfo a").attr("href", "https://play.google.com/store/apps/details?id=com.google.zxing.client.android&hl=en");

//    }

//}