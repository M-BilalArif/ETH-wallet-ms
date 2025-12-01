<?php 
//v1.4
//03-10-2023


namespace App;
use App\Db;
use Nimiq\XPub;
use App\GiftCard;

use Endroid\QrCode\QrCode;
use Endroid\QrCode\Color\Color;
use Endroid\QrCode\Encoding\Encoding;
use Endroid\QrCode\ErrorCorrectionLevel\ErrorCorrectionLevelLow;
use Endroid\QrCode\Label\Label;
use Endroid\QrCode\Logo\Logo;
use Endroid\QrCode\RoundBlockSizeMode\RoundBlockSizeModeMargin;
use Endroid\QrCode\Writer\PngWriter;
use Endroid\QrCode\Writer\ValidationException;


class Transaction{





	static function getRate(){

		$return = false; 

		$ch = curl_init();
		curl_setopt($ch, CURLOPT_URL, 'https://blockchain.info/ticker');
		curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
		curl_setopt($ch, CURLOPT_MAXREDIRS, 10);
		curl_setopt($ch, CURLOPT_TIMEOUT, 30);
		curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
		curl_setopt($ch, CURLOPT_USERAGENT,'Mozilla/5.0 (Windows; U; Windows NT 5.1; en-US; rv:1.8.1.13) Gecko/20080311 Firefox/2.0.0.13');
		$out = curl_exec($ch);
		$status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
		$gi = curl_getinfo($ch);
		curl_close($ch);
		
	

		if($status == 200){


			$gr = json_decode($out, true);
			$return= $gr['USD']['15m'];

			
		}


		return $return;		
	}


	static function getQR($text){




		$writer = new PngWriter();

		$qrCode = QrCode::create($text)
		    ->setEncoding(new Encoding('UTF-8'))
		    ->setErrorCorrectionLevel(new ErrorCorrectionLevelLow())
		    ->setSize(600)
		    ->setMargin(10)
		    ->setRoundBlockSizeMode(new RoundBlockSizeModeMargin())
		    ->setForegroundColor(new Color(0, 0, 0))
		    ->setBackgroundColor(new Color(255, 255, 255));


		    $result = $writer->write($qrCode);

		    return $result->getDataUri();
	}


