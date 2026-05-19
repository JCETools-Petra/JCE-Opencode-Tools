import { Command } from "commander";
import { join } from "path";
import { auditSkills, resolveSkillConflicts } from "../plugin/lib/jce-intelligence.js";
import { heading, info, success, warn } from "../lib/ui.js";

export const skillsCommand = new Command("skills")
  .description("Audit and resolve JCE skill routing")
  .addCommand(new Command("audit")
    .description("Score installed repository skills for routing quality")
    .option("--json", "Print JSON")
    .action((options) => {
      const report = auditSkills(join(process.cwd(), "config", "skills"));
      if (options.json) { console.log(JSON.stringify(report, null, 2)); return; }
      heading("JCE Skill Audit");
      info(`${report.total} skills, average score ${report.averageScore}/100, ${report.errors} errors, ${report.warnings} warnings`);
      for (const result of report.results.slice(0, 15)) {
        const line = `${result.name}: ${result.score}/100`;
        result.score >= 85 ? success(line) : warn(line);
        for (const finding of result.findings.slice(0, 3)) console.log(`      - ${finding.severity}: ${finding.message}`);
      }
    }))
  .addCommand(new Command("resolve")
    .description("Resolve skill conflicts from a comma-separated list")
    .argument("skills", "Comma-separated skill names")
    .option("--max <count>", "Maximum selected skills", "4")
    .option("--json", "Print JSON")
    .action((skillsText, options) => {
      const resolution = resolveSkillConflicts(String(skillsText).split(",").map((s) => s.trim()).filter(Boolean), Number(options.max));
      if (options.json) { console.log(JSON.stringify(resolution, null, 2)); return; }
      heading("Skill Conflict Resolution");
      success(`Selected: ${resolution.selected.join(", ") || "none"}`);
      for (const item of resolution.suppressed) warn(`Suppressed ${item.skill}: ${item.reason}`);
    }));
