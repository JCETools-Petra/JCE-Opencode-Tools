import chalk from "chalk";

export function banner(): void {
  console.log(chalk.cyan("╔══════════════════════════════════════════╗"));
  console.log(chalk.cyan("║         OpenCode Suite CLI v1.1.0        ║"));
  console.log(chalk.cyan("╚══════════════════════════════════════════╝"));
  console.log();
}

export function info(msg: string): void {
  console.log(chalk.blue("[INFO]"), msg);
}

export function success(msg: string): void {
  console.log(chalk.green("  ✅"), msg);
}

export function warn(msg: string): void {
  console.log(chalk.yellow("  ⚠️ "), msg);
}

export function error(msg: string): void {
  console.log(chalk.red("  ❌"), msg);
}

export function skip(msg: string): void {
  console.log(chalk.yellow("[SKIP]"), msg);
}

export function heading(msg: string): void {
  console.log();
  console.log(chalk.bold.underline(msg));
}
