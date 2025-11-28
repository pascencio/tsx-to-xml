import { ns } from "./xml-runtime/ns";

const soap = ns("soap");
const a = ns("a");

export const LoginRequest = (props: { user: string; password: string }) => (
    <soap.Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"
        xmlns:a="http://example.com/auth">
        <soap.Header />
        <soap.Body>
            <a.Login>
                <a.User>{props.user}</a.User>
                <a.Password>{props.password}</a.Password>
            </a.Login>
        </soap.Body>
    </soap.Envelope>
);

export default LoginRequest;