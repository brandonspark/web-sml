fun fib 0 = 0 | fib 1 = 1 | fib n = fib (n-1) + fib (n-2);
val () = print ("fib 20 = " ^ Int.toString (fib 20) ^ "\n");
