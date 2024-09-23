<h1 align="center">ts-remove-unused</h1>
<div align="center">
  <img width="480" src="./media/screenshot.png" />
  <p>Remove unused code from your TypeScript Project</p>
</div>

[![npm version](https://badge.fury.io/js/@line%2Fts-remove-unused.svg)](https://badge.fury.io/js/@line%2Fts-remove-unused)
[![CI](https://github.com/line/ts-remove-unused/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/line/ts-remove-unused/actions/workflows/ci.yml)

## Features

- 🛠️ Auto-fix unused exports — removes the `export` keyword from the declaration or the whole declaration based on its usage
- 🧹 Deletes TypeScript modules that have no referenced exports
- 🕵️ `--check` mode — reports unused exports and deletable files without writing changes

## Introduction

When TypeScript's `compilerOptions.noUnusedLocals` is enabled, it's possible to detect declarations that are not referenced in your file.

```typescript
// TypeScript will throw error: 'a' is declared but its value is never read.
const a = 'a';
```

However when this declaration is exported and is not referenced by any file in the project, it's difficult to recognize this.

```typescript
// no errors will be reported even if the declaration is not used across the entire project.
export const a = 'a';
```

This is when ts-remove-unused comes in handy. ts-remove-unused is a CLI tool built on top of TypeScript that finds unused exports and auto-fixes unused code.

Here are some examples of how ts-remove-unused auto-fixes unused code.

<!-- prettier-ignore-start -->

When `a2` is not used within the project:

```diff
--- src/a.ts
+++ src/a.ts
@@ -1,3 +1 @@
 export const a = 'a';
-
-export const a2 = 'a2';
```

When `b` is not used within the project but `f()` is used within the project:

```diff
--- src/b.ts
+++ src/b.ts
@@ -1,5 +1,5 @@
-export const b = 'b';
+const b = 'b';
 
 export function f() {
     return b;
 }
```

When `f()` is not used within the project and when deleting it will result in `import` being unnecessary:

```diff
--- src/c.ts
+++ src/c.ts
@@ -1,7 +1 @@
-import { cwd } from "node:process";
-
 export const c = 'c';
-
-export function f() {
-    return cwd();
-}
```

When `f()` and `exported` are not used within the project and when deleting `f()` will result in `exported` and `local` being unnecessary:

```diff
--- src/d.ts
+++ src/d.ts
@@ -1,8 +1 @@
-export const exported = "exported";
-const local = "local";
-
 export const d = "d";
-
-export function f() {
-  return { exported, local };
-}

```

<!-- prettier-ignore-end -->

In addition to the behavior shown in the examples above, ts-remove-unused will delete files that have no used exports.

ts-remove-unused supports various types of exports including variable declarations (`export const`, `export let`), function declarations, class declarations, interface declarations, type alias declarations, default exports and more...

Now you don't have to worry about removing unused code by yourself!

## Install

```bash
npm install @line/ts-remove-unused
```

TypeScript is a peer dependency so make sure that it's also installed.

## Usage

```
Usage:
  $ ts-remove-unused

Commands:
    There are no subcommands. Simply execute ts-remove-unused

For more info, run any command with the `--help` flag:
  $ ts-remove-unused --help

Options:
  --project <file>         Path to your tsconfig.json
  --skip <regexp_pattern>  Specify the regexp pattern to match files that should be skipped from transforming
  --include-d-ts           Include .d.ts files in target for transformation
  --check                  Check if there are any unused exports without removing them
  -h, --help               Display this message
  -v, --version            Display version number
```

ts-remove-unused's behavior heavily depends on your `tsconfig.json`. TypeScript's compiler internally holds the list of project files by parsing relevant rules such as `include` and `exclude`. ts-remove-unused scans through this list and searches for references to determine if an export/file is "unused". You may need to maintain/update your `tsconfig` (or you can create another file for `--project`) so that the set of covered files are right.

Here's an example of using the CLI. Your entry point file must be skipped or else every file will be removed.

```bash
npx @line/ts-remove-unused --skip 'src/main\.ts'
```

> [!WARNING]
> THIS COMMAND WILL DELETE CODE FROM YOUR PROJECT. Using it in a git controlled environment is highly recommended. If you're just playing around use `--check`.

### Check

Use `--check` to check for unused files and exports without making changes to project files. The command will exit with exit code 1 if there are any unused files or exports discovered.

```bash
npx @line/ts-remove-unused --skip 'src/main\.ts' --check
```

### Use the JavaScript API

Alternatively, you can use the JavaScript API to execute ts-remove-unused.

```typescript
import { remove } from '@line/ts-remove-unused';

remove({
  configPath: '/path/to/project/tsconfig.json',
  projectRoot: '/path/to/project',
  skip: [/main\.ts/],
  mode: 'write',
});
```

### Skip

When you add a comment `// ts-remove-unused-skip` to your export declaration, it will be skipped from being removed

```ts
// ts-remove-unused-skip
export const hello = 'world';
```

The `--skip` option is also available to skip files that match a given regex pattern. Note that you can pass multiple patterns.

```bash
npx @line/ts-remove-unused --skip 'src/main\.ts' --skip '/pages/'
```

By default, `.d.ts` files are skipped. If you want to include `.d.ts` files, use the `--include-d-ts` option.

## How does ts-remove-unused handle test files?

If you have a separate tsconfig for tests using [Project References](https://www.typescriptlang.org/docs/handbook/project-references.html), that would be great! ts-remove-unused will remove exports/files that exist for the sake of testing.

If you pass a `tsconfig.json` to the CLI that includes both the implementation and the test files, ts-remove-unused will remove your test files since they are not referenced by your entry point file (which is specified in `--skip`). You can avoid tests being deleted by passing a pattern that matches your test files to `--skip` in the meantime, but the recommended way is to use project references to ensure your TypeScript config is more robust and strict (not just for using this tool).

## Author

Kazushi Konosu (https://github.com/kazushisan)

## License

```
Copyright (C) 2023 LINE Corp.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

   http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
```
