<?php 

namespace App;
use \App\Db;
use \App\Auth;

class Domain{


	static function Get($params){


		if(Auth::CheckToken($params['token'])){

			$domain = $params['domain'];

			$q = DB::conn()->query("SELECT `BitcoinAddr` FROM `BitcoinDomains` WHERE `DomainName` LIKE '$domain' LIMIT 1");

			if($q->num_rows > 0){

				$r = $q->fetch_assoc();

				$address = [];

				$address[] = $r['BitcoinAddr'];

				echo json_encode($address);
				
			}else {

				echo json_encode([]);
			}

			


		}else{


			http_response_code(401);
		}

		


	}






}



?>