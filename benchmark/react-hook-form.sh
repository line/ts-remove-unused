if [ ! -d "react-hook-form" ]; then
  git clone --depth=1 -b v7.53.1 git@github.com:react-hook-form/react-hook-form.git react-hook-form 
  cd react-hook-form

  # we need to alter the tsconfig.json to skip test files
  cat > tsconfig.json << EOF
{
  "compilerOptions": {
    "sourceMap": true,
    "module": "es2015",
    "target": "es2018",
    "moduleResolution": "node",
    "outDir": "./dist",
    "jsx": "react",
    "skipLibCheck": true,
    "declaration": true,
    "declarationMap": true,
    "noEmit": true,
    "esModuleInterop": true,
    "lib": ["dom", "dom.iterable", "esnext"],
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"],
  "exclude": [
    "node_modules",
    "app",
    "examples",
    "cypress",
    "src/**/*.test.ts",
    "src/**/*.test.tsx",
    "src/**/*.test-d.ts",
    "src/**/*.test-d.tsx",
    "src/__mocks__",
    "**/*/__typetest__",
  ]
}
EOF
else
  cd react-hook-form
fi

npx @line/ts-remove-unused --version
hyperfine --warmup 3 --runs 5 -i "npx @line/ts-remove-unused --check --skip 'src/index\.ts'"
