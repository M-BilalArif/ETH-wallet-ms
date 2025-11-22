<?php 

namespace App;

use \App\Config as CF; 

use \mysqli;

class Db{

	static function conn(){


 		$conn = new mysqli( CF::DB_HOST, CF::DB_USER, CF::DB_PASS, CF::DB_DB);

		if ($conn->connect_error) {

			return false;

		}else{

			return $conn;
		} 

	}
}

?>