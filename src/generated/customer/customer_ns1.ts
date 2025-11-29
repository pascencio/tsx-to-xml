
// AUTO-GENERATED — DO NOT EDIT
// targetNamespace: http://example.com/schema/customer

import { ns } from "@xml-runtime/ns";

export const ns1Tags = [
  "Age",
  "Customer",
  "Email",
  "Id",
  "Name"
] as const;

export type ns1Tag = typeof ns1Tags[number];

export const ns1_prefix = "ns1";
export const ns1 = ns(ns1_prefix, ns1Tags);
