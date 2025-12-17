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
        let namespace =  key
        let tagNames = [key]
        if (typeof baseObject[key]?.type === 'object') {
            namespace = baseObject[key].type['$namespace']
            tagNames = [...tagNames, ...extractTagNames(baseObject[key].type)]
        }
        const namespacePrefix= extractNamespacePrefix(namespace)
        if (namespacesObject[namespacePrefix] === undefined) {
            namespacesObject[namespacePrefix] = tagNames
        } else {
            namespacesObject[namespacePrefix] = [...namespacesObject[namespacePrefix], ...tagNames]
        }
    })
    return namespacesObject
}

export function extractTagNames(baseObject) {
    return Object.keys(baseObject)
    .filter(key => key !== '$namespace')
    .reduce((acc, key) => {
        if (typeof baseObject[key]?.type === 'object') {
            return [...acc, ...extractTagNames(baseObject[key].type)]
        }
        return [...acc, key]
    }, [])
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
    const namespace = baseObject["$namespace"]
    const namespacePrefix = extractNamespacePrefix(namespace)
    const flatBaseObjectKeys = flattenBaseObjectKeys(baseObject, namespace, namespacePrefix)
    namespacesObject[baseName] = {
        uri: namespace,
        prefix: namespacePrefix,
    }
    console.log('flatBaseObjectKeys: ', flatBaseObjectKeys)
    flatBaseObjectKeys.forEach(item => {
        namespacesObject[item.name] = {
            uri: item.uri,
            prefix: item.prefix,
        }
    })
    return namespacesObject
}

function flattenBaseObjectKeys(baseObject,currentNamespace,currentNamespacePrefix) {
    return Object.keys(baseObject)
    .filter(key => key !== '$namespace')
    .reduce((acc, key) => {
        if (typeof baseObject[key]?.type === 'object') {
            console.log('baseObject[key].type: ', baseObject[key].type)
            const namespace = baseObject[key].type['$namespace']
            const namespacePrefix = extractNamespacePrefix(namespace)
            return [...acc, ...flattenBaseObjectKeys(baseObject[key].type, namespace, namespacePrefix),
                {
                    name: key,
                    uri: namespace,
                    prefix: namespacePrefix,
                }
            ]
        }
        console.log('key: ', key)
        return [...acc, {
            name: key,
            uri: currentNamespace,
            prefix: currentNamespacePrefix,
        }]
    }, [])
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

export function createXmlBodyTemplate(baseNamespacePrefix, namespacesTypeObject, baseName, baseObject) {
    return `<${baseNamespacePrefix}.${baseName}>
    ${Object.keys(baseObject)
    .filter(key => key !== '$namespace')
    .map(key => {
        return createXmlBodyTemplateProperty(namespacesTypeObject, baseNamespacePrefix, key, baseObject[key])
    }).join('\n')}
</${baseNamespacePrefix}.${baseName}>`
}

export function createXmlBodyTemplateProperty(namespacesTypeObject, baseNamespacePrefix, key, elementObject, parentKey = null) {
let namespacePrefix = null
if (parentKey !== null) {
    namespacePrefix = namespacesTypeObject[parentKey]?.prefix !== undefined ? namespacesTypeObject[parentKey].prefix : baseNamespacePrefix
} else {
    namespacePrefix = namespacesTypeObject[key]?.prefix !== undefined ? namespacesTypeObject[key].prefix : baseNamespacePrefix
}
if (typeof elementObject?.type === 'object') {
    return `<${namespacePrefix}.${key}>
    ${Object.keys(elementObject.type)
        .filter(elementKey => elementKey !== '$namespace')
        .map(elementKey => {
        return createXmlBodyTemplateProperty(namespacesTypeObject, baseNamespacePrefix, elementKey, elementObject.type[elementKey], key)
    }).join('\n')}
    </${namespacePrefix}.${key}>`
}
const propertyName = parentKey !== null ? `${toCamelCase(parentKey)}.${toCamelCase(key)}` : toCamelCase(key)
return `<${namespacePrefix}.${key}>{props.${propertyName}}</${namespacePrefix}.${key}>`
}