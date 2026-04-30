#!/usr/bin/env bun

import { Command } from "commander";
import { validateCommand } from "./commands/validate.js";

const program = new Command();

program
  .name("opencode-suite")
  .description("OpenCode Suite — CLI management tool")
  .version("1.1.0");

program.addCommand(validateCommand);

program.parse(process.argv);
