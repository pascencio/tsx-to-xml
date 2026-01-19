import { toPascalCase, toCamelCase } from "./util.js";

const XML_SCHEMA_TYPES: Record<string, string> = {
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

interface TypeDefinition {
    type: string | TypeObject;
    maxOccurs?: string;
    minOccurs?: string;
}

interface TypeObject {
    [key: string]: TypeDefinition | string | undefined;
    $namespace?: string;
}

interface NamespaceInfo {
    uri: string;
    prefix: string;
}

interface NamespaceTagsMapping {
    [prefix: string]: string[];
}

interface NamespacePrefixesMapping {
    [prefix: string]: string;
}

interface NamespaceTypesMapping {
    [name: string]: NamespaceInfo;
}

// Cache para memoizaciรณn de extractNamespacePrefix
const namespacePrefixCache = new Map<string, string>();

// Cache para operaciones de split en strings
const stringSplitCache = new Map<string, string[]>();

// Cache para claves filtradas usando WeakMap (permite garbage collection automática)
const filteredKeysCache = new WeakMap<TypeObject, string[]>();

/**
 * Obtiene las claves de un objeto filtradas (sin NAMESPACE_KEY)
 * Cachea el resultado para evitar mรบltiples Object.keys() y filtros
 */
function getFilteredKeys(obj: TypeObject | null | undefined): string[] {
    if (!obj || typeof obj !== 'object') return [];
    
    if (filteredKeysCache.has(obj)) {
        return filteredKeysCache.get(obj)!;
    }
    
    const keys = Object.keys(obj).filter(key => key !== NAMESPACE_KEY);
    filteredKeysCache.set(obj, keys);
    return keys;
}

/**
 * Cachea el resultado de split para strings que se usan frecuentemente
 */
export function cachedSplit(str: string, separator: string): string[] {
    const cacheKey = `${str}${separator}`;
    if (stringSplitCache.has(cacheKey)) {
        return stringSplitCache.get(cacheKey)!;
    }
    const result = str.split(separator);
    stringSplitCache.set(cacheKey, result);
    return result;
}

/**
 * Extrae el tipo de esquema XML de una cadena con formato "prefix:type"
 */
function extractXmlSchemaType(type: string): string {
    const parts = cachedSplit(type, ':');
    return parts[1]!;
}

/**
 * Determina si una propiedad es opcional o un array basado en minOccurs y maxOccurs
 */
function getTypeModifier(propConfig?: TypeDefinition): string {
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
function createInterfacePropertyCode(prop: string, props: { type: TypeObject } & Record<string, any>): string {
    const childrenField = props.type[prop]!;
    if (typeof childrenField === 'string') {
        return `\t${toCamelCase(prop)}: string`;
    }
    const xmlSchemaType = extractXmlSchemaType(childrenField.type as string);
    const childrenType = XML_SCHEMA_TYPES[xmlSchemaType] ?? 'string';
    // props[prop] puede tener maxOccurs/minOccurs si existe directamente en props
    const propConfig = props[prop] || childrenField;
    const modifier = getTypeModifier(propConfig);
    
    return `\t${toCamelCase(prop)}: ${childrenType}${modifier}`;
}

/**
 * Filtra propiedades vรกlidas para una interfaz TypeScript
 */
function isValidInterfaceProperty(prop: string, props: Record<string, any>): boolean {
    if (prop.includes('$')) return false;
    if (prop === 'minOccurs' || prop === 'maxOccurs') return false;
    if (prop === NAMESPACE_KEY) return false;
    if (/^[0-9]*$/.test(prop)) return false;
    // En el cรณdigo original se accede a props[prop]
    // Esta condiciรณn filtra propiedades cuyo tipo es un string simple de XML Schema
    // Solo aplica cuando la propiedad estรก directamente en el nivel superior (no dentro de type)
    // Dentro de interfaces complejas (cuando accedemos a props.type[prop]), estas propiedades Sร� deben incluirse
    const propDef = props[prop];
    if (propDef && typeof propDef.type === 'string' && propDef.type.includes(XML_SCHEMA_URI) && !props.type) {
        return false;
    }
    
    return true;
}



/**
 * Extrae el prefijo de namespace de una URI
 * Optimizado: usa memoizaciรณn para evitar recalcular el mismo namespace
 */
function extractNamespacePrefix(namespace: string): string {
    if (namespacePrefixCache.has(namespace)) {
        return namespacePrefixCache.get(namespace)!;
    }
    
    const hasSlash = namespace.indexOf('/') !== -1;
    let namespaceLastPart: string;
    
    if (hasSlash) {
        const parts = cachedSplit(namespace, '/');
        namespaceLastPart = parts[parts.length - 1]!;
    } else {
        namespaceLastPart = namespace;
    }
    
    const prefix = namespaceLastPart.slice(0, 3).toLowerCase();
    namespacePrefixCache.set(namespace, prefix);
    
    return prefix;
}


/**
 * Interfaz para los mappings combinados de namespace
 */
export interface CombinedNamespaceMappings {
    tagsMapping: NamespaceTagsMapping;
    prefixesMapping: NamespacePrefixesMapping;
    typesMapping: NamespaceTypesMapping;
}

/**
 * Extrae todos los mappings de namespace en una sola pasada sobre los datos
 * Optimización: combina las tres extracciones (tags, prefixes, types) en una sola iteración
 */
export function extractAllNamespaceMappings(
    baseTypeName: string,
    baseTypeObject: TypeObject
): CombinedNamespaceMappings {
    const tagsMapping: NamespaceTagsMapping = {};
    const prefixesMapping: NamespacePrefixesMapping = {};
    const typesMapping: NamespaceTypesMapping = {};
    
    const baseNamespace = baseTypeObject[NAMESPACE_KEY]!;
    const baseNamespacePrefix = extractNamespacePrefix(baseNamespace);
    
    // Inicializar mappings base
    tagsMapping[baseNamespacePrefix] = [baseTypeName];
    prefixesMapping[baseNamespacePrefix] = baseNamespace;
    typesMapping[baseTypeName] = {
        uri: baseNamespace,
        prefix: baseNamespacePrefix,
    };
    
    const keys = getFilteredKeys(baseTypeObject);
    
    // Función auxiliar recursiva para extraer tags anidados
    const extractNestedTags = (typeObject: TypeObject): string[] => {
        const result: string[] = [];
        const nestedKeys = getFilteredKeys(typeObject);
        
        for (const nestedKey of nestedKeys) {
            const nestedElement = typeObject[nestedKey]!;
            if (typeof nestedElement === 'object' && nestedElement !== null && typeof nestedElement.type === 'object') {
                const nestedTags = extractNestedTags(nestedElement.type as TypeObject);
                result.push(...nestedTags);
            } else {
                result.push(nestedKey);
            }
        }
        
        return result;
    };
    
    // Función auxiliar recursiva para aplanar claves con información de namespace
    const flattenKeys = (
        typeObject: TypeObject,
        currentNamespace: string,
        currentNamespacePrefix: string
    ): Array<{ name: string; uri: string; prefix: string }> => {
        const result: Array<{ name: string; uri: string; prefix: string }> = [];
        const objKeys = getFilteredKeys(typeObject);
        
        for (const objKey of objKeys) {
            const objElement = typeObject[objKey]!;
            
            if (typeof objElement === 'object' && objElement !== null && typeof objElement.type === 'object') {
                const objNamespace = (objElement.type as TypeObject)[NAMESPACE_KEY]!;
                const objNamespacePrefix = extractNamespacePrefix(objNamespace);
                
                const nested = flattenKeys(objElement.type as TypeObject, objNamespace, objNamespacePrefix);
                result.push(...nested);
                
                result.push({
                    name: objKey,
                    uri: objNamespace,
                    prefix: objNamespacePrefix,
                });
            } else {
                result.push({
                    name: objKey,
                    uri: currentNamespace,
                    prefix: currentNamespacePrefix,
                });
            }
        }
        
        return result;
    };
    
    // Una sola iteración sobre las claves principales
    for (const key of keys) {
        const element = baseTypeObject[key]!;
        let namespace = key;
        const tagNames = [key];
        
        if (typeof element === 'object' && element !== null && typeof element.type === 'object') {
            namespace = (element.type as TypeObject)[NAMESPACE_KEY]!;
            const nestedTags = extractNestedTags(element.type as TypeObject);
            tagNames.push(...nestedTags);
        }
        
        const namespacePrefix = extractNamespacePrefix(namespace);
        
        // Actualizar tagsMapping
        if (tagsMapping[namespacePrefix] === undefined) {
            tagsMapping[namespacePrefix] = tagNames;
        } else {
            tagsMapping[namespacePrefix]!.push(...tagNames);
        }
        
        // Actualizar prefixesMapping
        if (prefixesMapping[namespacePrefix] === undefined) {
            prefixesMapping[namespacePrefix] = namespace;
        }
    }
    
    // Construir typesMapping usando flattenKeys
    const flatKeys = flattenKeys(baseTypeObject, baseNamespace, baseNamespacePrefix);
    for (const item of flatKeys) {
        typesMapping[item.name] = {
            uri: item.uri,
            prefix: item.prefix,
        };
    }
    
    return {
        tagsMapping,
        prefixesMapping,
        typesMapping,
    };
}

/**
 * Genera el cรณdigo de declaraciones de namespaces
 */
/**
 * Obtiene el prefijo de namespace para un elemento
 */
function getNamespacePrefix(namespacesTypeMapping: NamespaceTypesMapping, baseNamespacePrefix: string, key: string, parentKey: string | null): string {
    if (parentKey !== null) {
        return namespacesTypeMapping[parentKey]?.prefix ?? baseNamespacePrefix;
    }
    return namespacesTypeMapping[key]?.prefix ?? baseNamespacePrefix;
}

/**
 * Genera el cรณdigo del template de una propiedad del cuerpo XML
 */
function generateXmlPropertyCode(
    namespacesTypeMapping: NamespaceTypesMapping,
    baseNamespacePrefix: string,
    key: string,
    elementObject: TypeDefinition,
    parentKey: string | null = null
): string {
    const namespacePrefix = getNamespacePrefix(
        namespacesTypeMapping,
        baseNamespacePrefix,
        key,
        parentKey
    );
    
    if (typeof elementObject === 'object' && elementObject !== null && typeof elementObject.type === 'object') {
        const keys = getFilteredKeys(elementObject.type as TypeObject);
        const nestedProperties = keys
            .map(elementKey => {
                const nestedElement = (elementObject.type as TypeObject)[elementKey]!;
                if (typeof nestedElement === 'object' && nestedElement !== null) {
                    return generateXmlPropertyCode(
                        namespacesTypeMapping,
                        baseNamespacePrefix,
                        elementKey,
                        nestedElement as TypeDefinition,
                        key
                    );
                }
                return '';
            })
            .filter(Boolean)
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
 * Genera el cรณdigo del cuerpo XML principal
 */
export function generateXmlBodyCode(baseNamespacePrefix: string, namespacesTypeMapping: NamespaceTypesMapping, baseTypeName: string, baseTypeObject: TypeObject): string {
    const keys = getFilteredKeys(baseTypeObject);
    const properties = keys
        .map(key => {
            const element = baseTypeObject[key]!;
            if (typeof element === 'object' && element !== null) {
                return generateXmlPropertyCode(
                    namespacesTypeMapping,
                    baseNamespacePrefix,
                    key,
                    element as TypeDefinition
                );
            }
            return '';
        })
        .filter(Boolean)
        .join('\n');
    
    return `<${baseNamespacePrefix}.${baseTypeName}>
    ${properties}
</${baseNamespacePrefix}.${baseTypeName}>`;
}

// ============================================================================
// Funciones para preparar datos estructurados para Handlebars
// ============================================================================

export interface SimpleTypeData {
    name: string;
    tsType: string;
}

export interface InterfacePropertyData {
    name: string;
    type: string;
    modifier: string;
}

export interface InterfaceData {
    name: string;
    properties: InterfacePropertyData[];
}

export interface PropsInterfaceData {
    name: string;
    properties: Array<{ name: string; modifier?: string }>;
}

export interface TemplateData {
    requestType: string;
    namespaces: Record<string, string[]>;
    simpleTypes: SimpleTypeData[];
    propsInterface: PropsInterfaceData;
    interfaces: InterfaceData[];
    soapNamespaceURI: string;
    xmlnsAttributes: Record<string, string>;
    xmlBody: string;
}

/**
 * Prepara datos de tipos simples para el template
 */
export function prepareSimpleTypesData(requestTypeObject: TypeObject, xmlSchemaUri: string): SimpleTypeData[] {
    return Object.keys(requestTypeObject)
        .filter(key => {
            const typeDef = requestTypeObject[key]!;
            return typeof typeDef === 'object' && typeDef !== null && typeof typeDef.type === 'string' && typeDef.type.includes(xmlSchemaUri);
        })
        .map(key => {
            const typeDef = requestTypeObject[key]!;
            if (typeof typeDef === 'object' && typeDef !== null && typeof typeDef.type === 'string') {
                const parts = cachedSplit(typeDef.type, ':');
                const xmlSchemaTypeName = parts[parts.length - 1]!;
                const tsType = XML_SCHEMA_TYPES[xmlSchemaTypeName];
                return {
                    name: key,
                    tsType: tsType,
                };
            }
            return {
                name: key,
                tsType: 'string',
            };
        });
}

/**
 * Prepara datos de la interfaz de props para el template
 */
export function preparePropsInterfaceData(typeName: string, typeObject: TypeObject): PropsInterfaceData {
    const keys = getFilteredKeys(typeObject);
    const properties = keys.map(key => ({
        name: key,
    }));
    
    return {
        name: typeName,
        properties,
    };
}

/**
 * Prepara datos de una interfaz TypeScript para el template
 */
export function prepareInterfaceData(interfaceName: string, interfaceDefinition: { type: TypeObject } & Record<string, any>): InterfaceData {
    const keys = Object.keys(interfaceDefinition.type);
    const properties = keys
        .filter(prop => isValidInterfaceProperty(prop, interfaceDefinition))
        .map(prop => {
            const childrenField = interfaceDefinition.type[prop]!;
            if (typeof childrenField === 'string') {
                return {
                    name: prop,
                    type: 'string',
                    modifier: '',
                };
            }
            const xmlSchemaType = extractXmlSchemaType(childrenField.type as string);
            const childrenType = XML_SCHEMA_TYPES[xmlSchemaType] ?? 'string';
            const propConfig = interfaceDefinition[prop] || childrenField;
            const modifier = getTypeModifier(propConfig);
            
            return {
                name: prop,
                type: childrenType,
                modifier,
            };
        });
    
    return {
        name: interfaceName,
        properties,
    };
}

/**
 * Prepara datos de todas las interfaces complejas para el template
 */
export function prepareInterfacesData(requestTypeObject: TypeObject, namespaceKey: string, xmlSchemaUri: string): InterfaceData[] {
    return Object.keys(requestTypeObject)
        .filter(key => {
            if (key === namespaceKey) return false;
            const typeDef = requestTypeObject[key]!;
            if (typeof typeDef === 'object' && typeDef !== null && typeof typeDef.type === 'string') {
                return !typeDef.type.includes(xmlSchemaUri);
            }
            return true;
        })
        .map(key => prepareInterfaceData(key, requestTypeObject[key] as any));
}

/**
 * Prepara todos los datos para el template Handlebars
 */
export function prepareTemplateData(
    requestType: string,
    requestTypeObject: TypeObject,
    namespacesTagsMapping: NamespaceTagsMapping,
    namespacesPrefixMapping: NamespacePrefixesMapping,
    namespacesTypeMapping: NamespaceTypesMapping,
    soapNamespaceURI: string,
    baseNamespacePrefix: string
): TemplateData {
    const simpleTypes = prepareSimpleTypesData(requestTypeObject, XML_SCHEMA_URI);
    const propsInterface = preparePropsInterfaceData(requestType, requestTypeObject);
    const interfaces = prepareInterfacesData(requestTypeObject, NAMESPACE_KEY, XML_SCHEMA_URI);
    const xmlBody = generateXmlBodyCode(baseNamespacePrefix, namespacesTypeMapping, requestType, requestTypeObject);
    
    return {
        requestType,
        namespaces: namespacesTagsMapping,
        simpleTypes,
        propsInterface,
        interfaces,
        soapNamespaceURI,
        xmlnsAttributes: namespacesPrefixMapping,
        xmlBody,
    };
}
