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

/**
 * Crea la interfaz de props para el componente principal
 */
export function createPropsInterfaceTemplate(baseName, baseObject) {
    const props = Object.keys(baseObject)
        .filter(key => key !== NAMESPACE_KEY)
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
    return type.split(':')[1];
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
    const typeName = props.type.split(':').slice(-1)[0];
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
    const properties = Object.keys(props.type)
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
 */
export function extractTagNames(baseObject) {
    return Object.keys(baseObject)
        .filter(key => key !== NAMESPACE_KEY)
        .reduce((acc, key) => {
            if (typeof baseObject[key]?.type === 'object') {
                return [...acc, ...extractTagNames(baseObject[key].type)];
            }
            return [...acc, key];
        }, []);
}

/**
 * Extrae un objeto que mapea prefijos de namespace a arrays de nombres de tags
 */
export function extractNamespaceObject(baseName, baseObject) {
    const namespacesObject = {};
    const baseNamespacePrefix = extractNamespacePrefix(baseObject[NAMESPACE_KEY]);
    namespacesObject[baseNamespacePrefix] = [baseName];
    
    Object.keys(baseObject)
        .filter(key => key !== NAMESPACE_KEY)
        .forEach((key) => {
            const element = baseObject[key];
            let namespace = key;
            let tagNames = [key];
            
            if (typeof element?.type === 'object') {
                namespace = element.type[NAMESPACE_KEY];
                tagNames = [...tagNames, ...extractTagNames(element.type)];
            }
            
            const namespacePrefix = extractNamespacePrefix(namespace);
            
            if (namespacesObject[namespacePrefix] === undefined) {
                namespacesObject[namespacePrefix] = tagNames;
            } else {
                namespacesObject[namespacePrefix] = [
                    ...namespacesObject[namespacePrefix],
                    ...tagNames
                ];
            }
        });
    
    return namespacesObject;
}

/**
 * Extrae un objeto que mapea prefijos de namespace a URIs de namespace
 */
export function extractNamespacePrefixObject(baseName, baseObject) {
    const namespacesObject = {};
    const baseNamespacePrefix = extractNamespacePrefix(baseObject[NAMESPACE_KEY]);
    namespacesObject[baseNamespacePrefix] = baseObject[NAMESPACE_KEY];
    
    Object.keys(baseObject)
        .filter(key => key !== NAMESPACE_KEY)
        .forEach((key) => {
            const element = baseObject[key];
            const namespace = typeof element?.type === 'object' 
                ? element.type[NAMESPACE_KEY] 
                : key;
            const namespacePrefix = extractNamespacePrefix(namespace);
            
            if (namespacesObject[namespacePrefix] === undefined) {
                namespacesObject[namespacePrefix] = namespace;
            }
        });
    
    return namespacesObject;
}

/**
 * Aplana recursivamente las claves de un objeto base con información de namespace
 */
function flattenBaseObjectKeys(baseObject, currentNamespace, currentNamespacePrefix) {
    return Object.keys(baseObject)
        .filter(key => key !== NAMESPACE_KEY)
        .reduce((acc, key) => {
            const element = baseObject[key];
            
            if (typeof element?.type === 'object') {
                const namespace = element.type[NAMESPACE_KEY];
                const namespacePrefix = extractNamespacePrefix(namespace);
                
                return [
                    ...acc,
                    ...flattenBaseObjectKeys(element.type, namespace, namespacePrefix),
                    {
                        name: key,
                        uri: namespace,
                        prefix: namespacePrefix,
                    }
                ];
            }
            
            return [...acc, {
                name: key,
                uri: currentNamespace,
                prefix: currentNamespacePrefix,
            }];
        }, []);
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
    flatKeys.forEach(item => {
        namespacesObject[item.name] = {
            uri: item.uri,
            prefix: item.prefix,
        };
    });
    
    return namespacesObject;
}

/**
 * Extrae el prefijo de namespace de una URI
 */
export function extractNamespacePrefix(namespace) {
    const hasSlash = namespace.indexOf('/') !== -1;
    const namespaceLastPart = hasSlash 
        ? namespace.split('/').slice(-1)[0] 
        : namespace;
    
    return namespaceLastPart.slice(0, 3).toLowerCase();
}

/**
 * Crea el template de declaraciones de namespaces
 */
export function createNamespacesTemplate(namespacesObject) {
    return Object.keys(namespacesObject)
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
    const properties = Object.keys(baseObject)
        .filter(key => key !== NAMESPACE_KEY)
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
        const nestedProperties = Object.keys(elementObject.type)
            .filter(elementKey => elementKey !== NAMESPACE_KEY)
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
