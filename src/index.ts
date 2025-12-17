import { GetCustomerRequest } from "./GetCustomerRequest";

console.log(
  GetCustomerRequest({
    customerId: "1234567890",
    auth: {
      username: "patricio",
      password: "1234"
    }
  })
);