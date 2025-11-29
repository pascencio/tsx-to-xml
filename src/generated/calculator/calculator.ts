
// AUTO-GENERATED — DO NOT EDIT
// targetNamespace: http://tempuri.org/

import { ns } from "../xml-runtime/ns";

export const ORG_TAGS = [
  "Add",
  "AddResponse",
  "AddResult",
  "Divide",
  "DivideResponse",
  "DivideResult",
  "Multiply",
  "MultiplyResponse",
  "MultiplyResult",
  "Subtract",
  "SubtractResponse",
  "SubtractResult",
  "intA",
  "intB"
] as const;

export type orgTag = typeof ORG_TAGS[number];

export const org_prefix = "org";
export const org = ns("org", ORG_TAGS);
