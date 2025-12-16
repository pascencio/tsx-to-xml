import { LoginRequest } from "./LoginRequest";
import { CalculatorAddRequest } from "./AddRequest";
import { GetCustomerRequest } from "./GetCustomerRequest";

console.log(
  LoginRequest({
    user: "patricio",
    password: "1234"
  })
);

console.log(
  CalculatorAddRequest({
    intA: 1,
    intB: 2
  })
);

console.log(
  GetCustomerRequest({
    customerId: "1234567890",
    auth: {
      username: "patricio",
      password: "1234"
    }
  })
);