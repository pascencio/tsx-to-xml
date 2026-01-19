import {
    loadXml,
    getSchemaNode,
    getTypesNode,
    getDefinitionsNode,
    getNamespacesFromNode,
    complexTypesFromSchema,
    schemaToObject,
    getRequestTypeFromDefinitions,
} from "./wsdl.js";
import {
    extractAllNamespaceMappings,
    prepareTemplateData,
} from "./template.js";
import { registerHandlebarsHelpers } from "./template-helpers.js";
import Handlebars, { type TemplateDelegate } from "handlebars";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cache para el template compilado y su contenido
let compiledTemplate: TemplateDelegate | null = null;
let templateSource: string | null = null;

const SOAP12_ENVELOPE_URI = 'http://www.w3.org/2003/05/soap-envelope';
const SOAP11_ENVELOPE_URI = 'http://schemas.xmlsoap.org/soap/envelope/';

interface RequestTypeObject {
    [key: string]: {
        type: string | any;
        maxOccurs?: string;
        minOccurs?: string;
    };
    $namespace?: string;
}

/**
 * Determina la URI del namespace SOAP basado en las definiciones del WSDL
 */
function getSoapNamespaceURI(definitionsNamespaces: Map<string, string>): string {
    const soapEntry = Array.from(definitionsNamespaces.entries())
        .find(entry => entry[1].includes('soap'));
    
    if (!soapEntry) {
        return SOAP11_ENVELOPE_URI;
    }
    
    const lastPart = soapEntry[1].split('/').slice(-1)[0]!;
    return lastPart === 'soap12' 
        ? SOAP12_ENVELOPE_URI 
        : SOAP11_ENVELOPE_URI;
}

/**
 * Compila el template Handlebars y genera el código del componente
 */
function compileTemplate(templateData: any): string {
    // Registrar helpers de Handlebars (solo una vez)
    registerHandlebarsHelpers();
    
    // Cachear el template compilado y su contenido
    if (!compiledTemplate || !templateSource) {
        const templatePath = path.join(__dirname, 'templates', 'component.hbs');
        templateSource = fs.readFileSync(templatePath, 'utf-8');
        compiledTemplate = Handlebars.compile(templateSource);
    }
    
    // Compilar el template con los datos
    return compiledTemplate(templateData);
}

/**
 * Función principal que genera el archivo TSX desde un WSDL
 */
async function generateTsxFromWsdl(wsdlPath: string, outDir: string): Promise<void> {
    const wsdlRoot = await loadXml(wsdlPath);
    const definitionsNode = getDefinitionsNode(wsdlRoot);
    if (!definitionsNode) {
        throw new Error('No se encontró el nodo definitions en el WSDL');
    }
    const typeNode = getTypesNode(definitionsNode);
    if (!typeNode) {
        throw new Error('No se encontró el nodo types en el WSDL');
    }
    const schemaNode = getSchemaNode(typeNode);
    
    if (schemaNode === undefined) {
        throw new Error('No se encontró el nodo schema en el WSDL');
    }
    
    const definitionsNamespaces = getNamespacesFromNode(definitionsNode);
    const soapNamespaceURI = getSoapNamespaceURI(definitionsNamespaces);
    const schemaNamespaces = getNamespacesFromNode(schemaNode);
    const namespaces = new Map([...definitionsNamespaces, ...schemaNamespaces]);
    
    const complexTypes = await complexTypesFromSchema(wsdlPath, schemaNode, namespaces);
    const schemaObject = schemaToObject(schemaNode, namespaces, complexTypes);
    const requestType = getRequestTypeFromDefinitions(definitionsNode, schemaObject);
    const requestTypeObject = schemaObject[requestType] as any;
    
    // Extraer todos los mappings de namespace en una sola pasada (optimización)
    const namespaceMappings = extractAllNamespaceMappings(requestType, requestTypeObject);
    const namespacesTagsMapping = namespaceMappings.tagsMapping;
    const namespacesPrefixMapping = namespaceMappings.prefixesMapping;
    const namespacesTypeMapping = namespaceMappings.typesMapping;
    const baseNamespacePrefix = namespacesTypeMapping[requestType]!.prefix;
    
    // Preparar datos estructurados para el template Handlebars
    const templateData = prepareTemplateData(
        requestType,
        requestTypeObject,
        namespacesTagsMapping,
        namespacesPrefixMapping,
        namespacesTypeMapping,
        soapNamespaceURI,
        baseNamespacePrefix
    );
    
    // Compilar el template y generar el código
    const generatedCode = compileTemplate(templateData);
    
    const outputPath = `${outDir}/${requestType}.tsx`;
    fs.writeFileSync(outputPath, generatedCode);
    console.log(`Archivo ${requestType}.tsx generado correctamente en ${outDir}`);
}

// Ejecución principal
const WSDL_PATH = process.argv[2];
const OUT_DIR = process.argv[3];

if (!WSDL_PATH || !OUT_DIR) {
    console.error('Uso: tsx cli/generate-tsx.ts <ruta-wsdl> <directorio-salida>');
    process.exit(1);
}

generateTsxFromWsdl(WSDL_PATH, OUT_DIR)
    .catch(error => {
        console.error('Error al generar TSX:', error);
        process.exit(1);
    });
