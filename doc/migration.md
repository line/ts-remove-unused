# Migrating from v0 (ts-remove-unused) to v1

This document will cover the migration process from v0 to v1.

## Breaking Changes

### `@line/ts-remove-unused` is renamed to `tsr`

`tsr` is the new name, removing the unnecessary parts from the name `@line/ts-remove-unused` 😉

```
npm i tsr
```

### `--check` is the default behavior

In v0, the default behavior of the CLI was to edit files in place. This was reasonable because the command was long `npx @line/ts-remove-unused`. However, the rename from `@line/ts-remove-unused` to `tsr` will likely increase the risk of accidentally executing the CLI with `npx tsr`. In order to reduce the possibility of this, `--check` will be the new default behavior, and the editing feature will be available with `--write`.

```bash
npx tsr --write 'src/main\.ts$' ## use --write to edit files
```

### `--skip` is replaced with variadic arguments

The `--skip` option has been replaced with variadic arguments to simplify the command line interface.

```bash
npx @line/ts-remove-unused --skip 'src/main\.ts$' ## v0
npx tsr 'src/main\.ts$' ## v1
```

### JavaScript API has changed

The JavaScript API has changed.

```typescript
import { remove } from '@line/ts-remove-unused'; // before
import { tsr } from 'tsr'; // after
```

Checkout `import('tsr').Config` for more available options.
