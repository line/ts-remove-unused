# ts-remove-unused

> Remove unused code from your TypeScript project

## Introduction

When you enable `compilerOptions.noUnusedLocals` for your TypeScript project, it's possible to detect declarations that are not referenced in your file.

```typescript
// TypeScript will throw error: 'a' is declared but its value is never read.
const a = 'a';
```

However when this declaration is exported and is not referenced by any file in the project, it's difficult to recognize this.

```typescript
// no errors will be reported even if the declaration is not used across the entire project.
export const a = 'a';
```

This is when ts-remove-unused comes in handy. ts-remove-unused is a CLI tools made on top of TypeScript that reports/fixes unused exports.

Let's say you have the following file:

```typescript
export const a = 'a';

export const b = 'b';

export const c = 'c';

console.log(b);
```

When `a` and `b` are not used in all other files across the project, ts-remove-unused will modify the file to be:

```typescript
const b = 'b';

export const c = 'c';

console.log(b);
```

If you have another file in your project:

```typescript
export const d = 'd';

export const e = 'e';
```

When `d` and `e` are not used in all other files across the project, ts-remove-unused will delete the file for you.

Now you don't have to worry about removing your unused code!

## Install

```bash
npm i typescript ## TypeScript is a peer dependency
npm i -D @line/ts-remove-unused
```

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

The CLI will respect the `tsconfig.json` for loading source files.

Here's an example of using the cli.

```
npx ts-remove-unused --skip 'src\/index\.ts'
```

### Check

Use `--check` to check for unused files and exports without making changes to project files. The command will exit with
code: 1 if there are any unused files or exports discovered.

```
npx ts-remove-unused --check
```

### Use the JavaScript API

Alternatively, you can use the JavaScript API to execute ts-remove-unused.

```typescript
import { remove } from '@line/ts-remove-unused';

remove({
  configPath: '/path/to/project/tsconfig.json',
  projectRoot: '/path/to/project',
  skip: [/main.ts/],
  mode: 'write',
});
```

### Skip removing unused exports

When you add a comment `// ts-remove-unused-skip` to your export declaration, the CLI will skip it from being removed

```ts
// ts-remove-unused-skip
export const hello = 'world';
```

By default, .d.ts files are skipped. If you want to include .d.ts files, use the --include-d-ts option.

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
