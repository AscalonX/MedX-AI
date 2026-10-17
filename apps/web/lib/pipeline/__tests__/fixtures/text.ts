import { readFileSync } from 'node:fs';

/**
 * Read a repo text file (markdown spec, prompt block) as BOM-free, LF-only UTF-8.
 * Windows checkouts with core.autocrlf=true hold CRLF in the working tree, which made
 * `$`-anchored table-row regexes match nothing and data-driven suites register 0 rows.
 */
export function readText(file: string | URL): string {
  return readFileSync(file, 'utf8').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
}

/** Lines of a normalised text file (see readText). */
export function readLines(file: string | URL): string[] {
  return readText(file).split('\n');
}
