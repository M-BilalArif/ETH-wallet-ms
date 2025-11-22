<?php



if (!isset($_POST["recipient"]) || strlen($_POST["recipient"]) == 0) die("0");

if (!isset($_POST["url"]) || strlen($_POST["url"]) == 0) die("0");



$mailFrom = "Bitcoin@Bitcoin.Wallet.ms";

$headers = "From: " . $mailFrom . "\r\n";



// Build message

$message = "You have received ";

$message .= isset($_POST["amount"]) && strlen($_POST["amount"]) > 0 ? "exactly " . number_format($_POST["amount"], 8) . " BTC" : "Bitcoin";

if (isset($_POST["sender"]) && strlen($_POST["sender"]) > 0) $message .= " from " . $_POST["sender"];

$message .= ". Your temporary Bitcoin wallet is located at the following secure link. DO NOT SHARE THIS LINK OR THIS EMAIL WITH ANYONE OR YOU WILL LOSE YOUR BITCOIN! Also, if you do not fully trust the sender, you should send your Bitcoin elsewhere to your own private wallet to ensure that no one has access to this message. This unique Bitcoin wallet URL is not saved on our servers and cannot, therefore, be recovered if this email is lost or deleted by the recipient.
You may create a new wallet online at https://Bitcoin.Wallet.ms or learn more at https://Bitcoin.org.\n\n" . $_POST["url"];



// Send email to configured contact email address

echo mail(

    $_POST["recipient"],

    "You have received Bitcoin" . (isset($_POST["sender"]) ? " from " . $_POST["sender"] : ""),

    $message,

    $headers

) ? "1" : "0";

