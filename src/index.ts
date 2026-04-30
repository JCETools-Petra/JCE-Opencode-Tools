#!/usr/bin/env bun

import { Command } from "commander";
import { validateCommand } from "./commands/validate.js";
import { useCommand } from "./commands/use.js";

const program = new Command();

program
  .name("opencode-suite")
  .description("OpenCode Suite — CLI management tool")
  .version("1.1.0");

program.addCommand(validateCommand);
program.addCommand(useCommand);

program.parse(process.argv);
