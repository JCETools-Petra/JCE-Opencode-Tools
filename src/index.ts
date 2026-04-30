#!/usr/bin/env bun

import { Command } from "commander";
import { validateCommand } from "./commands/validate.js";
import { useCommand } from "./commands/use.js";
import { doctorCommand } from "./commands/doctor.js";
import { uninstallCommand } from "./commands/uninstall.js";

const program = new Command();

program
  .name("opencode-suite")
  .description("OpenCode Suite — CLI management tool")
  .version("1.1.0");

program.addCommand(validateCommand);
program.addCommand(useCommand);
program.addCommand(doctorCommand);
program.addCommand(uninstallCommand);

program.parse(process.argv);
