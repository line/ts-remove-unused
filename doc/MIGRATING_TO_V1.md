# Migrating to v1

This document will cover the migration process from v0 to v1.

## `@line/ts-remove-unused` is renamed to `tsr`

The unnecessary parts from the name `@line/ts-remove-unused` is removed, renaming the tool to `tsr` 😉

```
npm i tsr
```

## `--check` is the default behavior

In v0, the default behavior of the CLI was to apply the edits. This was reasonable because the command was long `npx @line/ts-remove-unused`. `--check` will be the default behavior, and the editing feature will be provided with `--write` in order to prevent accidental code edits when executing `npx tsx`.

```bash
npx tsr --write 'src/main\.ts$' ## use --write to edit files
```

## `--skip` is removed with variadic arguments

The `--skip` option has been removed with variadic arguments to simplify the command line interface.

```bash
npx @line/ts-remove-unused --skip 'src/main\.ts$' ## v0
npx tsx 'src/main\.ts$' ## v1
```

## JavaScript API has changed

The name has changed.

```typescript
import { remove } from '@line/ts-remove-unused'; // before
import { tsr } from 'tsr'; // after
```

Checkout `import('tsr').Config` for more available options.
