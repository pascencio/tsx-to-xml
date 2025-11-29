import fs from "fs";
import path from "path";
import { XMLParser } from "fast-xml-parser";

export const loadXml = (xmlPath) => {
    const xmlContentString = fs.readFileSync(xmlPath);
    const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: "",
        removeNSPrefix: false,
    });
    const xmlContentObject = parser.parse(xmlContentString);
    return xmlContentObject;
}

export const loadXsd = (wsdlFile, xsdPath) => {
    const wsdlDir = path.dirname(wsdlFile);
    return loadXml(path.resolve(wsdlDir, xsdPath));
}

const fillObject = (object, namespaces, complexTypes) => {
    for (const item of Object.keys(object)) {
        const value = object[item]
        if(complexTypes !== undefined && complexTypes[value] !== undefined) {
            object[item] = fillObject(complexTypes[value], namespaces, complexTypes)
        }
    }
    return object;
}

export const sequenceToObject = (node, namespaces, complexTypes, targetNamespace) => {
    const elementNode = getElementNode(node)
    if (Array.isArray(elementNode)) {
        const object = {};
        // Establecer el namespace del objeto al targetNamespace del schema
        if (targetNamespace !== undefined) {
            object["$namespace"] = targetNamespace;
        }
        for (const node of elementNode) {
            const [prefix, name] = node.type.split(':')
            const namespace = namespaces.get(prefix) !== undefined ? namespaces.get(prefix) : namespaces.get('targetNamespace')
            const type = namespace + ':' + name
            if (complexTypes !== undefined) {
                const complexTypeObject = complexTypes[type]
                if(complexTypeObject !== undefined && typeof complexTypeObject === 'object') {
                    object[node.name] = fillObject(complexTypeObject, namespaces, complexTypes)
                } else {
                    object[node.name] = type
                }   
            } else {
                object[node.name] = type
            }
        }
        return object;
    } else {
        const object = {};
        // Establecer el namespace del objeto al targetNamespace del schema
        if (targetNamespace !== undefined) {
            object["$namespace"] = targetNamespace;
        }
        const [prefix, name] = elementNode.type.split(':')
        const namespace = namespaces.get(prefix) !== undefined ? namespaces.get(prefix) : namespaces.get('targetNamespace')
        const type = namespace + ':' + name
        if (complexTypes !== undefined) {
            const complexTypeObject = complexTypes[type]
            if(complexTypeObject !== undefined && typeof complexTypeObject === 'object') {
                object[elementNode.name] = fillObject(complexTypeObject, namespaces, complexTypes)
            } else {
                object[elementNode.name] = type
            }
        } else {
            object[elementNode.name] = type
        }
        return object;
    }
}

export const getSequenceNode = (node) => {
    const sequenceField = Object.keys(node).find(objectField => objectField.match(/([a-zA-z0-9]*:)?sequence/));
    return node[sequenceField]
}

export const getSchemaNode = (node) => {
    const schemaField = Object.keys(node).find(objectField => objectField.match(/([a-zA-z0-9]*:)?schema/));
    return node[schemaField]
}

export const getElementNode = (node) => {
    if (Array.isArray(node)) {
        const elementNodes = [];
        for (const item of node) {
            const elementNode = getElementNode(item)
            if (elementNode !== undefined) {
                elementNodes.push(elementNode)
            }
        }
        return elementNodes;
    }
    const elementField = Object.keys(node).find(objectField => objectField.match(/([a-zA-z0-9]*:)?element/));
    return node[elementField]
}

export const getComplexTypeNode = (node) => {
    const complexTypeField = Object.keys(node).find(objectField => objectField.match(/([a-zA-z0-9]*:)?complexType/));
    return node[complexTypeField]
}

export const complexTypeToObject = (node, namespaces, complexTypes, targetNamespace) => {
    if (Array.isArray(node)) {
        const sequenceObject = {};
        for (const item of node) {
            const sequenceNode = getSequenceNode(item)
            if (sequenceNode !== undefined) {
                sequenceObject[item.name] = sequenceToObject(sequenceNode, namespaces, complexTypes, targetNamespace)
            }
        }
        return sequenceObject;
    } else {
        const sequenceNode = getSequenceNode(node)
        if (sequenceNode !== undefined) {
            const result = sequenceToObject(sequenceNode, namespaces, complexTypes, targetNamespace);
            // Establecer el namespace del objeto complejo al targetNamespace del schema
            if (targetNamespace !== undefined) {
                result["$namespace"] = targetNamespace;
            }
            return result;
        }
        console.log('node', node)
        throw new Error('No sequence node found')
    }

}

