#!/usr/bin/env bun

import { Command } from "commander";

const program = new Command();

program
  .name("opencode-suite")
  .description("OpenCode Suite — CLI management tool")
  .version("1.1.0");

program.parse(process.argv);
