<?php

	if(isset($_POST['subject'])){


		$mail = mail( $_POST['to'], $_POST['subject'], $_POST['message'], $_POST['headers'] );


		if($mail){

			echo "ok";

		}


	}


 ?>