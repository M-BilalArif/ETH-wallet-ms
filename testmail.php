<?PHP
$sender = 'bitcoin@bitcoin.wallet.ms';
$recipient = 'hgerson@yahoo.com';

$subject = "php mail test";
$message = "Bitcoin php test message";
$headers = 'From:' . $sender;

if (mail($recipient, $subject, $message, $headers))
{
    echo "Message accepted";
}
else
{
    echo "Error: Message not accepted";
}
?>