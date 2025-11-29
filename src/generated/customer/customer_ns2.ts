
// AUTO-GENERATED — DO NOT EDIT
// targetNamespace: http://example.com/schema/common

import { ns } from "@xml-runtime/ns";

export const ns2Tags = [
  "AuthHeader",
  "Password",
  "Username"
] as const;

export type ns2Tag = typeof ns2Tags[number];

export const ns2_prefix = "ns2";
export const ns2 = ns(ns2_prefix, ns2Tags);
