
// AUTO-GENERATED — DO NOT EDIT
// targetNamespace: http://example.com/schema/common

import { ns } from "@xml-runtime/ns";

export const COMMON_TAGS = [
  "AuthHeader",
  "Password",
  "Username"
] as const;

export type commonTag = typeof COMMON_TAGS[number];

export const common_prefix = "common";
export const common = ns(common_prefix, COMMON_TAGS);
