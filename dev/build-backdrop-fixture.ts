import { build } from "vite"
import solid from "vite-plugin-solid"

await build({
  configFile: false,
  plugins: [solid()],
  build: {
    outDir: "dev/out/backdrop",
    lib: { entry: "dev/backdrop-fixture.tsx", formats: ["iife"], name: "BackdropFixture", fileName: () => "fixture.js" },
  },
})
await Bun.write("dev/out/backdrop/index.html", '<!doctype html><html><body><div id="root"></div><script src="fixture.js"></script></body></html>')
