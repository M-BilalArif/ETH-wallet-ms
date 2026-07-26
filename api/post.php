<?php

if(isset($_POST['api_key'])){

	$p=[];

	$p['api_key'] = $_POST['api_key'];

	if(isset($_POST['domain'])){

		$p['domain'] = $_POST['domain'];

	}


	if(isset($_POST['giftCard'])){

		$p['giftCard'] = $_POST['giftCard'];

	}



	$ch = curl_init();
	curl_setopt($ch, CURLOPT_URL, 'http://localhost/blockchain/bwrbf/domainAPI.php');
	//curl_setopt($ch, CURLOPT_URL, 'https://merchant-api.info/domainAPI.php');
	curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
	curl_setopt($ch, CURLOPT_POST, true);
	curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($p));
	$out = curl_exec($ch);
	$status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
	

	if($status == 200){

		echo $out;

	}else{

		return false;
	}


	curl_close($ch);


}































?>