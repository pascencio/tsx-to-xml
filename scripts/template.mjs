import { toPascalCase, toCamelCase } from "./util.mjs";

const xmlSchemaTypes = {
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
}

export function createPropsInterfaceTemplate(baseName, baseObject) {
    return `export interface ${toPascalCase(baseName)}Props {
${Object.keys(baseObject)
        .filter(key => key !== '$namespace')
        .map(key => {
            return `\t${toCamelCase(key)}: ${key}`
        })
        .join(',\n')}
}
`
}

export function extractXmlSchemaType(type) {
    return type.split(':')[1]
}

export function createInterfaceTemplateProperty(prop, props) {
    const childrenField = props.type[prop]
    let xmlSchemaType = extractXmlSchemaType(childrenField.type)
    const childrenType = xmlSchemaTypes[xmlSchemaType] ?? 'string'
    return `\t${toCamelCase(prop) + ': ' + childrenType + ((props[prop]?.maxOccurs ?? '1') !== '1' ? `[]` : (props[prop]?.minOccurs ?? '1') !== '1' ? `?` : '')}`
}

export function createTypeTemplate(name, props) {
    return `
export type ${toPascalCase(name)} = ${xmlSchemaTypes[props.type.split(':').slice(-1)[0]]}
`
}

export function createInterfaceTemplate(name, props) {
    return `
export interface ${toPascalCase(name)} {
${Object.keys(props.type)
    .filter(prop => {
        return !prop.includes('$') &&
            prop !== 'minOccurs' &&
            prop !== 'maxOccurs' &&
            prop !== '$namespace' &&
            !prop.match(/^[0-9]*$/) &&
            !(props[prop]?.type && props[prop].includes('http://www.w3.org/2001/XMLSchema'))
    })
    .map(prop => {
    return createInterfaceTemplateProperty(prop, props)
    }).join(',\n')}
}
`
}

export function extractNamespaceObject(baseName,baseObject) {
    const namespacesObject = {}
    const namespacePrefix = extractNamespacePrefix(baseObject["$namespace"])
    namespacesObject[namespacePrefix] = [baseName]
    Object.keys(baseObject)
    .filter(key => key !== '$namespace')
    .forEach((key) => {
        const namespace = typeof baseObject[key]?.type === 'object' ? baseObject[key].type['$namespace'] : key
        const namespacePrefix= extractNamespacePrefix(namespace)
        namespacesObject[namespacePrefix] = namespacesObject[namespacePrefix] === undefined ? [key] : [...namespacesObject[namespacePrefix], key]
    })
    return namespacesObject
}

export function extractNamespacePrefixObject(baseName,baseObject) {
    const namespacesObject = {}
    const namespacePrefix = extractNamespacePrefix(baseObject["$namespace"])
    namespacesObject[namespacePrefix] = baseObject["$namespace"]
    Object.keys(baseObject)
    .filter(key => key !== '$namespace')
    .forEach((key) => {
        const namespace = typeof baseObject[key]?.type === 'object' ? baseObject[key].type['$namespace'] : key
        const namespacePrefix = extractNamespacePrefix(namespace)
        if (namespacesObject[namespacePrefix] === undefined) {
            namespacesObject[namespacePrefix] = namespace
        }
    })
    return namespacesObject
}

export function extractNamespaceTypeObject(baseName,baseObject) {
    const namespacesObject = {}
    const namespacePrefix = extractNamespacePrefix(baseObject["$namespace"])
    namespacesObject[baseName] = {
        uri: baseObject["$namespace"],
        prefix: namespacePrefix,
    }
    Object.keys(baseObject)
    .filter(key => key !== '$namespace' &&
        typeof baseObject[key]?.type === 'object')
    .forEach((key) => {
        const namespace = baseObject[key].type['$namespace']
        const namespacePrefix = extractNamespacePrefix(namespace)
        namespacesObject[key] = {
            uri: namespace,
            prefix: namespacePrefix,
        }
    })
    return namespacesObject
}

export function extractNamespacePrefix(namespace) {
    const namespaceLastPart = namespace.indexOf('/') !== -1 ? namespace.split('/').slice(-1)[0] : namespace
    return namespaceLastPart.slice(0,3).toLowerCase()
}

export function createNamespacesTemplate(namespacesObject) {
    return `${Object.keys(namespacesObject)
        .map(key => {
            return `const ${key} = ns("${key}", ["${namespacesObject[key].join('", "')}"] as const);`
        })
        .join('\n')}`
}