if [ ! -d "vue_core" ]; then
  git clone --depth=1 -b v3.5.13 git@github.com:vuejs/core.git vue_core
  cd vue_core
  cat > knip.json << EOF
{
  "$schema": "https://unpkg.com/knip@5/schema.json",
  "entry": [
    "**/src/index.ts",
    "**/src/cli.ts",
    "**/src/runtime.ts",
    "**/src/esm-runtime.ts"
  ],
  "project": ["packages/src/**/*.ts", "packages/global.d.ts"],
  "include": ["files", "exports", "types", "nsExports", "nsTypes"]
}
EOF
  ## we remove the packages-private folder because there's an import that knip can't resolve and it's not necessary for the benchmark
  rm -rf packages-private
  pnpm i -w knip@5.39.2
else
  cd vue_core
fi

npx tsr --version
hyperfine --warmup 3 --runs 5 -i "npx tsr -p tsconfig.build.json '.+/src/.*(index|runtime|cli)\.ts$'" "npx knip"
