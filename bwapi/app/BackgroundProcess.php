<?php 


	$params = json_decode($argv[1], true);

	$transactionKey = $params['transactionKey'];

	$apiUrl = $params['apiUrl'];


	//Set 5 min in seconds (300)
	$s = 0;

	while($s<=300){


		$s = $s + 10;

		$ch = curl_init();
		curl_setopt($ch, CURLOPT_URL, $apiUrl.'checkPay/'.$transactionKey);
		curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
		$out = curl_exec($ch);
		$status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
	

		if($status == 200){

			$j = json_decode($out, true);



			//Log
			$o = $transactionKey.' '.date('Y-m-d H:i:s');

			if(array_key_exists("status", $j)){

				$o .= ' '.$j['status'];
			}


			if(array_key_exists("btc_received", $j)){

				$o .= ' '.$j['btc_received'];
			}


			if(array_key_exists("sold", $j)){

				$o .= ' sold:'.$j['sold'];
			}


			if(array_key_exists("sendEmail", $j)){

				$o .= ' sendEmail:'.$j['sendEmail'];
			}




			$o .= "\n";

			$fp = fopen('transactionsLOG.txt', 'a+');
			fwrite($fp, $o);
			fclose($fp);

			//Log end



			if($j['status']==0 or $j['status']==2 or $j['status']==3){

				break;

			}

		}






		usleep(10000000);




	}




	

   




?>