import {nodeResolve} from "@rollup/plugin-node-resolve"
export default {
  input: "./build-cm-editor.js",
  output: {
    file: "./parrot-cm.bundle.js",
    format: "iife"
  },
  plugins: [nodeResolve()]
}