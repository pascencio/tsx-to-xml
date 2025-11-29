import fs from "fs";
import path from "path";
import { XMLParser } from "fast-xml-parser";
import { schemaToObject, getSchemaNode, getTypesNode, getDefinitionsNode, getImportNode, getAllNamespaces } from "./wsdl.mjs";

const WSDL_PATH = process.argv[2];
const OUT_DIR = process.argv[3];

const complexTypes = new Map();

const loadXml = (xmlPath) => {
    const xmlContentString = fs.readFileSync(xmlPath);
    const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: "",
        removeNSPrefix: false,
    });
    const xmlContentObject = parser.parse(xmlContentString);
    return xmlContentObject;
}

const loadXsd = (xsdPath) => {
    const wsdlDir = path.dirname(WSDL_PATH);
    return loadXml(path.resolve(wsdlDir, xsdPath));
}

const wsdlRoot = loadXml(WSDL_PATH);
const definitionsNode = getDefinitionsNode(wsdlRoot)
const typeNode = getTypesNode(definitionsNode)
const schemaNode = getSchemaNode(typeNode)
const importNode = getImportNode(schemaNode)

const namespaces = getAllNamespaces(wsdlRoot)
console.log('namespaces', namespaces)
if (Array.isArray(importNode)) {
    for (const importNodeEntry of importNode) {
        const importNode = loadXsd(importNodeEntry.schemaLocation)
        const schemaNode = getSchemaNode(importNode)
        const schemaObject = schemaToObject(schemaNode)
        if(schemaObject.type !== undefined) {
            complexTypes.set(schemaObject.type, schemaObject)
        }
        console.log(schemaObject)
    }
} else {
    const importNode = loadXsd(importNode.schemaLocation)
    const schemaNode = getSchemaNode(importNode)
    const schemaObject = schemaToObject(schemaNode)
    if(schemaObject.type !== undefined) {
        complexTypes.set(schemaObject.type, schemaObject)
    }
    console.log(schemaObject)
}

if(schemaNode !== undefined) {
    const schemaObject = schemaToObject(schemaNode)
    if(schemaObject.type !== undefined) {
        complexTypes.set(schemaObject.type, schemaObject)
    }
    console.log(schemaObject)
}