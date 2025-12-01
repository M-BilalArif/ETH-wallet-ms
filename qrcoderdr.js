
var html5QrCode = null;

function decodeCode(){

    var sh = window.screen.height || 0;
    var sw = window.screen.width || 0;
    
    var view = document.getElementById('camera-view');
    var side = document.getElementById('camera-side');
    var zoomBar = document.getElementById('camera-zoom-bar');
    var zoomIn = document.getElementById('camera-zoom-in');
    var zoomOut = document.getElementById('camera-zoom-out');
    view.style.display = "block";
    var focused = true;



    //On success
    var qrCodeSuccessCallback = function(decodedText, decodedResult){

        var qrAddress = decodedText;
        qrAddress = decodeURIComponent(qrAddress);

        console.log(qrAddress);
        
        // Check for Ethereum address (0x followed by 40 hex characters, or ethereum:0x...)
        var ethAddressMatch = qrAddress.match(/(ethereum\:)?(0x[a-fA-F0-9]{40})/g);
        if (ethAddressMatch) {
            var address = ethAddressMatch[0];
            // Remove ethereum: prefix if present
            if (address.startsWith('ethereum:')) {
                address = address.substring(9);
            }
            
            // Extract amount if present (value parameter for Ethereum)
            var uriAmount = qrAddress.match(/[?&]value=([0-9\.]+)/);
            if(address != null) {
                $("#txtAddress").val(address);
                if (uriAmount != null) {
                    $("#txtAmount").val(uriAmount[1]);
                }
            } else {
                alert('Invalid Ethereum QR Code');
            }

            closeVideo();
            $("#camera-view").hide();
            $("#walletInfo").slideDown();
            return;
        }
        
        // Check for Bitcoin address (legacy support)
        if ( qrAddress.match(/(bitcoin\:[13]|[13])[1-9A-HJ-NP-Za-km-z]{25,34}/g) ) {
            var address = qrAddress.match(/(bitcoin\:[13]|[13])[1-9A-HJ-NP-Za-km-z]{25,34}/g);
            address = address[0];
            address = address.substring( 0, 8 ) == 'bitcoin:' ? address.substring( 8 ) : address;
            uriAmount = qrAddress.match(/[?&]amount=([0-9\.]+)/);
            if(address != null) {
                $("#txtAddress").val(address);
                if (uriAmount != null) {
                    $("#txtAmount").val(uriAmount[1]);
                }
            }else{
                alert( 'Invalid QR Code' );
            }

            closeVideo();
            $("#camera-view").hide();
            $("#walletInfo").slideDown();
            return;
        }
        
        // Check for plain Ethereum address (just 0x...)
        if (qrAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
            $("#txtAddress").val(qrAddress);
            closeVideo();
            $("#camera-view").hide();
            $("#walletInfo").slideDown();
            return;
        }
        
        // If none of the above match, show error
        alert('QR Code is not valid. Please scan an Ethereum address (0x...) or Bitcoin address.');
        
    };




    // Config
    var config = { 'fps': 30, 'aspectRatio': 1, 'qrbox': { 'width': 280, 'height': 280 } };

    // Supprted codes
    var formatsToSupport = [ 
            Html5QrcodeSupportedFormats.QR_CODE
        ];

    // Define
    html5QrCode = new Html5Qrcode( "camera-reader", { 'formatsToSupport': formatsToSupport } );

    // camera side (user = front and environment = back )
    var facingMode = sw > 992 && sh > 512 ? "user" : "environment";


    
    // If you want to prefer front camera
    var start = html5QrCode.start( { 'facingMode': facingMode }, config, qrCodeSuccessCallback );

    var zoom = {
        'min': 1,
        'max': 1,
        'step': 0,
        'value': 1
    };

    var settings, capabilities;
    
    // Started check promise
    start.then(function(){
        side.style.display = "inline-block";
        view.style.display = "block";

        settings = html5QrCode.getRunningTrackSettings();

        if ( 'zoom' in settings ) {
            
            view.classList.add('camera-zoom');

            capabilities = html5QrCode.getRunningTrackCapabilities();

            zoomBar.min = zoom.min = capabilities.zoom.min;
            zoomBar.max = zoom.max = capabilities.zoom.max;
            zoomBar.step = zoom.step = capabilities.zoom.step;
            zoomBar.value = zoom.value = settings.zoom;
            
        }else{
            view.classList.remove('camera-zoom');
        }

    },function(err){
        side.style.display = "none";
        view.style.display = "none";
        alert(err);
    });

    document.body.classList.add('modal_showing');

    zoomBar.oninput = function(){
        if ( capabilities && settings && 'zoom' in settings ) {
            zoom.value = zoomBar.value;
            html5QrCode.applyVideoConstraints({advanced: [ {'zoom' : zoomBar.value } ]});
        }
        zoomIn.disabled = zoom.value >= zoom.max;
        zoomOut.disabled = zoom.value <= zoom.min;
    };

    zoomIn.onclick = function(){

        zoom.value = zoom.value + zoom.step;
        zoom.value = zoom.value > zoom.max ? zoom.max : zoom.value;

        if ( capabilities && settings && 'zoom' in settings ) {
            html5QrCode.applyVideoConstraints({advanced: [ {'zoom' : zoom.value } ]});
            zoomBar.value = zoom.value;
        }

        zoomIn.disabled = zoom.value >= zoom.max;

    };

    zoomOut.onclick = function(){

        zoom.value = zoom.value - zoom.step;
        zoom.value = zoom.value < zoom.min ? zoom.min : zoom.value;

        if ( capabilities && settings && 'zoom' in settings ) {
            html5QrCode.applyVideoConstraints({advanced: [ {'zoom' : zoom.value } ]});
            zoomBar.value = zoom.value;
        }

       zoomOut.disabled = zoom.value <= zoom.min;

    };


    side.onclick = function(){

        //if( html5QrCode.isScanning ){
            if( html5QrCode!==null && typeof html5QrCode.getState == 'function' &&
            ( [Html5QrcodeScannerState.SCANNING, Html5QrcodeScannerState.PAUSED].indexOf( html5QrCode.getState() ) > -1 || html5QrCode.isScanning ) ){
            // Stopped check promise
            html5QrCode.stop().then(function(ignore){
                // QR Code scanning is stopped.
                html5QrCode.clear();
            }).catch(function(err){
                // Stop failed, handle it.
            });
        }

        facingMode = facingMode == "environment" ? "user" : "environment";

        start = html5QrCode.start( { 'facingMode': facingMode }, config, qrCodeSuccessCallback );

        // Started check promise
        start.then(function(){

            side.style.display = "inline-block";
            view.style.display = "block";

            settings = html5QrCode.getRunningTrackSettings();

            if ( 'zoom' in settings ) {
            
                view.classList.add('camera-zoom');
                
                capabilities = html5QrCode.getRunningTrackCapabilities();

                zoomBar.min = zoom.min = capabilities.zoom.min;
                zoomBar.max = zoom.max = capabilities.zoom.max;
                zoomBar.step = zoom.step = capabilities.zoom.step;
                zoomBar.value = zoom.value = settings.zoom;
            
            }else{
                view.classList.remove('camera-zoom');
            }

        },function(err){
            side.style.display = "none";
            view.style.display = "none";
            alert(err);
        });
        
    };


    document.onclick = function(e){

        var target;
        target = e.target || e.srcElement || e.currentTarget || null;
        target = target.nodeType == 3 ? target.parentNode : target ;

        if( !(target.compareDocumentPosition(view) & Node.DOCUMENT_POSITION_CONTAINS || target.isEqualNode(view) ) /* && focused */ ) {
            if( html5QrCode!==null && typeof html5QrCode.getState == 'function' &&
                ( [Html5QrcodeScannerState.SCANNING, Html5QrcodeScannerState.PAUSED].indexOf( html5QrCode.getState() ) > -1 && html5QrCode.isScanning ) ){
            //if( html5QrCode.isScanning ){
                html5QrCode.stop().then(function(ignore){
                    // QR Code scanning is stopped.
                    html5QrCode.clear();
                }).catch(function(err){
                    // Stop failed, handle it.
                });
                side.style.display = "none";
                view.style.display = "none";
                document.body.classList.remove('modal_showing');
            }
        }

    };

    window.onblur = function(){
        focused = false;
        //if( html5QrCode.isScanning ){
        if( html5QrCode!==null && typeof html5QrCode.getState == 'function' && 
           ( html5QrCode.isScanning && html5QrCode.getState() == Html5QrcodeScannerState.SCANNING || html5QrCode.isScanning ) ){
            html5QrCode.pause(true);
        }
    };

    window.onfocus = function(e){
        focused = true;
        if( ( html5QrCode!==null && typeof html5QrCode.getState == 'function' && 
            !html5QrCode.isScanning || html5QrCode.getState() == Html5QrcodeScannerState.PAUSED ) && view.style.display != "none" ){
            html5QrCode.resume();
            side.style.display = "inline-block";
            view.style.display = "block";
        }
    };

}


