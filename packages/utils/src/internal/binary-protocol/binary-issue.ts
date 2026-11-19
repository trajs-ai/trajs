/** The issues a read or a write of one message fails with. */

import { SchemaIssue } from "effect";

/** The issue of bytes or values that state nothing the layout asks for. */
const issue = (message: string): SchemaIssue.Issue => new SchemaIssue.InvalidValue({ message });

/** The issue of bytes that end inside a field. */
export const spanShortfall = (name: string, left: number, states: number): SchemaIssue.Issue =>
  issue(`the bytes hold ${left} of the ${states} bytes of \`${name}\``);

/** The issue of the span of an integer field that is not the width of that field. */
export const integerSpan = (width: number, held: number): SchemaIssue.Issue =>
  issue(`an integer field of ${width} bytes spans ${held}`);

/** The issue of bytes that hold no whole frame. */
export const missingFrame = (name: string): SchemaIssue.Issue =>
  issue(`the bytes hold no whole frame for \`${name}\``);

/** The issue of bytes the fields of a layout state nothing for. */
export const trailingBytes = (count: number): SchemaIssue.Issue =>
  issue(`the bytes hold ${count} more than the fields of the layout`);

/** The issue of a field no value is written for. */
export const missingValue = (name: string): SchemaIssue.Issue =>
  issue(`no value is written for \`${name}\``);

/** The issue of a field whose bytes are not the bytes its own wire states. */
export const fieldSpan = (name: string, held: number, states: number): SchemaIssue.Issue =>
  issue(`\`${name}\` holds ${held} bytes, and its field states ${states}`);

/** The issue of a run of bytes that is not the length the field counting it states. */
export const runSpan = (
  name: string,
  held: number,
  field: string,
  states: number,
): SchemaIssue.Issue => issue(`\`${name}\` holds ${held} bytes, and \`${field}\` states ${states}`);
