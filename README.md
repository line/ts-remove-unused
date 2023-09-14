# ts-remove-unused

> Remove unused code from your TypeScript project

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
  -h, --help               Display this message
  -v, --version            Display version number

```

The CLI will respect the `tsconfig.json` for loading source files.

Here's an example of using the cli.

```
ts-remove-unused --skip 'src\/index\.ts'
```

### Skip removing unused exports

When you add a comment `// ts-remove-unused-skip` to your export declaration, the CLI will skip it from being removed

```ts
// ts-remove-unused-skip
export const hello = 'world';
```

## Known Issue

Since this CLI uses TypeScript's transformer API, it can't preserve the original format of the file. Although most of the format change can be restored using linters like prettier, empty lines will be omitted. Here's a workaround for this issue using git.

```bash
npx ts-remove-unused ## execute the cli
npx prettier --write . ## fix the format
git commit ## commit first
git checkout HEAD~1 -- . && git diff HEAD~1 HEAD --ignore-blank-lines | git apply && git reset ## this will try to restore irrelevant changes of empty lines caused by the first commit
```

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
