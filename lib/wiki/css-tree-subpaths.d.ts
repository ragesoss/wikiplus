// Ambient types for css-tree's lexer-free subpath entries. `scopeArticleCss` imports
// `parse`/`generate`/`walk` from these subpaths instead of the `css-tree` main entry,
// because the main entry constructs its default syntax WITH the lexer config at module
// init, which pulls ~0.8 MB of `mdn-data` into the bundle. The subpaths ship only the
// parser/generator/walker — no lexer, no `mdn-data`. `@types/css-tree` types only the
// main module, so these map the subpath default exports onto the main module's types.

declare module "css-tree/parser" {
  import type { parse } from "css-tree";
  const parser: typeof parse;
  export default parser;
}

declare module "css-tree/generator" {
  import type { generate } from "css-tree";
  const generator: typeof generate;
  export default generator;
}

declare module "css-tree/walker" {
  import type { walk } from "css-tree";
  const walker: typeof walk;
  export default walker;
}
