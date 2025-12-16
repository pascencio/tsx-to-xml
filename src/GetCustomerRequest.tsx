import { soap } from "@xml-runtime/soap";
import { ns } from "@xml-runtime/ns";

const cus = ns("cus", ["GetCustomerRequest", "CustomerId"] as const);
const com = ns("com", ["Auth"] as const);

export type CustomerId = string

export interface GetCustomerRequestProps {
	customerId: CustomerId,
	auth: Auth
}

export interface Auth {
	username: string,
	password: string
}
export function GetCustomerRequest(props: GetCustomerRequestProps) {
    return <soap.Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"
    xmlns:cus="http://example.com/customer-service" xmlns:com="http://example.com/schema/common">
    <soap.Header />
    <soap.Body>
        <cus.GetCustomerRequest>
            <cus.CustomerId>{props.customerId}</cus.CustomerId>
<com.Auth>{props.auth}</com.Auth>
        </cus.GetCustomerRequest>
    </soap.Body>
</soap.Envelope>
}
