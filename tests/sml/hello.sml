val x = 2 + 3;
fun fact 0 = 1 | fact n = n * fact (n-1);
val f10 = fact 10;
val () = print ("hello from SML! fact 10 = " ^ Int.toString f10 ^ "\n");
