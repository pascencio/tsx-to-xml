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
import {
    createInterfaceTemplate,
    createPropsInterfaceTemplate,
    createNamespacesTemplate,
    createTypeTemplate,
    extractNamespaceObject,
    extractNamespacePrefixObject,
    extractNamespaceTypeObject,
    createXmlBodyTemplate,
} from "./template.mjs";
import { toPascalCase } from "./util.mjs";
import fs from "fs";

const XML_SCHEMA_URI = 'http://www.w3.org/2001/XMLSchema';
const NAMESPACE_KEY = '$namespace';
const SOAP12_ENVELOPE_URI = 'http://www.w3.org/2003/05/soap-envelope';
const SOAP11_ENVELOPE_URI = 'http://schemas.xmlsoap.org/soap/envelope/';

/**
 * Determina la URI del namespace SOAP basado en las definiciones del WSDL
 */
function getSoapNamespaceURI(definitionsNamespaces) {
    const soapEntry = Array.from(definitionsNamespaces.entries())
        .find(entry => entry[1].includes('soap'));
    
    if (!soapEntry) {
        return SOAP11_ENVELOPE_URI;
    }
    
    const lastPart = soapEntry[1].split('/').slice(-1)[0];
    return lastPart === 'soap12' 
        ? SOAP12_ENVELOPE_URI 
        : SOAP11_ENVELOPE_URI;
}

/**
 * Filtra propiedades que son tipos simples de XML Schema
 */
function isSimpleXmlSchemaType(key, requestTypeObject) {
    return typeof requestTypeObject[key]?.type === 'string' &&
        requestTypeObject[key]?.type?.includes(XML_SCHEMA_URI);
}

/**
 * Filtra propiedades que deben generar interfaces complejas
 */
function shouldCreateInterface(key, requestTypeObject) {
    return key !== NAMESPACE_KEY &&
        !isSimpleXmlSchemaType(key, requestTypeObject);
}

/**
 * Genera el contenido de imports y declaraciones de namespaces
 */
function generateImportsAndNamespaces(namespacesObject) {
    return `import { soap } from "@xml-runtime/soap";
import { ns } from "@xml-runtime/ns";

${createNamespacesTemplate(namespacesObject)}
`;
}

/**
 * Genera los tipos TypeScript simples
 */
function generateSimpleTypes(requestTypeObject) {
    return Object.keys(requestTypeObject)
        .filter(key => isSimpleXmlSchemaType(key, requestTypeObject))
        .map(key => createTypeTemplate(key, requestTypeObject[key]))
        .join(';\n') + '\n';
}

/**
 * Genera el contenido de interfaces TypeScript
 */
function generateInterfaces(requestType, requestTypeObject) {
    const propsInterface = createPropsInterfaceTemplate(requestType, requestTypeObject);
    
    const complexInterfaces = Object.keys(requestTypeObject)
        .filter(key => shouldCreateInterface(key, requestTypeObject))
        .map(key => createInterfaceTemplate(key, requestTypeObject[key]))
        .join('');
    
    return propsInterface + complexInterfaces;
}

/**
 * Genera los atributos xmlns para el elemento Envelope
 */
function generateXmlnsAttributes(namespacesPrefixObject) {
    return Object.keys(namespacesPrefixObject)
        .map(key => `xmlns:${key}="${namespacesPrefixObject[key]}"`)
        .join(' ');
}

/**
 * Genera el contenido del componente TSX
 */
function generateComponentContent(
    requestType,
    soapNamespaceURI,
    namespacesPrefixObject,
    baseNamespacePrefix,
    namespacesTypeObject,
    requestTypeObject
) {
    const xmlnsAttributes = generateXmlnsAttributes(namespacesPrefixObject);
    const xmlBody = createXmlBodyTemplate(
        baseNamespacePrefix,
        namespacesTypeObject,
        requestType,
        requestTypeObject
    );
    
    return `export function ${toPascalCase(requestType)}(props: ${toPascalCase(requestType)}Props) {
    return <soap.Envelope xmlns:soap="${soapNamespaceURI}"
    ${xmlnsAttributes}>
    <soap.Header />
    <soap.Body>
    ${xmlBody}
    </soap.Body>
</soap.Envelope>
}
`;
}

/**
 * Función principal que genera el archivo TSX desde un WSDL
 */
async function generateTsxFromWsdl(wsdlPath, outDir) {
    const wsdlRoot = await loadXml(wsdlPath);
    const definitionsNode = getDefinitionsNode(wsdlRoot);
    const typeNode = getTypesNode(definitionsNode);
    const schemaNode = getSchemaNode(typeNode);
    
    if (schemaNode === undefined) {
        throw new Error('No se encontró el nodo schema en el WSDL');
    }
    
    const definitionsNamespaces = getNamespacesFromNode(definitionsNode);
    const soapNamespaceURI = getSoapNamespaceURI(definitionsNamespaces);
    const schemaNamespaces = getNamespacesFromNode(schemaNode);
    const namespaces = new Map([...definitionsNamespaces, ...schemaNamespaces]);
    
    const complexTypes = await complexTypesFromSchema(wsdlPath, schemaNode, namespaces);
    const schemaObject = schemaToObject(schemaNode, namespaces, complexTypes);
    const requestType = getRequestTypeFromDefinitions(definitionsNode, schemaObject);
    const requestTypeObject = schemaObject[requestType];
    
    const namespacesObject = extractNamespaceObject(requestType, requestTypeObject);
    const namespacesPrefixObject = extractNamespacePrefixObject(requestType, requestTypeObject);
    const namespacesTypeObject = extractNamespaceTypeObject(requestType, requestTypeObject);
    const baseNamespacePrefix = namespacesTypeObject[requestType].prefix;
    
    const importContent = generateImportsAndNamespaces(namespacesObject);
    const propsContent = generateSimpleTypes(requestTypeObject) + 
                        generateInterfaces(requestType, requestTypeObject);
    const xmlContent = generateComponentContent(
        requestType,
        soapNamespaceURI,
        namespacesPrefixObject,
        baseNamespacePrefix,
        namespacesTypeObject,
        requestTypeObject
    );
    
    const outputPath = `${outDir}/${requestType}.tsx`;
    fs.writeFileSync(outputPath, importContent + propsContent + xmlContent);
    console.log(`Archivo ${requestType}.tsx generado correctamente en ${outDir}`);
}

// Ejecución principal
const WSDL_PATH = process.argv[2];
const OUT_DIR = process.argv[3];

if (!WSDL_PATH || !OUT_DIR) {
    console.error('Uso: node generate-tsx.mjs <ruta-wsdl> <directorio-salida>');
    process.exit(1);
}

generateTsxFromWsdl(WSDL_PATH, OUT_DIR)
    .catch(error => {
        console.error('Error al generar TSX:', error);
        process.exit(1);
    });
