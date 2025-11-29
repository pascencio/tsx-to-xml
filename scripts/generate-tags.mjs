#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { XMLParser } from "fast-xml-parser";

const XSD_PATH = process.argv[2];
const FILE_NAME = process.argv[3];
const OUT_DIR = path.dirname(FILE_NAME);

if (!XSD_PATH) {
  console.error("❌ Missing WSDL/XSD path.");
  console.error("Usage: node scripts/generate-tags.mjs file.wsdl out-dir");
  process.exit(1);
}

console.log("📂 Reading:", XSD_PATH);

// FAST XML PARSER
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  removeNSPrefix: false,
});

// LOAD FILE
function loadXML(filePath) {
  const xml = fs.readFileSync(filePath, "utf8");
  return parser.parse(xml);
}

/* -------------------------------------
   HELPERS
------------------------------------- */

function findSchemas(node) {
  let result = [];

  if (!node || typeof node !== "object") return result;

  // detect <prefix:schema>
  for (const key of Object.keys(node)) {
    const [, local] = key.split(":");
    if (local === "schema") {
      const value = node[key];
      result = result.concat(Array.isArray(value) ? value : [value]);
    }
  }

  // recurse
  for (const key of Object.keys(node)) {
    result = result.concat(findSchemas(node[key]));
  }

  return result;
}

function findImports(node) {
  let result = [];

  if (!node || typeof node !== "object") return result;

  // detect <prefix:import>
  for (const key of Object.keys(node)) {
    const [, local] = key.split(":");
    if (local === "import") {
      const val = node[key];
      if (Array.isArray(val)) result = result.concat(val);
      else result.push(val);
    }
  }

  // recurse
  for (const key of Object.keys(node)) {
    result = result.concat(findImports(node[key]));
  }

  return result;
}

function findElements(node) {
  let result = [];

  if (!node || typeof node !== "object") return result;

  for (const key of Object.keys(node)) {
    const [, local] = key.split(":");
    if (local === "element") {
      const el = node[key];

      if (Array.isArray(el)) {
        for (const e of el) if (e?.name) result.push(e.name);
      } else if (el?.name) {
        result.push(el.name);
      }
    }
  }

  // recurse
  for (const key of Object.keys(node)) {
    result = result.concat(findElements(node[key]));
  }

  return result;
}

/* -------------------------------------
   IMPORT RESOLUTION ENGINE
------------------------------------- */

const loadedFiles = new Set();

function loadSchemaRecursive(filePath, accumulated = []) {
  const absPath = path.resolve(filePath);

  if (loadedFiles.has(absPath)) return [];
  loadedFiles.add(absPath);

  console.log("📄 Loading:", absPath);

  const doc = loadXML(absPath);
  const schemas = findSchemas(doc);
  accumulated.push(...schemas);

  // find imports
  const imports = findImports(doc);

  for (const imp of imports) {
    const loc = imp.schemaLocation;
    if (!loc) continue;

    const childPath = path.resolve(path.dirname(absPath), loc);
    loadSchemaRecursive(childPath, accumulated);
  }

  return accumulated;
}

/* -------------------------------------
   MAIN LOGIC
------------------------------------- */

const allSchemas = loadSchemaRecursive(XSD_PATH);

console.log(`🔍 Total schemas loaded (including imports):`, allSchemas.length);

if (allSchemas.length === 0) {
  console.error("❌ No schemas found.");
  process.exit(1);
}

const namespaces = new Map();

for (const schema of allSchemas) {
  const ns = schema.targetNamespace ?? "";
  if (!namespaces.has(ns)) namespaces.set(ns, new Set());

  const set = namespaces.get(ns);
  const elements = findElements(schema);

  elements.forEach((e) => set.add(e));
}

fs.mkdirSync(OUT_DIR, { recursive: true });

let nsIndex = 0;

for (const [ns, set] of namespaces.entries()) {
  const prefix = `ns${nsIndex}`;
  const tagsConstName = `${prefix}Tags`;

  const tags = Array.from(set).sort();

  console.log(`📦 Namespace: ${ns}`);
  console.log(`📌 ${tags.length} tags:`, tags);

  const outFile = `${FILE_NAME.replace(".ts", "")}_${prefix}.ts`;

  const output = `
// AUTO-GENERATED — DO NOT EDIT
// targetNamespace: ${ns}

import { ns } from "@xml-runtime/ns";

export const ${tagsConstName} = ${JSON.stringify(tags, null, 2)} as const;

export type ${prefix}Tag = typeof ${tagsConstName}[number];

export const ${prefix}_prefix = "${prefix}";
export const ${prefix} = ns(${prefix}_prefix, ${tagsConstName});
`;

  fs.writeFileSync(outFile, output);
  console.log(`💾 Written: ${outFile}`);
  nsIndex++;
}

console.log("🎉 DONE — schemas + imports resolved.");
