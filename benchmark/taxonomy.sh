rm -rf taxonomy
git clone --depth=1 git@github.com:shadcn-ui/taxonomy.git taxonomy
cd taxonomy
npm install --ignore-scripts --force
npx contentlayer build
hyperfine --runs 5 -i "npx @line/ts-remove-unused --skip 'app' --skip 'pages' --skip '.contentlayer' --check"