	static function  getAddressFromXpub($xpub){

		$address = false;

		$i = 0;
		
		while (1) {
			


			$xp = XPub::fromString($xpub);

			$xp_i = $xp->derive([0, $i ]);

			$xp_string = $xp_i->toString( $asHex = false );

			$address =  $xp_i->toAddress( $coin = 'btc' );


			$q=Db::conn()->query("SELECT `address` 
				FROM `gct`
				WHERE `address` LIKE '$address' 
				LIMIT 1")->fetch_assoc();


			if(!is_array($q)){

				break; 

			}


			$i++;


		}


		return $address;
		


	}

	//Return array: appUrl, apiUrl
	static function setDomains($params){

		$r = [];

		//Set app url 
		//ex: https://app/, https://app/path,
		$ud= urldecode($params['appurl']);
		$r["appUrl"] =  str_replace("|", "/", $ud);


		//Set api url 
		//ex: https://api/, https://api/path,
		$apiUrl = $_SERVER['REQUEST_SCHEME'] .'://'.$_SERVER['HTTP_HOST'];

		$ex = explode("/", $_SERVER['SCRIPT_NAME']);

		foreach ($ex as $e) {

		if(strlen(trim($e))>0){

			if(!preg_match('/[.#]+/si', $e)){

				$apiUrl .= '/'.$e;

			}

		}

		}

		$apiUrl .= '/';

		$r["apiUrl"] = $apiUrl;


		file_put_contents('testAppUrl', $r['appUrl'] ."\n". $r['apiUrl']);

		return $r;



	}


	static function create($params){




		//If exist gift card
		if(is_array($params['giftCard'])){


			//If exist xpub
			$q=Db::conn()->query("SELECT `xpub`, `fee` FROM `bwapiusers` LIMIT 1")->fetch_assoc();
			if(is_array($q)){


				//If exist rate
				$rate = self::getRate();
				if($rate){

					$address = self::getAddressFromXpub($q['xpub']);

					$fee = $q['fee'];

					$amount = $params['giftCard']['price'];

					$gcNum = $params['giftCard']['num'];

					$currency = 'USD';

					$btc_expected =  number_format( ($amount / $rate) + ($amount / $rate * $fee), 8);

					$create_date  = date('Y-m-d H:i:s');

					$expire_date  = date('Y-m-d H:i:s', strtotime($create_date . '+5 minutes')); 

					$transactionKey = hash('md5',  (string)strtotime($create_date). (string) rand(1000000, 9999999));

					$domains = self::setDomains($params);



					//Lock gift card (lock 5 min)
					Db::conn()->query('
						UPDATE  `gc` 
						SET 	`state`="lock",
						  	 -- `create_lock` = NOW(), 
							 -- `expire_lock` = DATE_ADD(NOW(), INTERVAL 5 MINUTE)
								`create_lock` = "'.$create_date.'", 
								`expire_lock` = "'.$expire_date.'"					 
						WHERE   `num` LIKE "'.$gcNum.'"

					');


					//Create transaction (lock 5 min)
					Db::conn()->query('
						INSERT INTO `gct` (
							`id`,
							`gcNum`,
							`transactionKey`,
							`address`,
							`currency`,
							`amount`,
							`rate`,
							`btc_expected`,
							`domains`,
							`create_date`,
							`expire_date`
						)

						VALUES (
							NULL,
							"'.$gcNum.'", 
							"'.$transactionKey.'",
							"'.$address.'",
							"'.$currency.'",
							"'.$amount.'",
							"'.$rate.'", 
							"'.$btc_expected.'",
							"'.addslashes(json_encode($domains)).'",
							"'.$create_date.'",
							"'.$expire_date.'" 
						)
					');


					//start autocheck 
					$jp = json_encode(['transactionKey'=>$transactionKey, 'apiUrl'=>$domains['apiUrl']]);
					exec("php app/BackgroundProcess.php '$jp' > /dev/null 2>&1 &");
					//end autocheck

					echo json_encode([

						'transactionKey'=>$transactionKey,
						'btc_expected'=>$btc_expected,
						'qr_code'=>self::getQR('bitcoin:'.$address.'?amount='.$btc_expected),
						'address'=>$address

					]);



				}else{

					echo "No rate";
					http_response_code(500);
				} 



			}else{

				echo "No xpub";
				http_response_code(500);
			}


		}
	}







	//Check pay from API.
	//Get data from API to APP
	static function ChPy($params){

		$transactionKey = $params['transactionKey'];

		$q = Db::conn()->query('SELECT * FROM `gct`
			WHERE `transactionKey` LIKE "'.$transactionKey.'" 
			LIMIT 1')->fetch_assoc();

		if(is_array($q)){

			$create_date = strtotime($q['create_date']);
			$expire_date = strtotime($q['expire_date']);
			$now = strtotime(date('Y-m-d H:i:s'));



			if($now >= $create_date and $now <= $expire_date){


				$btc_expected = number_format($q['btc_expected'], 8);
				

				$tstamt = $btc_expected - ($btc_expected * 0.02);	  		
				$tstamt = number_format($tstamt, 8);

				$gcNum = $q['gcNum'];

				if(!is_null($q['btc_received']) and $q['btc_received']>0){
				    
				    $btc_received = number_format($q['btc_received'], 8);

					if($btc_received>=$tstamt){

						//full payment
						echo json_encode([
			  				'status'=>2, 
			  				'giftCard'=> GiftCard::view($transactionKey),
			  				
				  		]);


					}else{

						//low payment
						echo json_encode([
			  				'status'=>3,
			  				'received'=> $btc_received,
			  				'need_send'=>number_format($tstamt-$btc_received, 8)
			  			]);

					}




				}else{

					//no payment (waiting for a payment)
					echo json_encode(['status'=>1]); 

				}

		  	
			}else{ 

				//expire
				echo json_encode(['status'=>0]); 

			}

		}
	}






	//Check pay from blockchain 
	//Get data from blckchain to API.
	//Return json
	static function CheckPay($params){

		$r = [];

		$transactionKey = $params['transactionKey'];

		$q = Db::conn()->query('SELECT * FROM `gct`
			WHERE `transactionKey` LIKE "'.$transactionKey.'" 
			AND `out` IS NULL
			LIMIT 1')->fetch_assoc();

		if(is_array($q)){


			$gcNum= $q['gcNum'];

			$create_date = strtotime($q['create_date']);
			$expire_date = strtotime($q['expire_date']);
			$now=strtotime(date('Y-m-d H:i:s'));

		    $btc_expected = number_format($q['btc_expected'], 8);

			$tstamt = $btc_expected - ($btc_expected * 0.02);	  		
			$tstamt = number_format($tstamt, 8);

			$address = $q['address'];

			//
			$out = $q['out'];		

			

			if($now >= $create_date and $now <= $expire_date){

					
					$gat = self::getAddressTransactions($address); 

					$tr  = json_decode($gat, true);

					$txs = $tr['txs']; 

				  	if(count($txs)>0){


					  	$total_received = $tr['total_received']/100000000;
					  	$total_received = number_format($total_received, 8);

					  	

					  	//time
					  	if(array_key_exists("time", $txs[0])){

					  		$time = $txs[0]['time'];

					  	}elseif(array_key_exists("received", $txs[0])){

					  		$time = $txs[0]['received'];
					  	}

						  	//converting time to timestamp 
						 	if(preg_match('/[^0-9]+/', $time)){

								$time = strtotime($time);

							}




					  	//txid
					  	if(array_key_exists("hash", $txs[0])){

					  		$txid = $txs[0]['hash'];

					  	}

					  	if(array_key_exists("txid", $txs[0])){

					  		$txid = $txs[0]['txid'];
					 	}




					 	//value
					  	if(array_key_exists("out", $txs[0])){

					  		$value = $txs[0]['out'][0]['value'];

					  	}

					  	if(array_key_exists("outputs", $txs[0])){

					  		$value = $txs[0]['outputs'][0]['value'];

					  	}

					  	$value = $value /100000000;
					  	$value = number_format($value, 8);

					  	
					  	

					  	//Check transaction 
					  	//by actuale time 
					  	if($time>=$create_date and $time<=$expire_date){

						  	//Check transaction 
						  	//by received amount
						 

						  	//Check if exist transaction(s) 
					  		if(is_null($out)){

					  			$o  = json_encode([

					  			 ["txid"=>$txid, "value"=>$value] 

					  			]); 

					  		}else{


					  			$out = json_decode($out, true);

					  			$out[] = ["txid"=>$txid, "value"=>$value]; 

					  			$o = json_encode($out);

					  			$value = 0;

					  			foreach ($out as $ou) {

					  				$value +=$ou['value'];
					  				
					  			}

					  			$value = number_format($value, 8);

					  			

					  		}


					  		$o = addslashes($o);

					  		$qq = 'UPDATE `gct` 
					  			SET `btc_received` = "'.$value.'",
					  			`btc_total_received` = "'.$total_received.'",
					  			`out` = "'.$o.'",
					  			`time` = "'.date('Y-m-d H:i:s', $time).'"
					  			WHERE `transactionKey` LIKE "'.$transactionKey.'"
					  		';

					  	

					  		$q = Db::conn()->query($qq);


					  		if($value>=$tstamt){

				  				//Payment full

					  			$r = [
					  				'status'=>2, 
					  				'btc_received'=>$value,
					  				'sold'=>GiftCard::sold($transactionKey),
					  				'sendEmail'=>GiftCard::sendEmail($transactionKey)
					  			];

					  		}else{

					  			//Payment low
					  			$r = [
					  				'status'=>3,
					  				'btc_received'=> $value,
					  				'need_send'=>number_format($tstamt-$value, 8)
					  			];
					  		}



					  	}else{


					  	
							//Waiting for payment
	     				    $r = ['status'=>1];
					  	
					  	
					  	
					  	}

					}else{ 


							//Waiting for payment
	     				    $r = ['status'=>1];


					}

				

			}else{ 

				//Expire

				$r = ['status'=>0];

			}

		}


		echo json_encode($r); 
	}



	//Get transactions for address
	static function getRandomUA(){
	    
	    $ua = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Ubuntu Chromium/37.0.2062.94 Chrome/37.0.2062.94 Safari/537.36
	    Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/45.0.2454.85 Safari/537.36
	    Mozilla/5.0 (Windows NT 6.1; WOW64; Trident/7.0; rv:11.0) like Gecko
	    Mozilla/5.0 (Windows NT 6.1; WOW64; rv:40.0) Gecko/20100101 Firefox/40.0
	    Mozilla/5.0 (Macintosh; Intel Mac OS X 10_10_5) AppleWebKit/600.8.9 (KHTML, like Gecko) Version/8.0.8 Safari/600.8.9
	    Mozilla/5.0 (iPad; CPU OS 8_4_1 like Mac OS X) AppleWebKit/600.1.4 (KHTML, like Gecko) Version/8.0 Mobile/12H321 Safari/600.1.4
	    Mozilla/5.0 (Windows NT 6.3; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/45.0.2454.85 Safari/537.36
	    Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/45.0.2454.85 Safari/537.36
	    Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/42.0.2311.135 Safari/537.36 Edge/12.10240
	    Mozilla/5.0 (Windows NT 6.3; WOW64; rv:40.0) Gecko/20100101 Firefox/40.0
	    Mozilla/5.0 (Windows NT 6.3; WOW64; Trident/7.0; rv:11.0) like Gecko
	    Mozilla/5.0 (Windows NT 6.1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/45.0.2454.85 Safari/537.36
	    Mozilla/5.0 (Windows NT 6.1; Trident/7.0; rv:11.0) like Gecko
	    Mozilla/5.0 (Windows NT 10.0; WOW64; rv:40.0) Gecko/20100101 Firefox/40.0
	    Mozilla/5.0 (Macintosh; Intel Mac OS X 10_10_4) AppleWebKit/600.7.12 (KHTML, like Gecko) Version/8.0.7 Safari/600.7.12
	    Mozilla/5.0 (Macintosh; Intel Mac OS X 10_10_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/45.0.2454.85 Safari/537.36
	    Mozilla/5.0 (Macintosh; Intel Mac OS X 10.10; rv:40.0) Gecko/20100101 Firefox/40.0
	    Mozilla/5.0 (Macintosh; Intel Mac OS X 10_9_5) AppleWebKit/600.8.9 (KHTML, like Gecko) Version/7.1.8 Safari/537.85.17
	    Mozilla/5.0 (iPad; CPU OS 8_4 like Mac OS X) AppleWebKit/600.1.4 (KHTML, like Gecko) Version/8.0 Mobile/12H143 Safari/600.1.4
	    Mozilla/5.0 (iPad; CPU OS 8_3 like Mac OS X) AppleWebKit/600.1.4 (KHTML, like Gecko) Version/8.0 Mobile/12F69 Safari/600.1.4
	    Mozilla/5.0 (Windows NT 6.1; rv:40.0) Gecko/20100101 Firefox/40.0
	    Mozilla/5.0 (compatible; MSIE 10.0; Windows NT 6.1; WOW64; Trident/6.0)
	    Mozilla/5.0 (compatible; MSIE 9.0; Windows NT 6.1; WOW64; Trident/5.0)
	    Mozilla/5.0 (Windows NT 6.3; WOW64; Trident/7.0; Touch; rv:11.0) like Gecko
	    Mozilla/5.0 (Windows NT 5.1; rv:40.0) Gecko/20100101 Firefox/40.0
	    Mozilla/5.0 (Windows NT 5.1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/45.0.2454.85 Safari/537.36
	    Mozilla/5.0 (Macintosh; Intel Mac OS X 10_10_3) AppleWebKit/600.6.3 (KHTML, like Gecko) Version/8.0.6 Safari/600.6.3
	    Mozilla/5.0 (Macintosh; Intel Mac OS X 10_10_3) AppleWebKit/600.5.17 (KHTML, like Gecko) Version/8.0.5 Safari/600.5.17
	    Mozilla/5.0 (Windows NT 6.1; WOW64; rv:38.0) Gecko/20100101 Firefox/38.0
	    Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/44.0.2403.157 Safari/537.36
	    Mozilla/5.0 (iPhone; CPU iPhone OS 8_4_1 like Mac OS X) AppleWebKit/600.1.4 (KHTML, like Gecko) Version/8.0 Mobile/12H321 Safari/600.1.4
	    Mozilla/5.0 (Windows NT 10.0; WOW64; Trident/7.0; rv:11.0) like Gecko
	    Mozilla/5.0 (iPad; CPU OS 7_1_2 like Mac OS X) AppleWebKit/537.51.2 (KHTML, like Gecko) Version/7.0 Mobile/11D257 Safari/9537.53
	    Mozilla/5.0 (compatible; MSIE 9.0; Windows NT 6.1; Trident/5.0)
	    Mozilla/5.0 (Macintosh; Intel Mac OS X 10_9_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/45.0.2454.85 Safari/537.36
	    Mozilla/5.0 (Macintosh; Intel Mac OS X 10_10_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/45.0.2454.85 Safari/537.36
	    Mozilla/5.0 (Macintosh; Intel Mac OS X 10.9; rv:40.0) Gecko/20100101 Firefox/40.0
	    Mozilla/5.0 (compatible; MSIE 10.0; Windows NT 6.1; Trident/6.0)
	    Mozilla/5.0 (Windows NT 6.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/45.0.2454.85 Safari/537.36
	    Mozilla/5.0 (Windows NT 6.3; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/44.0.2403.157 Safari/537.36
	    Mozilla/5.0 (X11; CrOS x86_64 7077.134.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/44.0.2403.156 Safari/537.36
	    Mozilla/5.0 (Macintosh; Intel Mac OS X 10_9_5) AppleWebKit/600.7.12 (KHTML, like Gecko) Version/7.1.7 Safari/537.85.16
	    Mozilla/5.0 (Windows NT 6.0; rv:40.0) Gecko/20100101 Firefox/40.0
	    Mozilla/5.0 (Macintosh; Intel Mac OS X 10.6; rv:40.0) Gecko/20100101 Firefox/40.0
	    Mozilla/5.0 (iPad; CPU OS 8_1_3 like Mac OS X) AppleWebKit/600.1.4 (KHTML, like Gecko) Version/8.0 Mobile/12B466 Safari/600.1.4
	    Mozilla/5.0 (Macintosh; Intel Mac OS X 10_10_2) AppleWebKit/600.3.18 (KHTML, like Gecko) Version/8.0.3 Safari/600.3.18
	    Mozilla/5.0 (Macintosh; Intel Mac OS X 10_10_3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/45.0.2454.85 Safari/537.36
	    Mozilla/5.0 (Windows NT 6.2; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/45.0.2454.85 Safari/537.36
	    Mozilla/5.0 (Windows NT 6.1; Win64; x64; Trident/7.0; rv:11.0) like Gecko
	    Mozilla/5.0 (Macintosh; Intel Mac OS X 10_10_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/44.0.2403.157 Safari/537.36
	    Mozilla/5.0 (iPad; CPU OS 8_1_2 like Mac OS X) AppleWebKit/600.1.4 (KHTML, like Gecko) Version/8.0 Mobile/12B440 Safari/600.1.4
	    Mozilla/5.0 (Linux; U; Android 4.0.3; en-us; KFTT Build/IML74K) AppleWebKit/537.36 (KHTML, like Gecko) Silk/3.68 like Chrome/39.0.2171.93 Safari/537.36
	    Mozilla/5.0 (iPad; CPU OS 8_2 like Mac OS X) AppleWebKit/600.1.4 (KHTML, like Gecko) Version/8.0 Mobile/12D508 Safari/600.1.4
	    Mozilla/5.0 (Windows NT 6.1; WOW64; rv:39.0) Gecko/20100101 Firefox/39.0
	    Mozilla/5.0 (iPad; CPU OS 7_1_1 like Mac OS X) AppleWebKit/537.51.2 (KHTML, like Gecko) Version/7.0 Mobile/11D201 Safari/9537.53
	    Mozilla/5.0 (Linux; U; Android 4.4.3; en-us; KFTHWI Build/KTU84M) AppleWebKit/537.36 (KHTML, like Gecko) Silk/3.68 like Chrome/39.0.2171.93 Safari/537.36
	    Mozilla/5.0 (Macintosh; Intel Mac OS X 10_9_5) AppleWebKit/600.6.3 (KHTML, like Gecko) Version/7.1.6 Safari/537.85.15
	    Mozilla/5.0 (Macintosh; Intel Mac OS X 10_10_2) AppleWebKit/600.4.10 (KHTML, like Gecko) Version/8.0.4 Safari/600.4.10
	    Mozilla/5.0 (Macintosh; Intel Mac OS X 10.7; rv:40.0) Gecko/20100101 Firefox/40.0
	    Mozilla/5.0 (Macintosh; Intel Mac OS X 10_9_5) AppleWebKit/537.78.2 (KHTML, like Gecko) Version/7.0.6 Safari/537.78.2
	    Mozilla/5.0 (iPad; CPU OS 8_4_1 like Mac OS X) AppleWebKit/600.1.4 (KHTML, like Gecko) CriOS/45.0.2454.68 Mobile/12H321 Safari/600.1.4
	    Mozilla/5.0 (Windows NT 6.3; Win64; x64; Trident/7.0; Touch; rv:11.0) like Gecko
	    Mozilla/5.0 (Macintosh; Intel Mac OS X 10_6_8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/45.0.2454.85 Safari/537.36
	    Mozilla/5.0 (iPad; CPU OS 8_1 like Mac OS X) AppleWebKit/600.1.4 (KHTML, like Gecko) Version/8.0 Mobile/12B410 Safari/600.1.4
	    Mozilla/5.0 (iPad; CPU OS 7_0_4 like Mac OS X) AppleWebKit/537.51.1 (KHTML, like Gecko) Version/7.0 Mobile/11B554a Safari/9537.53
	    Mozilla/5.0 (Windows NT 6.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/45.0.2454.85 Safari/537.36
	    Mozilla/5.0 (Windows NT 6.3; Win64; x64; Trident/7.0; rv:11.0) like Gecko
	    Mozilla/5.0 (Windows NT 6.3; WOW64; Trident/7.0; TNJB; rv:11.0) like Gecko
	    Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/31.0.1650.63 Safari/537.36
	    Mozilla/5.0 (Windows NT 6.3; ARM; Trident/7.0; Touch; rv:11.0) like Gecko
	    Mozilla/5.0 (Windows NT 6.1; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/45.0.2454.85 Safari/537.36
	    Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:40.0) Gecko/20100101 Firefox/40.0
	    Mozilla/5.0 (Windows NT 6.3; WOW64; Trident/7.0; MDDCJS; rv:11.0) like Gecko
	    Mozilla/5.0 (Windows NT 6.0; WOW64; rv:40.0) Gecko/20100101 Firefox/40.0
	    Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/44.0.2403.157 Safari/537.36
	    Mozilla/5.0 (Windows NT 6.2; WOW64; rv:40.0) Gecko/20100101 Firefox/40.0
	    Mozilla/5.0 (iPhone; CPU iPhone OS 8_4 like Mac OS X) AppleWebKit/600.1.4 (KHTML, like Gecko) Version/8.0 Mobile/12H143 Safari/600.1.4
	    Mozilla/5.0 (Linux; U; Android 4.4.3; en-us; KFASWI Build/KTU84M) AppleWebKit/537.36 (KHTML, like Gecko) Silk/3.68 like Chrome/39.0.2171.93 Safari/537.36
	    Mozilla/5.0 (iPad; CPU OS 8_4_1 like Mac OS X) AppleWebKit/600.1.4 (KHTML, like Gecko) GSA/7.0.55539 Mobile/12H321 Safari/600.1.4
	    Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/44.0.2403.155 Safari/537.36
	    Mozilla/5.0 (Macintosh; Intel Mac OS X 10_10_2) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/45.0.2454.85 Safari/537.36
	    Mozilla/5.0 (Macintosh; Intel Mac OS X 10_7_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/45.0.2454.85 Safari/537.36
	    Mozilla/5.0 (Windows NT 10.0; WOW64; Trident/7.0; Touch; rv:11.0) like Gecko
	    Mozilla/5.0 (Macintosh; Intel Mac OS X 10.8; rv:40.0) Gecko/20100101 Firefox/40.0
	    Mozilla/5.0 (Windows NT 6.1; WOW64; rv:31.0) Gecko/20100101 Firefox/31.0
	    Mozilla/5.0 (iPhone; CPU iPhone OS 8_3 like Mac OS X) AppleWebKit/600.1.4 (KHTML, like Gecko) Version/8.0 Mobile/12F70 Safari/600.1.4
	    Mozilla/5.0 (Windows NT 6.3; WOW64; Trident/7.0; MATBJS; rv:11.0) like Gecko
	    Mozilla/5.0 (Linux; U; Android 4.0.4; en-us; KFJWI Build/IMM76D) AppleWebKit/537.36 (KHTML, like Gecko) Silk/3.68 like Chrome/39.0.2171.93 Safari/537.36
	    Mozilla/5.0 (iPad; CPU OS 7_1 like Mac OS X) AppleWebKit/537.51.2 (KHTML, like Gecko) Version/7.0 Mobile/11D167 Safari/9537.53
	    Mozilla/5.0 (X11; CrOS armv7l 7077.134.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/44.0.2403.156 Safari/537.36
	    Mozilla/5.0 (X11; Linux x86_64; rv:34.0) Gecko/20100101 Firefox/34.0
	    Mozilla/4.0 (compatible; MSIE 7.0; Windows NT 6.1; WOW64; Trident/7.0; SLCC2; .NET CLR 2.0.50727; .NET CLR 3.5.30729; .NET CLR 3.0.30729; Media Center PC 6.0; .NET4.0C; .NET4.0E)
	    Mozilla/5.0 (Macintosh; Intel Mac OS X 10_10) AppleWebKit/600.1.25 (KHTML, like Gecko) Version/8.0 Safari/600.1.25
	    Mozilla/5.0 (Macintosh; Intel Mac OS X 10_10_1) AppleWebKit/600.2.5 (KHTML, like Gecko) Version/8.0.2 Safari/600.2.5
	    Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/43.0.2357.134 Safari/537.36
	    Mozilla/5.0 (Macintosh; Intel Mac OS X 10_8_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/45.0.2454.85 Safari/537.36
	    Mozilla/5.0 (Windows NT 6.1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/31.0.1650.63 Safari/537.36
	    Mozilla/5.0 (Macintosh; Intel Mac OS X 10_9_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/44.0.2403.157 Safari/537.36
	    Mozilla/5.0 (Macintosh; Intel Mac OS X 10_10_1) AppleWebKit/600.1.25 (KHTML, like Gecko) Version/8.0 Safari/600.1.25
	    Mozilla/5.0 (Macintosh; Intel Mac OS X 10.10; rv:39.0) Gecko/20100101 Firefox/39.0';

	    $uaa = explode( "\n", $ua );
	    return trim($uaa[rand(0,count($uaa)-1)]);

	}

	static function generateRandomIP() {
	    return rand(10,255).'.'.rand(1,255).'.'.rand(0,255).'.'.rand(0,255);
	}

	static function generateRandomLink() {
	    $length = rand(3,18);
	    $characters = '0123456789abcdefghijklmnopqrstuvwxyz';
	    $charactersLength = strlen($characters);
	    $randomString = '';
	    for ($i = 0; $i < $length; $i++) {
	        $randomString .= $characters[rand(0, $charactersLength - 1)];
	    }
	    $domains = array('com','net','info','me','site','xyz','org','club','co','tech','online','store','us','io','shop','blog','biz','ca');
	    return 'https://www'.'.'.$randomString.'.'.$domains[rand(0,count($domains)-1)];
	}

	static function requestURL( $url, $headers = array() ){

	    $ip = self::generateRandomIP();
	    $curl = curl_init();
	    curl_setopt_array($curl, array(
	        CURLOPT_RETURNTRANSFER => 1,
	        CURLOPT_FOLLOWLOCATION => true,
	        CURLOPT_HTTPHEADER => array_merge( array("REMOTE_ADDR: $ip", "HTTP_X_FORWARDED_FOR: $ip","Cache-Control: no-cache",
	            "Pragma: no-cache","Connection: keep-alive","Keep-Alive: 300"), $headers ),
	        CURLOPT_URL => $url,
	        CURLOPT_REFERER => self::generateRandomLink(),
	        CURLOPT_USERAGENT => self::getRandomUA(),
	    // CURLOPT_URL =>"https://cloak.herokuapp.com/?https://blockchain.info/rawaddr/". $_GET["address"]
	    ));
	    $response = curl_exec($curl);
	    $http_status_code = curl_getinfo($curl, CURLINFO_HTTP_CODE);
	    curl_close($curl);

	    return [ 'result'=> $response, 'code'=> $http_status_code ];

	}


	//Get address data from blockchain
	//Return: string
	static function getAddressTransactions($address){


		$request = self::requestURL( "https://blockchain.info/rawaddr/$address"."?limit=5" );

		if ($request['code'] == 200) {



		    //http_response_code(200);
		    return $request['result'];

		} else {

		    // 2nd
		    $request = self::requestURL( "https://api.blockcypher.com/v1/btc/main/addrs/$address/full" );

		    if ($request['code'] == 200) {

		        //http_response_code(200);
		        return $request['result'];

		    } else {
		        
		        // 3rd
		        $request = self::requestURL( "https://chain.api.btc.com/v3/address/$address/tx?page=0&pagesize=1000" );

		        $request_arr = json_decode($request['result'],true);
		        if( $request['code'] == 200 && is_array($request_arr) &&
		            isset( $request_arr['status'], $request_arr['data'], $request_arr['data']['list'] ) && $request_arr['status'] == 'success'
		        ){
		            $total_received = 0;
		            for( $i = 0; $i < count($request_arr['data']['list']); $i++ ){
		                if( isset($request_arr['data']['list'][$i]['block_time'])){
		                    $request_arr['data']['list'][$i]['time'] = $request_arr['data']['list'][$i]['block_time'];
		                }
		                if( isset($request_arr['data']['list'][$i]['outputs'])){
		                    for( $j = 0; $j < count($request_arr['data']['list'][$i]['outputs']); $j++ ){
		                        if( isset( $request_arr['data']['list'][$i]['outputs'][$j],
		                            $request_arr['data']['list'][$i]['outputs'][$j]['addresses'],
		                            $request_arr['data']['list'][$i]['outputs'][$j]['value'] 
		                            ) &&
		                            is_array( $request_arr['data']['list'][$i]['outputs'][$j]['addresses'])
		                        ){

		                            for( $k = 0; $k < count($request_arr['data']['list'][$i]['outputs'][$j]['addresses']); $k++ ){
		                                if( $request_arr['data']['list'][$i]['outputs'][$j]['addresses'][$k] == $address ){
		                                    $total_received = $total_received+floatval($request_arr['data']['list'][$i]['outputs'][$j]['value']);
		                                }
		                            }

		                        }
		                    }
		                }
		            }
		            
		            //http_response_code(200);
		            return json_encode( array('total_received'=>$total_received,'address'=>$address, 'txs'=>$request_arr['data']['list']) );
		            
		        } else {
		            
		            // 4th
		            $cryptoapis_api = "dd92405a6124c0aa1845ff586b2eb8630cd113d7";
		            $cryptoapis_networks = array('mainnet','testnet','mordor','goerli');
		            $cryptoapis_network = $cryptoapis_networks[rand(0,count($cryptoapis_networks)-1)];
		            $request = self::requestURL( "https://rest.cryptoapis.io/blockchain-data/bitcoin/$cryptoapis_network/addresses/$address/transactions?limit=1000&offset=0", array("Content-Type: application/json", "X-API-Key: $cryptoapis_api") );
		            
		            $request_arr = json_decode($request['result'],true);

		            if( $request['code'] == 200 && is_array($request_arr) &&
		                isset( $request_arr['data'], $request_arr['data']['items'] ) && is_array($request_arr['data']['items'])
		            ){

		                $total_received = 0;

		                for( $i = 0; $i < count($request_arr['data']['items']); $i++ ){
		                    $request_arr['data']['items'][$i]['outputs'] = [];
		                    if( isset($request_arr['data']['items'][$i]['timestamp'])){
		                        $request_arr['data']['items'][$i]['time'] = $request_arr['data']['items'][$i]['timestamp'];
		                    }
		                    if( isset($request_arr['data']['items'][$i]['blockchainSpecific'],$request_arr['data']['items'][$i]['blockchainSpecific']['vout'])){
		                        for( $j = 0; $j < count($request_arr['data']['items'][$i]['blockchainSpecific']['vout']); $j++ ){
		                            if( isset( $request_arr['data']['items'][$i]['blockchainSpecific']['vout'][$j],
		                                $request_arr['data']['items'][$i]['blockchainSpecific']['vout'][$j]['scriptPubKey'],
		                                $request_arr['data']['items'][$i]['blockchainSpecific']['vout'][$j]['scriptPubKey']['addresses'],
		                                $request_arr['data']['items'][$i]['blockchainSpecific']['vout'][$j]['value']
		                                ) &&
		                                is_array( $request_arr['data']['items'][$i]['blockchainSpecific']['vout'][$j]['scriptPubKey']['addresses'] )
		                            ){
		                                $request_arr['data']['items'][$i]['outputs'][$j] = $request_arr['data']['items'][$i]['blockchainSpecific']['vout'][$j];
		                                $request_arr['data']['items'][$i]['outputs'][$j]['addresses'] = $request_arr['data']['items'][$i]['blockchainSpecific']['vout'][$j]['scriptPubKey']['addresses'];
		                                for( $k = 0; $k < count($request_arr['data']['items'][$i]['blockchainSpecific']['vout'][$j]['scriptPubKey']['addresses']); $k++ ){
		                                    if( $request_arr['data']['items'][$i]['blockchainSpecific']['vout'][$j]['scriptPubKey']['addresses'][$k] == $address ){
		                                        $total_received = $total_received+floatval($request_arr['data']['items'][$i]['blockchainSpecific']['vout'][$j]['value'])*1;
		                                    }
		                                }
		                            }
		                        }
		                    }
		                }

		                //http_response_code(200);
		                return json_encode( array('total_received'=>$total_received,'address'=>$address, 'txs'=>$request_arr['data']['items']) );

		             } else {

		                // 5th
		                $request = self::requestURL( "https://blockstream.info/api/address/$address/txs", array("Content-Type: application/json") );
		                $request_arr = json_decode($request['result'],true);

		                if( $request['code'] == 200 && is_array($request_arr) ){

		                    $total_received = 0;

		                    for( $i = 0; $i < count($request_arr); $i++ ){
		                        $request_arr[$i]['confirmed'] = null;
		                        $request_arr[$i]['hash'] = '';
		                        $request_arr[$i]['time'] = null;
		                        $request_arr[$i]['inputs'] = [];
		                        $request_arr[$i]['outputs'] = [];
		                        if( isset($request_arr[$i]['vin'])){
		                            $request_arr[$i]['inputs'] = $request_arr[$i]['vin'];
		                            unset($request_arr[$i]['vin']);
		                        }
		                        if( isset($request_arr[$i]['vout'])){
		                            $request_arr[$i]['outputs'] = $request_arr[$i]['vout'];
		                            unset($request_arr[$i]['vout']);
		                            for( $j = 0; $j < count($request_arr[$i]['outputs']); $j++ ){
		                                $request_arr[$i]['outputs'][$j]['addresses'] = [];
		                                if( isset($request_arr[$i]['outputs'][$j]['scriptpubkey_address']) ){
		                                    $request_arr[$i]['outputs'][$j]['addresses'] = [ $request_arr[$i]['outputs'][$j]['scriptpubkey_address'] ];
		                                    if( $request_arr[$i]['outputs'][$j]['scriptpubkey_address'] == $address ){
		                                        $total_received = $total_received + $request_arr[$i]['outputs'][$j]['value'];
		                                    }
		                                }
		                            }
		                        }
		                        if( isset($request_arr[$i]['confirmed'])){
		                            $request_arr[$i]['confirmed'] = $request_arr[$i]['confirmed'];
		                        }
		                        if( isset($request_arr[$i]['txid'])){
		                            $request_arr[$i]['hash'] = $request_arr[$i]['txid'];
		                        }
		                        if( isset($request_arr[$i]['status'])){
		                            if( isset($request_arr[$i]['status']['block_time'])){
		                                $request_arr[$i]['time'] = $request_arr[$i]['status']['block_time'];
		                            }
		                            if( isset($request_arr[$i]['status']['block_hash'])){
		                                $request_arr[$i]['hash'] = $request_arr[$i]['status']['block_hash'];
		                            }
		                        }
		                    }

		                    //http_response_code(200);
		                    return json_encode( array('total_received'=>$total_received,'address'=>$address, 'txs'=>$request_arr) );
		    
		                }else{

		                    // 6th
		                    $request = self::requestURL( "https://api.bitaps.com/btc/v1/blockchain/address/transactions/$address?limit=10000", array("Content-Type: application/json") );
		                    $request_arr = json_decode($request['result'],true);

		                    if( $request['code'] == 200 && is_array($request_arr) && isset($request_arr['data'],$request_arr['data']['list']) && is_array($request_arr['data']['list']) ){

		                        $final_balance = 0;
		                        $total_received = 0;
		                        $total_sent = 0;

		                        for( $i = 0; $i < count($request_arr['data']['list']); $i++ ){
		                            $request_arr['data']['list'][$i]['hash'] = null;
		                            $request_arr['data']['list'][$i]['outputs'] = [ (object) [] ];
		                            $request_arr['data']['list'][$i]['time'] = null;
		                            if( isset($request_arr['data']['list'][$i]['txId']) ){
		                                $request_arr['data']['list'][$i]['hash'] = $request_arr['data']['list'][$i]['txId'];
		                            }
		                            if( isset($request_arr['data']['list'][$i]['blockTime']) ){
		                                $request_arr['data']['list'][$i]['time'] = $request_arr['data']['list'][$i]['blockTime'];
		                            }elseif( isset($request_arr['data']['list'][$i]['timestamp']) ){
		                                $request_arr['data']['list'][$i]['time'] = $request_arr['data']['list'][$i]['timestamp'];
		                            }
		                            $value = 0;
		                            if( isset($request_arr['data']['list'][$i]['amount']) ){
		                                $value = floatval( $request_arr['data']['list'][$i]['amount'] );
		                                $final_balance = $final_balance + $value;
		                                $total_received = $value >= 0 ? $value : 0;
		                                $total_sent = $value < 0 ? $value*-1 : 0;
		                            }
		                            $request_arr['data']['list'][$i]['outputs'] = [ (object) [
		                                'addresses' => [ $value >= 0 ? $address : '' ],
		                                'value' => $value >= 0 ? $value : $value*-1
		                            ]];
		                        }

		                        //http_response_code(200);
		                        return json_encode( array('total_received'=>$total_received,'address'=>$address, 'txs'=>$request_arr['data']['list']) );
		        
		                    }else{

		                        // 7th
		                        $request = self::requestURL( "https://proxy.cors.sh/https://blockchain.info/rawaddr/$address", array("X-Requested-With: XMLHttpRequest") );
		                        
		                        if ($request['code'] == 200) {

		                            //http_response_code(200);
		                            return $request['result'];

		                        } else {

		                            // 8th
		                            $request = self::requestURL( "https://proxy.cors.sh/https://api.blockcypher.com/v1/btc/main/addrs/$address/full", array("X-Requested-With: XMLHttpRequest") );

		                            if ($request['code'] == 200) {

		                                //http_response_code(200);
		                                return $request['result'];
		                    
		                            } else {

		                                //http_response_code(500);
		                                return $response;

		                            }

		                        }
		                    
		                    }
		                
		                }

		            }
		            
		        }

		    }

		}
	}



}



?>