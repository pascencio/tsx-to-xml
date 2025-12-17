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
 * Crea la interfaz de props para el componente principal
 */
export function createPropsInterfaceTemplate(baseName, baseObject) {
    const keys = getFilteredKeys(baseObject);
    const props = keys
        .map(key => `\t${toCamelCase(key)}: ${key}`)
        .join(',\n');
    
    return `export interface ${toPascalCase(baseName)}Props {
${props}
}
`;
}

/**
 * Extrae el tipo de esquema XML de una cadena con formato "prefix:type"
 */
export function extractXmlSchemaType(type) {
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
export function createInterfaceTemplateProperty(prop, props) {
    const childrenField = props.type[prop];
    const xmlSchemaType = extractXmlSchemaType(childrenField.type);
    const childrenType = XML_SCHEMA_TYPES[xmlSchemaType] ?? 'string';
    const modifier = getTypeModifier(props[prop]);
    
    return `\t${toCamelCase(prop)}: ${childrenType}${modifier}`;
}

/**
 * Crea un tipo TypeScript simple
 */
export function createTypeTemplate(name, props) {
    const parts = cachedSplit(props.type, ':');
    const typeName = parts[parts.length - 1];
    const tsType = XML_SCHEMA_TYPES[typeName];
    
    return `
export type ${toPascalCase(name)} = ${tsType}
`;
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
 * Crea una interfaz TypeScript completa
 */
export function createInterfaceTemplate(name, props) {
    const keys = Object.keys(props.type);
    const properties = keys
        .filter(prop => isValidInterfaceProperty(prop, props))
        .map(prop => createInterfaceTemplateProperty(prop, props))
        .join(',\n');
    
    return `
export interface ${toPascalCase(name)} {
${properties}
}
`;
}

/**
 * Extrae nombres de tags recursivamente de un objeto base
 * Optimizado: usa push() en lugar de spread operator
 */
export function extractTagNames(baseObject) {
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
 * Extrae un objeto que mapea prefijos de namespace a arrays de nombres de tags
 * Optimizado: combina extracción de tags con iteración principal y usa push()
 */
export function extractNamespaceObject(baseName, baseObject) {
    const namespacesObject = {};
    const baseNamespacePrefix = extractNamespacePrefix(baseObject[NAMESPACE_KEY]);
    namespacesObject[baseNamespacePrefix] = [baseName];
    
    const keys = getFilteredKeys(baseObject);
    
    for (const key of keys) {
        const element = baseObject[key];
        let namespace = key;
        const tagNames = [key];
        
        if (typeof element?.type === 'object') {
            namespace = element.type[NAMESPACE_KEY];
            const nestedTags = extractTagNames(element.type);
            tagNames.push(...nestedTags);
        }
        
        const namespacePrefix = extractNamespacePrefix(namespace);
        
        if (namespacesObject[namespacePrefix] === undefined) {
            namespacesObject[namespacePrefix] = tagNames;
        } else {
            namespacesObject[namespacePrefix].push(...tagNames);
        }
    }
    
    return namespacesObject;
}

/**
 * Extrae un objeto que mapea prefijos de namespace a URIs de namespace
 */
export function extractNamespacePrefixObject(baseName, baseObject) {
    const namespacesObject = {};
    const baseNamespacePrefix = extractNamespacePrefix(baseObject[NAMESPACE_KEY]);
    namespacesObject[baseNamespacePrefix] = baseObject[NAMESPACE_KEY];
    
    const keys = getFilteredKeys(baseObject);
    
    for (const key of keys) {
        const element = baseObject[key];
        const namespace = typeof element?.type === 'object' 
            ? element.type[NAMESPACE_KEY] 
            : key;
        const namespacePrefix = extractNamespacePrefix(namespace);
        
        if (namespacesObject[namespacePrefix] === undefined) {
            namespacesObject[namespacePrefix] = namespace;
        }
    }
    
    return namespacesObject;
}

/**
 * Aplana recursivamente las claves de un objeto base con información de namespace
 * Optimizado: usa push() en lugar de spread operator
 */
function flattenBaseObjectKeys(baseObject, currentNamespace, currentNamespacePrefix) {
    const result = [];
    const keys = getFilteredKeys(baseObject);
    
    for (const key of keys) {
        const element = baseObject[key];
        
        if (typeof element?.type === 'object') {
            const namespace = element.type[NAMESPACE_KEY];
            const namespacePrefix = extractNamespacePrefix(namespace);
            
            const nested = flattenBaseObjectKeys(element.type, namespace, namespacePrefix);
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
export function extractNamespaceTypeObject(baseName, baseObject) {
    const namespacesObject = {};
    const namespace = baseObject[NAMESPACE_KEY];
    const namespacePrefix = extractNamespacePrefix(namespace);
    
    namespacesObject[baseName] = {
        uri: namespace,
        prefix: namespacePrefix,
    };
    
    const flatKeys = flattenBaseObjectKeys(baseObject, namespace, namespacePrefix);
    for (const item of flatKeys) {
        namespacesObject[item.name] = {
            uri: item.uri,
            prefix: item.prefix,
        };
    }
    
    return namespacesObject;
}

/**
 * Extrae el prefijo de namespace de una URI
 * Optimizado: usa memoización para evitar recalcular el mismo namespace
 */
export function extractNamespacePrefix(namespace) {
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
 * Crea el template de declaraciones de namespaces
 */
export function createNamespacesTemplate(namespacesObject) {
    const keys = Object.keys(namespacesObject);
    return keys
        .map(key => {
            const tagNames = namespacesObject[key]
                .map(tag => `"${tag}"`)
                .join(', ');
            return `const ${key} = ns("${key}", [${tagNames}] as const);`;
        })
        .join('\n');
}

/**
 * Crea el template del cuerpo XML principal
 */
export function createXmlBodyTemplate(baseNamespacePrefix, namespacesTypeObject, baseName, baseObject) {
    const keys = getFilteredKeys(baseObject);
    const properties = keys
        .map(key => createXmlBodyTemplateProperty(
            namespacesTypeObject,
            baseNamespacePrefix,
            key,
            baseObject[key]
        ))
        .join('\n');
    
    return `<${baseNamespacePrefix}.${baseName}>
    ${properties}
</${baseNamespacePrefix}.${baseName}>`;
}

/**
 * Obtiene el prefijo de namespace para un elemento
 */
function getNamespacePrefix(namespacesTypeObject, baseNamespacePrefix, key, parentKey) {
    if (parentKey !== null) {
        return namespacesTypeObject[parentKey]?.prefix ?? baseNamespacePrefix;
    }
    return namespacesTypeObject[key]?.prefix ?? baseNamespacePrefix;
}

/**
 * Crea el template de una propiedad del cuerpo XML
 */
export function createXmlBodyTemplateProperty(
    namespacesTypeObject,
    baseNamespacePrefix,
    key,
    elementObject,
    parentKey = null
) {
    const namespacePrefix = getNamespacePrefix(
        namespacesTypeObject,
        baseNamespacePrefix,
        key,
        parentKey
    );
    
    if (typeof elementObject?.type === 'object') {
        const keys = getFilteredKeys(elementObject.type);
        const nestedProperties = keys
            .map(elementKey => createXmlBodyTemplateProperty(
                namespacesTypeObject,
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
