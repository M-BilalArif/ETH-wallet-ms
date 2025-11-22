<?php 

namespace App;
use \App\Db;

class Auth{


	static function en($plaintext, $password="bwa") {
	    // Generate a random salt
	    $salt = openssl_random_pseudo_bytes(8);

	    // Derive a key from the password using PBKDF2
	    $key = openssl_pbkdf2($password, $salt, 32, 1000, 'sha256');

	    // Generate an initialization vector (IV)
	    $iv = openssl_random_pseudo_bytes(openssl_cipher_iv_length('aes-256-cbc'));

	    // Encrypt the plaintext using AES-256-CBC
	    $encrypted = openssl_encrypt($plaintext, 'aes-256-cbc', $key, 0, $iv);

	    // Combine the salt, IV, and ciphertext
	    $result = base64_encode($salt . $iv . $encrypted);

	    return $result;
	}


	static function de($encrypted, $password="bwa") {
	    // Decode the base64 encoded string
	    $data = base64_decode($encrypted);

	    // Extract the salt, IV, and ciphertext
	    $salt = substr($data, 0, 8);
	    $iv = substr($data, 8, 16);
	    $ciphertext = substr($data, 24);

	    // Derive the key from the password using PBKDF2
	    $key = openssl_pbkdf2($password, $salt, 32, 1000, 'sha256');

	    // Decrypt the ciphertext using AES-256-CBC
	    $plaintext = openssl_decrypt($ciphertext, 'aes-256-cbc', $key, 0, $iv);

	    return $plaintext;
	}





	//Create token
	//Return string 
	static function Token($params){

		$q = Db::conn()->query(
		   'SELECT * FROM `bwapiusers` 
			WHERE `apiUserId` LIKE "'.$params['apiUserId'].'" 
			AND  `apiUserKey` LIKE "'.$params['apiUserKey'].'"
			LIMIT 1')->fetch_assoc();

		
		if(is_array($q)){
			//Checking strings for Upper/Lower 
			if($q['apiUserId']==$params['apiUserId'] and $q['apiUserKey']==$params['apiUserKey']){

				//$token = hash('md5',  (string)strtotime(date('Y-m-d H:i:s')). (string) rand(1000000, 9999999)); 

				$token = strtotime(date('Y-m-d H:i:s'));

				echo json_encode([self::en($token)] );
			 
			}else{ http_response_code(401); }

		}else{ http_response_code(401); }		
	}


	//Check actuality of token 
	//Life in seconds
	static function CheckToken($token, $life=60){


		$urldecode = urldecode($token);

		$tkn= str_replace("|", "/", $urldecode);

		$tk = (int) self::de($tkn);

		$now = (int) strtotime(date('Y-m-d H:i:s'));

		if( ($now - $tk) < $life){

			return true;

		}else{

			http_response_code(401);
		
		}		
		 
	}




	

}


?>