export const complexTypesFromSchema = (wsdlFile, node, namespaces) => {
    const targetNamespace = node.targetNamespace
    const schemaNamespaces = namespaces ?? getNamespacesFromNode(node)
    const currentNamespaces = schemaNamespaces
    let object = {};
    const importNode = getImportNode(node)
    if (importNode !== undefined) {
        if (Array.isArray(importNode)) {
            for (const item of importNode) {
                const importNode = loadXsd(wsdlFile, item.schemaLocation)
                const schemaNode = getSchemaNode(importNode)
                object = { ...object, ...complexTypesFromSchema(wsdlFile, schemaNode, currentNamespaces) }
            }
        } else {
            const importNode = loadXsd(wsdlFile, importNode.schemaLocation)
            const schemaNode = getSchemaNode(importNode)
            object = complexTypesFromSchema(wsdlFile, schemaNode, currentNamespaces)
        }
    }
    const complexTypeNode = getComplexTypeNode(node)
    if (complexTypeNode !== undefined) {
        if (Array.isArray(complexTypeNode)) {
            for (const item of complexTypeNode) {
                object[targetNamespace + ':' + item.name] = complexTypeToObject(item, currentNamespaces, object, targetNamespace)
            }
        } else {
            object[targetNamespace + ':' + complexTypeNode.name] = complexTypeToObject(complexTypeNode, currentNamespaces, object, targetNamespace)
        }
    }
    const elementNode = getElementNode(node)
    if (elementNode !== undefined && getSequenceNode(elementNode) !== undefined) {
        if (Array.isArray(elementNode)) {
            for (const item of elementNode) {
                object[targetNamespace + ':' + item.name] = complexTypeToObject(item, currentNamespaces, object, targetNamespace)
            }
        } else {
            object[targetNamespace + ':' + elementNode.name] = complexTypeToObject(elementNode, currentNamespaces, object, targetNamespace)
        }
    }
    return object;
}

export const schemaToObject = (node, namespaces, complexTypes) => {
    const object = {};
    const elementNode = getElementNode(node)
    if (Array.isArray(elementNode)) {
        for (const item of elementNode) {
            const complexTypeNode = getComplexTypeNode(item)
            object[item.type ?? item.name] = complexTypeToObject(complexTypeNode, namespaces, complexTypes, node.targetNamespace)
        }
    } else {
        const complexTypeNode = getComplexTypeNode(node)
        object[elementNode.type ?? elementNode.name] = complexTypeToObject(complexTypeNode, namespaces, complexTypes, node.targetNamespace)
    }
    object["$namespace"] = node.targetNamespace
    return object;
}

export const getDefinitionsNode = (node) => {
    const definitionsField = Object.keys(node).find(objectField => objectField.match(/([a-zA-z0-9]*:)?definitions/));
    return node[definitionsField]
}

export const getTypesNode = (node) => {
    const typesField = Object.keys(node).find(objectField => objectField.match(/([a-zA-z0-9]*:)?types/));
    return node[typesField]
}

export const getImportNode = (node) => {
    const importField = Object.keys(node).find(objectField => objectField.match(/([a-zA-z0-9]*:)?import/));
    return node[importField]
}

export const getNamespacesFromNode = (node) => {
    const namespaces = new Map();
    if(node.targetNamespace !== undefined) {
        namespaces.set('targetNamespace', node.targetNamespace)
    }
    for (const key of Object.keys(node)) {
        const match = key.match(/xmlns:([a-zA-z0-9]*)/)
        if (match !== null) {
            const value = node[key]
            namespaces.set(match[1], value)
        }
    }
    return namespaces;
}

export const getAllNamespaces = (wsdlRoot) => {
    console.log('wsdlRoot', wsdlRoot)
    const namespaces = new Map();
    const definitionsNode = getDefinitionsNode(wsdlRoot) ?? {};
    namespaces.set('targetNamespace', definitionsNode.targetNamespace)
    for (const key of Object.keys(definitionsNode)) {
        const match = key.match(/xmlns:([a-zA-z0-9]*)/)
        if (match !== null) {
            const value = definitionsNode[key]
            namespaces.set(match[1], value)
        }
    }
    const typeNode = getTypesNode(definitionsNode) ?? {};
    for (const key of Object.keys(typeNode)) {
        const match = key.match(/xmlns:([a-zA-z0-9]*)/)
        if (match !== null) {
            const value = typeNode[key]
            namespaces.set(match[1], value)
        }
    }
    const schemaNode = getSchemaNode(typeNode) ?? {};
    for (const key of Object.keys(schemaNode)) {
        const match = key.match(/xmlns:([a-zA-z0-9]*)/)
        if (match !== null) {
            const value = schemaNode[key]
            namespaces.set(match[1], value)
        }
    }
    const importNode = getImportNode(schemaNode) ?? {};
    for (const key of Object.keys(importNode)) {
        const match = key.match(/xmlns:([a-zA-z0-9]*)/)
        if (match !== null) {
            const value = importNode[key]
            namespaces.set(match[1], value)
        }
    }
    return namespaces;
}