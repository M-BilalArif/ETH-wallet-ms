<?php



header("Access-Control-Allow-Origin: *");

error_reporting(E_ALL & ~E_DEPRECATED);
ini_set('error_reporting', E_ALL);
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);

require("vendor/autoload.php");
use \App\Router; 



Router::start();




























?>