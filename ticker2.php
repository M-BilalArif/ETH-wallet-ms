<?php

$curl = curl_init();
curl_setopt_array($curl, array(
    CURLOPT_RETURNTRANSFER => 1,
    CURLOPT_URL => "https://blockchain.info/ticker"
));
echo curl_exec($curl);
curl_close($curl);
