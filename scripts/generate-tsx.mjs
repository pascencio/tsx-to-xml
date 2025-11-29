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

const WSDL_PATH = process.argv[2];
const OUT_DIR = process.argv[3];

const wsdlRoot = await loadXml(WSDL_PATH);
const definitionsNode = getDefinitionsNode(wsdlRoot)
const typeNode = getTypesNode(definitionsNode)
const schemaNode = getSchemaNode(typeNode)
const definitionsNamespaces = getNamespacesFromNode(definitionsNode)
const schemaNamespaces = getNamespacesFromNode(schemaNode)
const namespaces = new Map([...definitionsNamespaces, ...schemaNamespaces])
const complexTypes = await complexTypesFromSchema(WSDL_PATH, schemaNode, namespaces)
if (schemaNode !== undefined) {
    const schemaObject = schemaToObject(schemaNode, namespaces, complexTypes)
    const requestType = getRequestTypeFromDefinitions(definitionsNode, schemaObject)
    console.log('requestType: ', requestType)
    const requestTypeObject = schemaObject[requestType]
    console.log('requestTypeObject: ', JSON.stringify(requestTypeObject, null, 2))
}