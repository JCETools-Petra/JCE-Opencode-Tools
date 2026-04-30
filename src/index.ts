#!/usr/bin/env bun

import { Command } from "commander";
import { validateCommand } from "./commands/validate.js";
import { useCommand } from "./commands/use.js";
import { doctorCommand } from "./commands/doctor.js";
import { uninstallCommand } from "./commands/uninstall.js";
import { updateCommand } from "./commands/update.js";
import { setupCommand } from "./commands/setup.js";
import { routeCommand } from "./commands/route.js";

const program = new Command();

program
  .name("opencode-suite")
  .description("OpenCode Suite — CLI management tool")
  .version("1.1.0");

program.addCommand(validateCommand);
program.addCommand(useCommand);
program.addCommand(doctorCommand);
program.addCommand(uninstallCommand);
program.addCommand(updateCommand);
program.addCommand(setupCommand);
program.addCommand(routeCommand);

program.parse(process.argv);
