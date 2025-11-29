import {
    loadXml,
    getSchemaNode,
    getTypesNode,
    getDefinitionsNode,
    getNamespacesFromNode,
    complexTypesFromSchema,
    schemaToObject,
} from "./wsdl.mjs";

const WSDL_PATH = process.argv[2];
const OUT_DIR = process.argv[3];

const wsdlRoot = loadXml(WSDL_PATH);
const definitionsNode = getDefinitionsNode(wsdlRoot)
const typeNode = getTypesNode(definitionsNode)
const schemaNode = getSchemaNode(typeNode)
const definitionsNamespaces = getNamespacesFromNode(definitionsNode)
const schemaNamespaces = getNamespacesFromNode(schemaNode)
const namespaces = new Map([...definitionsNamespaces, ...schemaNamespaces])
const complexTypes = complexTypesFromSchema(WSDL_PATH, schemaNode, namespaces)
console.log('complexTypes', complexTypes)
if (schemaNode !== undefined) {
    const schemaObject = schemaToObject(schemaNode, namespaces, complexTypes)
    console.log(JSON.stringify(schemaObject, null, 2))
}