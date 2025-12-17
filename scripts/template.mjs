import { toPascalCase, toCamelCase } from "./util.mjs";

const XML_SCHEMA_TYPES = {
    'string': 'string',
    'int': 'number',
    'float': 'number',
    'double': 'number',
    'boolean': 'boolean',
    'date': 'Date',
    'time': 'Date',
    'dateTime': 'Date',
    'duration': 'string',
    'gYearMonth': 'string',
    'gYear': 'string',
    'gMonthDay': 'string',
    'gDay': 'string',
    'gMonth': 'string',
    'gYearDay': 'string',
};

const NAMESPACE_KEY = '$namespace';
const XML_SCHEMA_URI = 'http://www.w3.org/2001/XMLSchema';
const DEFAULT_OCCURS = '1';

// Cache para memoización de extractNamespacePrefix
const namespacePrefixCache = new Map();

// Cache para operaciones de split en strings
const stringSplitCache = new Map();

/**
 * Obtiene las claves de un objeto filtradas (sin NAMESPACE_KEY)
 * Cachea el resultado para evitar múltiples Object.keys() y filtros
 */
function getFilteredKeys(obj) {
    if (!obj || typeof obj !== 'object') return [];
    const keys = Object.keys(obj);
    return keys.filter(key => key !== NAMESPACE_KEY);
}

/**
 * Cachea el resultado de split para strings que se usan frecuentemente
 */
function cachedSplit(str, separator) {
    const cacheKey = `${str}${separator}`;
    if (stringSplitCache.has(cacheKey)) {
        return stringSplitCache.get(cacheKey);
    }
    const result = str.split(separator);
    stringSplitCache.set(cacheKey, result);
    return result;
}

/**
 * Extrae el tipo de esquema XML de una cadena con formato "prefix:type"
 */
function extractXmlSchemaType(type) {
    const parts = cachedSplit(type, ':');
    return parts[1];
}

/**
 * Determina si una propiedad es opcional o un array basado en minOccurs y maxOccurs
 */
function getTypeModifier(propConfig) {
    const maxOccurs = propConfig?.maxOccurs ?? DEFAULT_OCCURS;
    const minOccurs = propConfig?.minOccurs ?? DEFAULT_OCCURS;
    
    if (maxOccurs !== DEFAULT_OCCURS) {
        return '[]';
    }
    if (minOccurs !== DEFAULT_OCCURS) {
        return '?';
    }
    return '';
}

/**
 * Crea una propiedad de interfaz TypeScript
 */
function createInterfacePropertyCode(prop, props) {
    const childrenField = props.type[prop];
    const xmlSchemaType = extractXmlSchemaType(childrenField.type);
    const childrenType = XML_SCHEMA_TYPES[xmlSchemaType] ?? 'string';
    const modifier = getTypeModifier(props[prop]);
    
    return `\t${toCamelCase(prop)}: ${childrenType}${modifier}`;
}

/**
 * Filtra propiedades válidas para una interfaz TypeScript
 */
function isValidInterfaceProperty(prop, props) {
    if (prop.includes('$')) return false;
    if (prop === 'minOccurs' || prop === 'maxOccurs') return false;
    if (prop === NAMESPACE_KEY) return false;
    if (/^[0-9]*$/.test(prop)) return false;
    if (props[prop]?.type?.includes(XML_SCHEMA_URI)) return false;
    
    return true;
}

/**
 * Genera el código de la interfaz de props para el componente principal
 */
export function generatePropsInterfaceCode(typeName, typeObject) {
    const keys = getFilteredKeys(typeObject);
    const props = keys
        .map(key => `\t${toCamelCase(key)}: ${key}`)
        .join(',\n');
    
    return `export interface ${toPascalCase(typeName)}Props {
${props}
}
`;
}

/**
 * Genera el código de un tipo TypeScript simple
 */
export function generateTypeCode(typeName, typeDefinition) {
    const parts = cachedSplit(typeDefinition.type, ':');
    const xmlSchemaTypeName = parts[parts.length - 1];
    const tsType = XML_SCHEMA_TYPES[xmlSchemaTypeName];
    
    return `
export type ${toPascalCase(typeName)} = ${tsType}
`;
}

