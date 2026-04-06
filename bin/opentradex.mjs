#!/usr/bin/env node
import { runCli } from "../src/cli.mjs";

await runCli(process.argv.slice(2));
