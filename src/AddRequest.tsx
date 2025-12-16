import { soap } from "@xml-runtime/soap";
import { ns0 } from "./generated/calculator/calculator_ns0";

export const CalculatorAddRequest = (props: { intA: number; intB: number }) => (
    <soap.Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
        <soap.Header />
        <soap.Body>
            <ns0.Add xmlns:ns0="http://tempuri.org/">
                <ns0.intA>{props.intA}</ns0.intA>
                <ns0.intB>{props.intB}</ns0.intB>
            </ns0.Add>
        </soap.Body>
    </soap.Envelope>
);
