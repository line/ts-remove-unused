if [ ! -d "excalidraw" ]; then
  git clone --depth=1 -b v0.17.3 git@github.com:excalidraw/excalidraw.git excalidraw
  cd excalidraw
else
  cd excalidraw
fi

npx @line/ts-remove-unused --version
hyperfine --warmup 3 --runs 5 -i "npx @line/ts-remove-unused --skip 'excalidraw-app/index\.tsx' --check"
