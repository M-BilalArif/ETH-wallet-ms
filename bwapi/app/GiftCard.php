<?php 
namespace App;

use \App\Db;
use \App\Auth;
use \App\Transactions;


class GiftCard{



	//State of gift card:
		//locked
		//selling
		//sold


	//Get gift card, which selling and create transaction.
	static function Get($params){

		if(Auth::CheckToken($params['token'])){


			self::unlockGiftCard();


			$type =  preg_replace('/[0-9]+/',  "", $params['giftcard']);

			$price = preg_replace('/[A-Z]+/',  "", $params['giftcard']);

			$q = Db::conn()->query('

				SELECT * FROM `gc`
				WHERE  `type`  LIKE "'.$type.'" 
				AND    `price` LIKE "'.$price.'"
				AND    `state` LIKE "selling"				
				LIMIT 1

			')->fetch_assoc();

			if(is_array($q)){

				$params['giftCard']=$q;

				Transaction::create($params);





				


			}else{

				echo "No gift card";
				http_response_code(500);
			}


			
				

		}

	}



	//Sold card 
	//Set state to "sold"
	static function sold($transactionKey){

		$r = 0;

		$info = self::info($transactionKey);

		if(is_array($info)){

			$num = $info['gcNum'];

			Db::conn()->query('
				UPDATE `gc`
				SET `state` = "sold"
				WHERE `num` LIKE "'.$num.'" 
			');


			$r = 1;
		}


		return $r;
	}

	//Get Gift card data
	//Return array
	static function info($transactionKey){

		$r = false;


		$q = DB::conn()->query('SELECT `gc`.*, `gct`.`gcNum`, `gct`.`domains` FROM `gc`, `gct`
			 WHERE `gc`.`num` = `gct`.`gcNum` 
			 AND `gct`.`transactionKey` LIKE "'.$transactionKey.'"
			')->fetch_assoc();

		if(is_array($q)){
		    
		    $r = [];

			//Convert format 0000111122223333 to 0000 1111 2222 3333
			$q['num'] = trim(preg_replace('/([0-9]{4})/', "$1 ", $q['num']));

			//System name of images:
			// amazon_logo.png
			// starbucks_logo.png
			// visa_logo.png
			$q['logo'] = strtolower($q['type']) . "_logo.png";

			//Set array:appUrl, apiUrl
			$q['domains'] = json_decode(stripcslashes($q['domains']), true);

				
			$r = $q;

		}

        

		return $r;
	}



	//Checking if lock time is expire, then return card to trade.
	//Set: state = "selling"
	//Return: nothing
	static function unlockGiftCard(){


		$q = DB::conn()->query('SELECT * FROM `gc` WHERE `state` LIKE "lock"');

		if($q){

			while($v = $q->fetch_assoc()){


				$id = $v['id'];

				$expire_lock = strtotime($v['expire_lock']);

				$now=strtotime(date('Y-m-d H:i:s'));

				if($now>=$expire_lock){


					Db::conn()->query('UPDATE `gc` SET `state`="selling", `email`="", `emailSent`=0, `create_lock`= NULL, `expire_lock`=NULL WHERE `id` = '.$id.' ');

				}

			}

		}

	}


	static function setEmail($params){

		$email = $params['email'];
		$transactionKey = $params['transactionKey'];

		$q = DB::conn()->query('SELECT `gcNum` FROM `gct` WHERE `transactionKey` LIKE "'.$transactionKey.'" LIMIT 1')->fetch_assoc();

		if(is_array($q)){

			$gcNum = $q['gcNum'];

			Db::conn()->query('UPDATE `gc` SET `email` = "'.$email.'"  WHERE `num` LIKE "'.$gcNum.'" ');

			return true;


		}else{


			return false;
		}
	}



	//Return html view of Gift card
	//Try get images from app
	//if false, than
	//try get images from api
	static function view($transactionKey){


		$info = self::info($transactionKey);


		$logo = $info['domains']['appUrl'] .'img/'. $info['logo']; 


		//1. Try get images from App
		$ch = curl_init($logo);
		curl_setopt($ch, CURLOPT_NOBODY, true);
		curl_exec($ch);
		$code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
		curl_close($ch);


		//. Try get images from Api (if get images from App is fial)
		if($code !=200){

			$logo = $info['domains']['apiUrl'].'src/images/'.$info['logo'];

		}




		$r = '<div id="gcContainer" style="position: relative;width: 79%;padding-bottom: 50%;border: 1px solid #fff; background-color: #fff; color: #000; border-radius: 12px;transform: translateX(-50%);left: 50.5%;">

		<div id="gcContent" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; padding: 6%;">

		<img id="gcLogo" src="'.$logo.'" style="height: 30%; position: absolute; left: 6%;">

		<div id="gcPrice" style="position: absolute; right: 6%; font-size: 8vmin; font-weight: bold; top: 25%;">$'.$info['price'].'</div>

		<div id="gcNum" style="position: absolute; top: 50%; font-size: 4vmin;">'.$info['num'].'</div>
		<div id="gcPin" style="position: absolute; top: 70%; font-size: 3vmin; right: 6%;">PIN: '.$info['pin'].'</div>
		<div id="gcExp" style="position: absolute; top: 75%; font-size: 2.5vmin;">EXP: '.$info['exp'].'</div>
		</div>
		</div>';


		return $r;

	}



	//Try send email via: domain of app
	//if false, then
	//try send email via: domain of api
	static function sendEmail($transactionKey){

		$r =0;


		$info = self::info($transactionKey);
		
		$num = $info['gcNum'];

		if(strlen($info['email'])>5){


			$subject = "Here is your gift card";
			$message = '<html>
						<head>
						<meta charset="utf-8">
						<title>Your gift card</title>
						<style type="text/css">
							body { width: 100%; height: 1000px; background-color: #252638; margin: 0;}
							#gcContainer, #gcContent {box-sizing: border-box;}
						</style>
						</head>
						<body>

						<div style="color:#727594;font-family:arial;text-align: center;padding: 20px;border: 1px solid #727594;width: 80%;margin: 0 auto;margin-top: 50px;">
							<p>Thank you for shopping with us.</p>
							<p>We’ve successfully processed your payment.</p>
							<p>Enjoy this gift card.</p>

							<div style="width: 530px; font-family: arial;margin: 0 auto;"> 

							'.self::view($transactionKey).'

							</div>
						</div>
						</body>
						</html>';

			$headers =  "MIME-Version: 1.0" . "\r\n";
			$headers .= "Content-type:text/html;charset=UTF-8" . "\r\n";

			// Additional headers (optional)
			$headers .= "From: Bitcoin@Bitcoin.Wallet.ms" . "\r\n"; 

			$q = [ 

				'subject'=>$subject,
				'message'=>$message,
				'headers'=>$headers,
				'to'=>$info['email']
			];


			$u = $info['domains']['appUrl'].'api/gcEmail.php';

			//1. Try send email via app 
			$ch = curl_init($u);
			curl_setopt($ch, CURLOPT_POST, true);
			curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($q));
			curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
			$r = curl_exec($ch);


			//2. Try send email via api (if send via app is fail)
			if($r != "ok"){

				mail($info['email'], $subject, $message, $headers);

			}


			//Set send status of email
			Db::conn()->query('UPDATE `gc` SET `emailSent` = 1 WHERE `num` LIKE "'.$num.'" LIMIT 1' );

			$r = 1;


		}


		return $r;
	}


}


	 ?>