/**
 * Genera el código de una interfaz TypeScript completa
 */
export function generateInterfaceCode(interfaceName, interfaceDefinition) {
    const keys = Object.keys(interfaceDefinition.type);
    const properties = keys
        .filter(prop => isValidInterfaceProperty(prop, interfaceDefinition))
        .map(prop => createInterfacePropertyCode(prop, interfaceDefinition))
        .join(',\n');
    
    return `
export interface ${toPascalCase(interfaceName)} {
${properties}
}
`;
}

/**
 * Extrae nombres de tags recursivamente de un objeto base
 * Optimizado: usa push() en lugar de spread operator
 */
function extractTagNames(baseObject) {
    const result = [];
    const keys = getFilteredKeys(baseObject);
    
    for (const key of keys) {
        const element = baseObject[key];
        if (typeof element?.type === 'object') {
            const nestedTags = extractTagNames(element.type);
            result.push(...nestedTags);
        }
        result.push(key);
    }
    
    return result;
}

/**
 * Extrae el prefijo de namespace de una URI
 * Optimizado: usa memoización para evitar recalcular el mismo namespace
 */
function extractNamespacePrefix(namespace) {
    if (namespacePrefixCache.has(namespace)) {
        return namespacePrefixCache.get(namespace);
    }
    
    const hasSlash = namespace.indexOf('/') !== -1;
    let namespaceLastPart;
    
    if (hasSlash) {
        const parts = cachedSplit(namespace, '/');
        namespaceLastPart = parts[parts.length - 1];
    } else {
        namespaceLastPart = namespace;
    }
    
    const prefix = namespaceLastPart.slice(0, 3).toLowerCase();
    namespacePrefixCache.set(namespace, prefix);
    
    return prefix;
}

/**
 * Extrae un objeto que mapea prefijos de namespace a arrays de nombres de tags
 * Optimizado: combina extracción de tags con iteración principal y usa push()
 */
export function extractNamespaceTagsMapping(baseTypeName, baseTypeObject) {
    const namespacesMapping = {};
    const baseNamespacePrefix = extractNamespacePrefix(baseTypeObject[NAMESPACE_KEY]);
    namespacesMapping[baseNamespacePrefix] = [baseTypeName];
    
    const keys = getFilteredKeys(baseTypeObject);
    
    for (const key of keys) {
        const element = baseTypeObject[key];
        let namespace = key;
        const tagNames = [key];
        
        if (typeof element?.type === 'object') {
            namespace = element.type[NAMESPACE_KEY];
            const nestedTags = extractTagNames(element.type);
            tagNames.push(...nestedTags);
        }
        
        const namespacePrefix = extractNamespacePrefix(namespace);
        
        if (namespacesMapping[namespacePrefix] === undefined) {
            namespacesMapping[namespacePrefix] = tagNames;
        } else {
            namespacesMapping[namespacePrefix].push(...tagNames);
        }
    }
    
    return namespacesMapping;
}

/**
 * Extrae un objeto que mapea prefijos de namespace a URIs de namespace
 */
export function extractNamespacePrefixesMapping(baseTypeName, baseTypeObject) {
    const namespacesMapping = {};
    const baseNamespacePrefix = extractNamespacePrefix(baseTypeObject[NAMESPACE_KEY]);
    namespacesMapping[baseNamespacePrefix] = baseTypeObject[NAMESPACE_KEY];
    
    const keys = getFilteredKeys(baseTypeObject);
    
    for (const key of keys) {
        const element = baseTypeObject[key];
        const namespace = typeof element?.type === 'object' 
            ? element.type[NAMESPACE_KEY] 
            : key;
        const namespacePrefix = extractNamespacePrefix(namespace);
        
        if (namespacesMapping[namespacePrefix] === undefined) {
            namespacesMapping[namespacePrefix] = namespace;
        }
    }
    
    return namespacesMapping;
}

/**
 * Aplana recursivamente las claves de un objeto base con información de namespace
 * Optimizado: usa push() en lugar de spread operator
 */
