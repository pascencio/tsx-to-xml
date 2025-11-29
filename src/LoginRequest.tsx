import { soap } from "@xml-runtime/soap";
import { ns } from "./xml-runtime/ns";

const auth = ns("auth", ["Login", "User", "Password"] as const);

export interface LoginRequestType {
    Login: {
        User: string;
        Password: string;
    };
}

type LoginNode = {
    User: string;
    Password: string;
};

export const LoginRequest = (props: { user: string; password: string }) => (
    <soap.Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"
        xmlns:auth="http://example.com/auth">
        <soap.Header />
        <soap.Body>
            <auth.Login>
                <auth.User>{props.user}</auth.User>
                <auth.Password>{props.password}</auth.Password>
            </auth.Login>
        </soap.Body>
    </soap.Envelope>
);

export default LoginRequest;