function closeVideo(){
    
    if( html5QrCode!==null && typeof html5QrCode.getState == 'function' &&
        ( [Html5QrcodeScannerState.SCANNING, Html5QrcodeScannerState.PAUSED].indexOf( html5QrCode.getState() ) > -1 || html5QrCode.isScanning ) ){
        
        // stop camera promise
        html5QrCode.stop().then(function(ignore){
            // QR Code scanning is stopped.
            html5QrCode.clear();
        }).catch(function(err){
            // Stop failed, handle it.
        });

        var view = document.getElementById('camera-view');
        var side = document.getElementById('camera-side');
        side.style.display = "none";
        view.style.display = "none";

    }

}

/*
const qrReader = new ZXing.BrowserQRCodeReader();
var deviceId;

function getVideoId()
{
    qrReader.getVideoInputDevices().then((videoDevices) => {
        deviceId = videoDevices[0].deviceId;
    }).catch((err) => {
        console.error(err)
    })
}

function decodeCode()
{
    getVideoId();

    qrReader.decodeFromInputVideoDevice(deviceId, "video").then((result) => {
        console.log(result)

        var qrAddress = result;
        qrAddress = decodeURIComponent(qrAddress);
        console.log(qrAddress);
        if (qrAddress.indexOf(":") > 0) {
            address = qrAddress.match(/[13][1-9A-HJ-NP-Za-km-z]{26,33}/g);
            address = address[0];
            uriAmount = qrAddress.match(/=[0-9\.]+/g);
            qrAddress = address;
            if(qrAddress != null) {
                $("#txtAddress").val(qrAddress);
                if (uriAmount != null) {
                    uriAmount = uriAmount[0].replace("=", "");
                    $("#txtAmount").val( uriAmount );                    
                }
            }
        }
        closeVideo();    
        $("#qrvidBox").hide(); 
        $("#walletInfo").slideDown();
      }).catch((err) => {
        console.error(err)
      })
}
*/
