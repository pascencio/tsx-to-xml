import { LoginRequest } from "./LoginRequest";
import { CalculatorAddRequest } from "./AddRequest";

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