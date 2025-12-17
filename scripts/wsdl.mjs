import fs from "fs";
import path from "path";
import { XMLParser } from "fast-xml-parser";

export const loadXml = async (xmlPath) => {
    let xmlContentString = undefined
    if (xmlPath.match(/^http(s)?:\/\//)) {
        const response = await fetch(xmlPath);
        xmlContentString = await response.text();
    } else {
        xmlContentString = fs.readFileSync(xmlPath);
    }

    const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: "",
        removeNSPrefix: false,
    });
    const xmlContentObject = parser.parse(xmlContentString);
    return xmlContentObject;
}

export const loadXsd = async (wsdlFile, xsdPath) => {
    if (wsdlFile.match(/^http(s)?:\/\//)) {
        const wsdlURLWithoutName = wsdlFile.split('/').slice(0, -1).join('/')
        return await loadXml([wsdlURLWithoutName, xsdPath].join('/'));
    }
    const wsdlDir = path.dirname(wsdlFile);
    return await loadXml(path.resolve(wsdlDir, xsdPath));
}

const fillObject = (object, namespaces, complexTypes) => {
    for (const item of Object.keys(object)) {
        const value = object[item]
        if (complexTypes !== undefined && complexTypes[value.type] !== undefined) {
            object[item] = fillObject(complexTypes[value.type], namespaces, complexTypes)
        }
    }
    return object;
}

// Función para procesar un elemento individual
const processSingleElement = (node, namespaces, complexTypes, targetNamespace) => {
    // Manejar elementos <any> que no tienen type
    if (node.type === undefined) {
        // Si es un elemento <any>, usar un tipo genérico
        return 'xsd:anyType';
    }
    
    // Manejar elementos con ref en lugar de type
    if (node.ref !== undefined) {
        const refValue = node.ref;
        if (refValue.includes(':')) {
            const [prefix, name] = refValue.split(':');
            const namespace = namespaces.get(prefix) !== undefined ? namespaces.get(prefix) : namespaces.get('targetNamespace');
            return namespace + ':' + name;
        } else {
            const namespace = namespaces.get('targetNamespace') || targetNamespace;
            return namespace + ':' + refValue;
        }
    }
    
    // Manejar elementos con complexType inline
    if (node.complexType !== undefined || node['xsd:complexType'] !== undefined) {
        const complexTypeNode = node.complexType || node['xsd:complexType'];
        const inlineType = complexTypeToObject(complexTypeNode, namespaces, complexTypes, targetNamespace);
        return inlineType;
    }
    
    // Procesar tipo normal
    if (node.type.includes(':')) {
        const [prefix, name] = node.type.split(':');
        const namespace = namespaces.get(prefix) !== undefined ? namespaces.get(prefix) : namespaces.get('targetNamespace');
        const type = namespace + ':' + name;
        
        if (complexTypes !== undefined) {
            const complexTypeObject = complexTypes[type];
            if (complexTypeObject !== undefined && typeof complexTypeObject === 'object') {
                return fillObject(complexTypeObject, namespaces, complexTypes);
            } else {
                return type;
            }
        } else {
            return type;
        }
    } else {
        // Tipo sin prefijo, usar targetNamespace
        const namespace = namespaces.get('targetNamespace') || targetNamespace;
        return namespace + ':' + node.type;
    }
}

// Función genérica para procesar elementos (usada por sequence, choice, all)
const processElementsToObject = (elementNode, namespaces, complexTypes, targetNamespace) => {
    // Si elementNode es undefined, retornar objeto vacío
    if (elementNode === undefined) {
        const object = {};
        if (targetNamespace !== undefined) {
            object["$namespace"] = targetNamespace;
        }
        return object;
    }
    
    if (Array.isArray(elementNode)) {
        const object = {};
        // Establecer el namespace del objeto al targetNamespace del schema
        if (targetNamespace !== undefined) {
            object["$namespace"] = targetNamespace;
        }
        for (const node of elementNode) {
            // Manejar elementos <any> que no tienen name
            if (node === undefined || node.name === undefined) {
                // Es un elemento <any> o undefined, podemos omitirlo o agregarlo como tipo especial
                continue;
            }
            const processedType = processSingleElement(node, namespaces, complexTypes, targetNamespace);
            object[node.name] = {
                maxOccurs: node.maxOccurs ?? '1',
                minOccurs: node.minOccurs ?? '1',
                type: processedType,
            };
        }
        return object;
    } else {
        const object = {};
        // Establecer el namespace del objeto al targetNamespace del schema
        if (targetNamespace !== undefined) {
            object["$namespace"] = targetNamespace;
        }
        
        // Manejar elementos <any> que no tienen name
        if (elementNode.name === undefined) {
            // Es un elemento <any>, retornar objeto con tipo especial
            return object;
        }
        
        const processedType = processSingleElement(elementNode, namespaces, complexTypes, targetNamespace);
        object[elementNode.name] = {
            maxOccurs: elementNode.maxOccurs ?? '1',
            minOccurs: elementNode.minOccurs ?? '1',
            type: processedType,
        };
        return object;
    }
}

export const sequenceToObject = (node, namespaces, complexTypes, targetNamespace) => {
    const elementNode = getElementNode(node)
    return processElementsToObject(elementNode, namespaces, complexTypes, targetNamespace)
}

export const choiceToObject = (node, namespaces, complexTypes, targetNamespace) => {
    const elementNode = getElementNode(node)
    return processElementsToObject(elementNode, namespaces, complexTypes, targetNamespace)
}

export const allToObject = (node, namespaces, complexTypes, targetNamespace) => {
    const elementNode = getElementNode(node)
    return processElementsToObject(elementNode, namespaces, complexTypes, targetNamespace)
}

export const groupToObject = (node, namespaces, complexTypes, targetNamespace) => {
    // Un group puede contener sequence, choice, all, etc.
    // Primero intentamos obtener los elementos directamente del group
    const elementNode = getElementNode(node)
    if (elementNode !== undefined) {
        return processElementsToObject(elementNode, namespaces, complexTypes, targetNamespace)
    }
    
    // Si no hay elementos directos, buscamos sequence, choice, all dentro del group
    const sequenceNode = getSequenceNode(node)
    if (sequenceNode !== undefined) {
        return sequenceToObject(sequenceNode, namespaces, complexTypes, targetNamespace)
    }
    
    const choiceNode = getChoiceNode(node)
    if (choiceNode !== undefined) {
        return choiceToObject(choiceNode, namespaces, complexTypes, targetNamespace)
    }
    
    const allNode = getAllNode(node)
    if (allNode !== undefined) {
        return allToObject(allNode, namespaces, complexTypes, targetNamespace)
    }
    
    // Si no encontramos nada, retornamos objeto vacío
    const object = {};
    if (targetNamespace !== undefined) {
        object["$namespace"] = targetNamespace;
    }
    return object;
}

export const simpleContentToObject = (node, namespaces, complexTypes, targetNamespace) => {
    const object = {};
    if (targetNamespace !== undefined) {
        object["$namespace"] = targetNamespace;
    }
    
    // Buscar extension o restriction dentro de simpleContent
    const extensionNode = getExtensionNode(node)
    if (extensionNode !== undefined) {
        // El extension tiene un base que es el tipo base
        if (extensionNode.base !== undefined) {
            object["$base"] = extensionNode.base;
        }
        
        // Puede tener attributes
        const attributeNode = getAttributeNode(extensionNode)
        if (attributeNode !== undefined) {
            const attributes = Array.isArray(attributeNode) ? attributeNode : [attributeNode];
            const attrs = {};
            for (const attr of attributes) {
                if (attr.name !== undefined) {
                    const attrType = attr.type || attr.base || 'xsd:string';
                    attrs[attr.name] = attrType;
                }
            }
            if (Object.keys(attrs).length > 0) {
                object["$attributes"] = attrs;
            }
        }
        
        // Buscar sequence, choice, all dentro del extension (aunque es raro en simpleContent)
        const sequenceNode = getSequenceNode(extensionNode)
        if (sequenceNode !== undefined) {
            const seqResult = sequenceToObject(sequenceNode, namespaces, complexTypes, targetNamespace);
            Object.assign(object, seqResult);
        }
        
        return object;
    }
    
    const restrictionNode = getRestrictionNode(node)
    if (restrictionNode !== undefined) {
        // Similar a extension pero con restriction
        if (restrictionNode.base !== undefined) {
            object["$base"] = restrictionNode.base;
        }
        
        const attributeNode = getAttributeNode(restrictionNode)
        if (attributeNode !== undefined) {
            const attributes = Array.isArray(attributeNode) ? attributeNode : [attributeNode];
            const attrs = {};
            for (const attr of attributes) {
                if (attr.name !== undefined) {
                    const attrType = attr.type || attr.base || 'xsd:string';
                    attrs[attr.name] = attrType;
                }
            }
            if (Object.keys(attrs).length > 0) {
                object["$attributes"] = attrs;
            }
        }
        
        return object;
    }
    
    return object;
}

export const complexContentToObject = (node, namespaces, complexTypes, targetNamespace) => {
    const object = {};
    if (targetNamespace !== undefined) {
        object["$namespace"] = targetNamespace;
    }
    
    // Buscar extension o restriction dentro de complexContent
    const extensionNode = getExtensionNode(node)
    if (extensionNode !== undefined) {
        // El extension tiene un base que es el tipo base
        if (extensionNode.base !== undefined) {
            object["$base"] = extensionNode.base;
        }
        
        // Buscar sequence, choice, all dentro del extension
        const sequenceNode = getSequenceNode(extensionNode)
        if (sequenceNode !== undefined) {
            const seqResult = sequenceToObject(sequenceNode, namespaces, complexTypes, targetNamespace);
            Object.assign(object, seqResult);
        }
        
        const choiceNode = getChoiceNode(extensionNode)
        if (choiceNode !== undefined) {
            const choiceResult = choiceToObject(choiceNode, namespaces, complexTypes, targetNamespace);
            Object.assign(object, choiceResult);
        }
        
        const allNode = getAllNode(extensionNode)
        if (allNode !== undefined) {
            const allResult = allToObject(allNode, namespaces, complexTypes, targetNamespace);
            Object.assign(object, allResult);
        }
        
        // Puede tener attributes
        const attributeNode = getAttributeNode(extensionNode)
        if (attributeNode !== undefined) {
            const attributes = Array.isArray(attributeNode) ? attributeNode : [attributeNode];
            const attrs = {};
            for (const attr of attributes) {
                if (attr.name !== undefined) {
                    const attrType = attr.type || attr.base || 'xsd:string';
                    attrs[attr.name] = attrType;
                }
            }
            if (Object.keys(attrs).length > 0) {
                object["$attributes"] = attrs;
            }
        }
        
        return object;
    }
    
    const restrictionNode = getRestrictionNode(node)
    if (restrictionNode !== undefined) {
        // Similar a extension pero con restriction
        if (restrictionNode.base !== undefined) {
            object["$base"] = restrictionNode.base;
        }
        
        const sequenceNode = getSequenceNode(restrictionNode)
        if (sequenceNode !== undefined) {
            const seqResult = sequenceToObject(sequenceNode, namespaces, complexTypes, targetNamespace);
            Object.assign(object, seqResult);
        }
        
        const choiceNode = getChoiceNode(restrictionNode)
        if (choiceNode !== undefined) {
            const choiceResult = choiceToObject(choiceNode, namespaces, complexTypes, targetNamespace);
            Object.assign(object, choiceResult);
        }
        
        const allNode = getAllNode(restrictionNode)
        if (allNode !== undefined) {
            const allResult = allToObject(allNode, namespaces, complexTypes, targetNamespace);
            Object.assign(object, allResult);
        }
        
        return object;
    }
    
    return object;
}

export const getSequenceNode = (node) => {
    const sequenceField = Object.keys(node).find(objectField => objectField.match(/([a-zA-z0-9]*:)?sequence/));
    return node[sequenceField]
}

export const getChoiceNode = (node) => {
    const choiceField = Object.keys(node).find(objectField => objectField.match(/([a-zA-z0-9]*:)?choice/));
    return node[choiceField]
}

export const getAllNode = (node) => {
    const allField = Object.keys(node).find(objectField => objectField.match(/([a-zA-z0-9]*:)?all/));
    return node[allField]
}

export const getGroupNode = (node) => {
    const groupField = Object.keys(node).find(objectField => objectField.match(/([a-zA-z0-9]*:)?group/));
    return node[groupField]
}

export const getSimpleContentNode = (node) => {
    const simpleContentField = Object.keys(node).find(objectField => objectField.match(/([a-zA-z0-9]*:)?simpleContent/));
    return node[simpleContentField]
}

export const getComplexContentNode = (node) => {
    const complexContentField = Object.keys(node).find(objectField => objectField.match(/([a-zA-z0-9]*:)?complexContent/));
    return node[complexContentField]
}

export const getExtensionNode = (node) => {
    const extensionField = Object.keys(node).find(objectField => objectField.match(/([a-zA-z0-9]*:)?extension/));
    return node[extensionField]
}

export const getRestrictionNode = (node) => {
    const restrictionField = Object.keys(node).find(objectField => objectField.match(/([a-zA-z0-9]*:)?restriction/));
    return node[restrictionField]
}

export const getAttributeNode = (node) => {
    const attributeField = Object.keys(node).find(objectField => objectField.match(/([a-zA-z0-9]*:)?attribute/));
    return node[attributeField]
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
        const resultObject = {};
        for (const item of node) {
            const sequenceNode = getSequenceNode(item)
            if (sequenceNode !== undefined) {
                resultObject[item.name] = sequenceToObject(sequenceNode, namespaces, complexTypes, targetNamespace)
                continue
            }
            
            const choiceNode = getChoiceNode(item)
            if (choiceNode !== undefined) {
                resultObject[item.name] = choiceToObject(choiceNode, namespaces, complexTypes, targetNamespace)
                continue
            }
            
            const allNode = getAllNode(item)
            if (allNode !== undefined) {
                resultObject[item.name] = allToObject(allNode, namespaces, complexTypes, targetNamespace)
                continue
            }
            
            const groupNode = getGroupNode(item)
            if (groupNode !== undefined) {
                resultObject[item.name] = groupToObject(groupNode, namespaces, complexTypes, targetNamespace)
                continue
            }
            
            const simpleContentNode = getSimpleContentNode(item)
            if (simpleContentNode !== undefined) {
                resultObject[item.name] = simpleContentToObject(simpleContentNode, namespaces, complexTypes, targetNamespace)
                continue
            }
            
            const complexContentNode = getComplexContentNode(item)
            if (complexContentNode !== undefined) {
                resultObject[item.name] = complexContentToObject(complexContentNode, namespaces, complexTypes, targetNamespace)
                continue
            }
        }
        return resultObject;
    } else {
        // Buscar sequence primero
        const sequenceNode = getSequenceNode(node)
        if (sequenceNode !== undefined) {
            const result = sequenceToObject(sequenceNode, namespaces, complexTypes, targetNamespace);
            // Establecer el namespace del objeto complejo al targetNamespace del schema
            if (targetNamespace !== undefined) {
                result["$namespace"] = targetNamespace;
            }
            return result;
        }
        
        // Buscar choice
        const choiceNode = getChoiceNode(node)
        if (choiceNode !== undefined) {
            const result = choiceToObject(choiceNode, namespaces, complexTypes, targetNamespace);
            if (targetNamespace !== undefined) {
                result["$namespace"] = targetNamespace;
            }
            return result;
        }
        
        // Buscar all
        const allNode = getAllNode(node)
        if (allNode !== undefined) {
            const result = allToObject(allNode, namespaces, complexTypes, targetNamespace);
            if (targetNamespace !== undefined) {
                result["$namespace"] = targetNamespace;
            }
            return result;
        }
        
        // Buscar group
        const groupNode = getGroupNode(node)
        if (groupNode !== undefined) {
            const result = groupToObject(groupNode, namespaces, complexTypes, targetNamespace);
            if (targetNamespace !== undefined) {
                result["$namespace"] = targetNamespace;
            }
            return result;
        }
        
        // Buscar simpleContent
        const simpleContentNode = getSimpleContentNode(node)
        if (simpleContentNode !== undefined) {
            const result = simpleContentToObject(simpleContentNode, namespaces, complexTypes, targetNamespace);
            if (targetNamespace !== undefined) {
                result["$namespace"] = targetNamespace;
            }
            return result;
        }
        
        // Buscar complexContent
        const complexContentNode = getComplexContentNode(node)
        if (complexContentNode !== undefined) {
            const result = complexContentToObject(complexContentNode, namespaces, complexTypes, targetNamespace);
            if (targetNamespace !== undefined) {
                result["$namespace"] = targetNamespace;
            }
            return result;
        }
        
        throw new Error('No se encontró nodo sequence, choice, all, group, simpleContent o complexContent')
    }
}

