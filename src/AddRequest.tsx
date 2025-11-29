import { soap } from "@xml-runtime/soap";
import { org } from "./generated/calculator/calculator";

export const CalculatorAddRequest = (props: { intA: number; intB: number }) => (
    <soap.Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
        <soap.Header />
        <soap.Body>
            <org.Add xmlns:org="http://tempuri.org/">
                <org.intA>{props.intA}</org.intA>
                <org.intB>{props.intB}</org.intB>
            </org.Add>
        </soap.Body>
    </soap.Envelope>
);
