<?php

namespace App; 


class Router{


	static $routes = [ 

		//auth/p1/p2 => Class/Method/p1/p2
		'auth'     => 'Auth/Token/apiUserId/apiUserKey',
		'domain'   => 'Domain/Get/domain/token',
		'giftcard' => 'GiftCard/Get/giftcard/appurl/token',
		'chPy' => 'Transaction/ChPy/transactionKey',
		'checkPay' => 'Transaction/CheckPay/transactionKey',
		'setEmail'  => 'GiftCard/setEmail/email/transactionKey'


	];


	static function start(){


		$url = trim($_SERVER['REQUEST_URI']);

           
		//Parse callbackURL
		$callbackURL = ''; 
		preg_match('/[?]callbackURL=(.*?)$/si', $url, $m);
		if(count($m)>0){

			$callbackURL = trim($m[1]);

			$url = preg_replace('/[?]callbackURL=.*?$/si', '', $url);
		}

		

		foreach (self::$routes as $route=>$routeParams) {

			

			if(preg_match('/'.$route.'[^>]+/si', $url, $u)){

				//Route params
				$routePrms = explode('/', $routeParams);

				$cl  = array_shift($routePrms);
				$ac  = array_shift($routePrms);

        
				//Url params
				$urlPrms = explode("/", $u[0]);
				array_shift($urlPrms);

				if(count($urlPrms) >= count($routePrms)){

					$params = [];

					$params['callbackURL'] = $callbackURL;

					foreach($routePrms as $k=>$paramName){

						$up = trim( substr( $urlPrms[$k], 0, 200 ) );
						$up = str_replace("'", "", $up);
						$up = str_replace('"', "", $up);

						$params[ $paramName ] = $up;

					}
                    
                    

 					call_user_func_array(  [__NAMESPACE__."\\".$cl, $ac], [$params] );

					break;
					
				}else{

					break;

					return false; 


				}
			
			}
			
		}

	}


}



?>