function flattenTypeKeys(typeObject, currentNamespace, currentNamespacePrefix) {
    const result = [];
    const keys = getFilteredKeys(typeObject);
    
    for (const key of keys) {
        const element = typeObject[key];
        
        if (typeof element?.type === 'object') {
            const namespace = element.type[NAMESPACE_KEY];
            const namespacePrefix = extractNamespacePrefix(namespace);
            
            const nested = flattenTypeKeys(element.type, namespace, namespacePrefix);
            result.push(...nested);
            
            result.push({
                name: key,
                uri: namespace,
                prefix: namespacePrefix,
            });
        } else {
            result.push({
                name: key,
                uri: currentNamespace,
                prefix: currentNamespacePrefix,
            });
        }
    }
    
    return result;
}

/**
 * Extrae un objeto que mapea nombres de tipos a información de namespace (URI y prefijo)
 */
export function extractNamespaceTypesMapping(baseTypeName, baseTypeObject) {
    const namespacesMapping = {};
    const namespace = baseTypeObject[NAMESPACE_KEY];
    const namespacePrefix = extractNamespacePrefix(namespace);
    
    namespacesMapping[baseTypeName] = {
        uri: namespace,
        prefix: namespacePrefix,
    };
    
    const flatKeys = flattenTypeKeys(baseTypeObject, namespace, namespacePrefix);
    for (const item of flatKeys) {
        namespacesMapping[item.name] = {
            uri: item.uri,
            prefix: item.prefix,
        };
    }
    
    return namespacesMapping;
}

/**
 * Genera el código de declaraciones de namespaces
 */
export function generateNamespacesCode(namespacesMapping) {
    const keys = Object.keys(namespacesMapping);
    return keys
        .map(key => {
            const tagNames = namespacesMapping[key]
                .map(tag => `"${tag}"`)
                .join(', ');
            return `const ${key} = ns("${key}", [${tagNames}] as const);`;
        })
        .join('\n');
}

/**
 * Obtiene el prefijo de namespace para un elemento
 */
function getNamespacePrefix(namespacesTypeMapping, baseNamespacePrefix, key, parentKey) {
    if (parentKey !== null) {
        return namespacesTypeMapping[parentKey]?.prefix ?? baseNamespacePrefix;
    }
    return namespacesTypeMapping[key]?.prefix ?? baseNamespacePrefix;
}

/**
 * Genera el código del template de una propiedad del cuerpo XML
 */
function generateXmlPropertyCode(
    namespacesTypeMapping,
    baseNamespacePrefix,
    key,
    elementObject,
    parentKey = null
) {
    const namespacePrefix = getNamespacePrefix(
        namespacesTypeMapping,
        baseNamespacePrefix,
        key,
        parentKey
    );
    
    if (typeof elementObject?.type === 'object') {
        const keys = getFilteredKeys(elementObject.type);
        const nestedProperties = keys
            .map(elementKey => generateXmlPropertyCode(
                namespacesTypeMapping,
                baseNamespacePrefix,
                elementKey,
                elementObject.type[elementKey],
                key
            ))
            .join('\n');
        
        return `<${namespacePrefix}.${key}>
    ${nestedProperties}
    </${namespacePrefix}.${key}>`;
    }
    
    const propertyName = parentKey !== null
        ? `${toCamelCase(parentKey)}.${toCamelCase(key)}`
        : toCamelCase(key);
    
    return `<${namespacePrefix}.${key}>{props.${propertyName}}</${namespacePrefix}.${key}>`;
}

/**
 * Genera el código del cuerpo XML principal
 */
export function generateXmlBodyCode(baseNamespacePrefix, namespacesTypeMapping, baseTypeName, baseTypeObject) {
    const keys = getFilteredKeys(baseTypeObject);
    const properties = keys
        .map(key => generateXmlPropertyCode(
            namespacesTypeMapping,
            baseNamespacePrefix,
            key,
            baseTypeObject[key]
        ))
        .join('\n');
    
    return `<${baseNamespacePrefix}.${baseTypeName}>
    ${properties}
</${baseNamespacePrefix}.${baseTypeName}>`;
}
