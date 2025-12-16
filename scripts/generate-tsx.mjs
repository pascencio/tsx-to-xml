import {
    loadXml,
    getSchemaNode,
    getTypesNode,
    getDefinitionsNode,
    getNamespacesFromNode,
    complexTypesFromSchema,
    schemaToObject,
    getRequestTypeFromDefinitions,
} from "./wsdl.mjs";
import { createInterfaceTemplate, createPropsInterfaceTemplate, createNamespacesTemplate, createTypeTemplate, extractNamespaceObject, extractNamespacePrefixObject, extractNamespaceTypeObject } from "./template.mjs";
import { toPascalCase, toCamelCase } from "./util.mjs";
import fs from "fs";

const WSDL_PATH = process.argv[2];
const OUT_DIR = process.argv[3];

const wsdlRoot = await loadXml(WSDL_PATH);
const definitionsNode = getDefinitionsNode(wsdlRoot)
const typeNode = getTypesNode(definitionsNode)
const schemaNode = getSchemaNode(typeNode)
const definitionsNamespaces = getNamespacesFromNode(definitionsNode)
const soapNamespaceURI = definitionsNamespaces.entries().find(entry => entry[1].includes('soap'))?.[1].split('/').slice(-1)[0] == 'soap12' ? 'http://www.w3.org/2003/05/soap-envelope' : 'http://schemas.xmlsoap.org/soap/envelope/';
const schemaNamespaces = getNamespacesFromNode(schemaNode)
const namespaces = new Map([...definitionsNamespaces, ...schemaNamespaces])
const complexTypes = await complexTypesFromSchema(WSDL_PATH, schemaNode, namespaces)
if (schemaNode !== undefined) {
    const schemaObject = schemaToObject(schemaNode, namespaces, complexTypes)
    const requestType = getRequestTypeFromDefinitions(definitionsNode, schemaObject)
    console.log('requestType: ', requestType)
    const requestTypeObject = schemaObject[requestType]
    console.log('requestTypeObject: ', JSON.stringify(requestTypeObject, null, 2))
    const namespacesObject = extractNamespaceObject(requestType, requestTypeObject)
    console.log('namespacesObject: ', namespacesObject)
    const namespacesPrefixObject = extractNamespacePrefixObject(requestType, requestTypeObject)
    console.log('namespacesPrefixObject: ', namespacesPrefixObject)
    const namespacesTypeObject = extractNamespaceTypeObject(requestType, requestTypeObject)
    console.log('namespacesTypeObject: ', namespacesTypeObject)
    const importContent = `import { soap } from "@xml-runtime/soap";
import { ns } from "@xml-runtime/ns";

${createNamespacesTemplate(namespacesObject)}
`
    const propsContent = `${Object.keys(requestTypeObject).filter(key => {
        return typeof requestTypeObject[key]?.type === 'string' &&
        requestTypeObject[key]?.type?.includes('http://www.w3.org/2001/XMLSchema')
    }).map(key => {
        return createTypeTemplate(key, requestTypeObject[key])
    }).join(';\n')}
` +
    createPropsInterfaceTemplate(requestType, requestTypeObject) +
        `${Object.keys(requestTypeObject)
            .filter(key => {
                return key !== '$namespace' &&
                    !(typeof requestTypeObject[key]?.type === 'string' &&
                        requestTypeObject[key]?.type?.includes('http://www.w3.org/2001/XMLSchema'))
            })
            .map(key => {
                const childrenObject = requestTypeObject[key]
                return createInterfaceTemplate(key, childrenObject)
            })
            .join('')}`
    const baseNamespacePrefix = namespacesTypeObject[requestType].prefix
    const xmlContent = `export function ${toPascalCase(requestType)}(props: ${toPascalCase(requestType)}Props) {
    return <soap.Envelope xmlns:soap="${soapNamespaceURI}"
    ${Object.keys(namespacesPrefixObject).map(key => {
        return `xmlns:${key}="${namespacesPrefixObject[key]}"`
    }).join(' ')}>
    <soap.Header />
    <soap.Body>
        <${baseNamespacePrefix}.${requestType}>
            ${Object.keys(requestTypeObject)
            .filter(key => key !== '$namespace')
            .map(key => {
                const namespacePrefix = namespacesTypeObject[key]?.prefix !== undefined ? namespacesTypeObject[key].prefix : baseNamespacePrefix
return `<${namespacePrefix}.${key}>{props.${toCamelCase(key)}}</${namespacePrefix}.${key}>`
            })
            .join('\n')}
        </${baseNamespacePrefix}.${requestType}>
    </soap.Body>
</soap.Envelope>
}
`
    fs.writeFileSync(`${OUT_DIR}/${requestType}.tsx`, importContent + propsContent + xmlContent)
}