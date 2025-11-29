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
const schemaNamespaces = getNamespacesFromNode(schemaNode)
console.log('schemaNamespaces', schemaNamespaces)
const complexTypes = complexTypesFromSchema(WSDL_PATH, schemaNode)
console.log('complexTypes', complexTypes)
if (schemaNode !== undefined) {
    const schemaObject = schemaToObject(schemaNode, schemaNamespaces, complexTypes)
    console.log(schemaObject)
}