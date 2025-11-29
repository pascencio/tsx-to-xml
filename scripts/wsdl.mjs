export const sequenceToObject = (node) => {
    const object = {};
    const elementNode = getElementNode(node)
    if (Array.isArray(elementNode)) {
        for (const node of elementNode) {
            object[node.name] = node.type
        }
    } else {
        object[elementNode.name] = elementNode.type
    }
    return object;
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
    const elementField = Object.keys(node).find(objectField => objectField.match(/([a-zA-z0-9]*:)?element/));
    return node[elementField]
}

export const getComplexTypeNode = (node) => {
    const complexTypeField = Object.keys(node).find(objectField => objectField.match(/([a-zA-z0-9]*:)?complexType/));
    return node[complexTypeField]
}

export const complexTypeToObject = (node) => {
    const sequenceNode = getSequenceNode(node)
    if (sequenceNode !== undefined) {
        return sequenceToObject(sequenceNode)
    }
    throw new Error('No sequence node found')
}

export const schemaToObject = (node) => {
    const object = {};
    const elementNode = getElementNode(node)
    if (Array.isArray(elementNode)) {
        for (const item of elementNode) {
            const complexTypeNode = getComplexTypeNode(item)
            object[item.name] = complexTypeToObject(complexTypeNode)
        }
    } else {
        const complexTypeNode = getComplexTypeNode(node)
        object[elementNode.name] = complexTypeToObject(complexTypeNode)
        object.type = elementNode.type
    }
    object.targetNamespace = node.targetNamespace
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

export const getAllNamespaces = (wsdlRoot) => {
    console.log('wsdlRoot', wsdlRoot)
    const namespaces = new Set();
    const definitionsNode = getDefinitionsNode(wsdlRoot)
    for (const key of Object.keys(definitionsNode)) {
        const match = key.match(/xmlns:([a-zA-z0-9]*)/)
        if (match !== null) {
            const value = definitionsNode[key]
            namespaces.add({
                prefix: match[1],
                URI: value
            })
        }
    }
    const typeNode = getTypesNode(definitionsNode)
    for (const key of Object.keys(typeNode)) {
        const match = key.match(/xmlns:([a-zA-z0-9]*)/)
        if (match !== null) {
            const value = typeNode[key]
            namespaces.add({
                prefix: match[1],
                URI: value
            })
        }
    }
    const schemaNode = getSchemaNode(typeNode)
    for (const key of Object.keys(schemaNode)) {
        const match = key.match(/xmlns:([a-zA-z0-9]*)/)
        if (match !== null) {
            const value = schemaNode[key]
            namespaces.add({
                prefix: match[1],
                URI: value
            })
        }
    }
    const importNode = getImportNode(schemaNode)
    for (const key of Object.keys(importNode)) {
        const match = key.match(/xmlns:([a-zA-z0-9]*)/)
        if (match !== null) {
            const value = importNode[key]
            namespaces.add({
                prefix: match[1],
                URI: value
            })
        }
    }
    return namespaces;
}