export const complexTypesFromSchema = async (wsdlFile, node, namespaces) => {
    const targetNamespace = node.targetNamespace
    const schemaNamespaces = namespaces ?? getNamespacesFromNode(node)
    const currentNamespaces = schemaNamespaces
    let object = {};
    const importNode = getImportNode(node)
    if (importNode !== undefined) {
        if (Array.isArray(importNode)) {
            for (const item of importNode) {
                const importedXsd = await loadXsd(wsdlFile, item.schemaLocation)
                const schemaNode = getSchemaNode(importedXsd)
                const importedComplexTypes = await complexTypesFromSchema(wsdlFile, schemaNode, currentNamespaces)
                object = { ...object, ...importedComplexTypes }
            }
        } else {
            const importedXsd = await loadXsd(wsdlFile, importNode.schemaLocation)
            const schemaNode = getSchemaNode(importedXsd)
            const importedComplexTypes = await complexTypesFromSchema(wsdlFile, schemaNode, currentNamespaces)
            object = { ...object, ...importedComplexTypes }
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
    // Buscar elementos con complexType inline (elementos que tienen complexType dentro de ellos)
    const elementNode = getElementNode(node)
    if (elementNode !== undefined) {
        if (Array.isArray(elementNode)) {
            for (const item of elementNode) {
                const itemComplexType = getComplexTypeNode(item)
                if (itemComplexType !== undefined) {
                    // Elemento con complexType inline
                    object[targetNamespace + ':' + item.name] = complexTypeToObject(itemComplexType, currentNamespaces, object, targetNamespace)
                } else if (getSequenceNode(item) !== undefined) {
                    // Elemento con sequence directamente (sin complexType wrapper)
                    object[targetNamespace + ':' + item.name] = complexTypeToObject(item, currentNamespaces, object, targetNamespace)
                }
            }
        } else {
            const elementComplexType = getComplexTypeNode(elementNode)
            if (elementComplexType !== undefined) {
                // Elemento con complexType inline
                object[targetNamespace + ':' + elementNode.name] = complexTypeToObject(elementComplexType, currentNamespaces, object, targetNamespace)
            } else if (getSequenceNode(elementNode) !== undefined) {
                // Elemento con sequence directamente (sin complexType wrapper)
                object[targetNamespace + ':' + elementNode.name] = complexTypeToObject(elementNode, currentNamespaces, object, targetNamespace)
            }
        }
    }
    return object;
}

export const schemaToObject =  (node, namespaces, complexTypes) => {
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

export const getMessageNode = (node) => {
    const messageField = Object.keys(node).find(objectField => objectField.match(/([a-zA-z0-9]*:)?message/));
    return node[messageField]
}

export const getPortTypeNode = (node) => {
    const portTypeField = Object.keys(node).find(objectField => objectField.match(/([a-zA-z0-9]*:)?portType/));
    return node[portTypeField]
}

export const getOperationNode = (node) => {
    const operationField = Object.keys(node).find(objectField => objectField.match(/([a-zA-z0-9]*:)?operation/));
    return node[operationField]
}

export const getInputNode = (node) => {
    const inputField = Object.keys(node).find(objectField => objectField.match(/([a-zA-z0-9]*:)?input/));
    return node[inputField]
}

export const getPartNode = (node) => {
    const partField = Object.keys(node).find(objectField => objectField.match(/([a-zA-z0-9]*:)?part/));
    return node[partField]
}

export const getRequestTypeFromDefinitions = (definitionsNode, schemaObject) => {
    const portTypeNode = getPortTypeNode(definitionsNode)
    const operationNode = getOperationNode(portTypeNode)
    const inputNode = getInputNode(operationNode)
    const messageNode = getMessageNode(definitionsNode)
    const inputMessageNode = messageNode.find(item => inputNode.message.endsWith(item.name))
    const partNode = getPartNode(inputMessageNode)
    const requestType = Object.keys(schemaObject).find(item => partNode.element.endsWith(item))
    return requestType
}

export const getNamespacesFromNode = (node) => {
    const namespaces = new Map();
    if (node.targetNamespace !== undefined) {
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