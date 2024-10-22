if [ ! -d "taxonomy" ]; then
  git clone --depth=1 git@github.com:shadcn-ui/taxonomy.git taxonomy
  cd taxonomy
  npm install --ignore-scripts --force
  npx contentlayer build
else
  cd taxonomy
fi

hyperfine --warmup 3 --runs 5 -i "npx @line/ts-remove-unused --skip 'app' --skip 'pages' --skip '\.contentlayer' --check"
