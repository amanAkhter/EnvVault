// ─────────────────────────────────────────────────────────────────────────────
// EnvVault CLI – Terminal UI helpers
// ─────────────────────────────────────────────────────────────────────────────

import chalk from 'chalk';
import { createInterface } from 'node:readline';
import { Writable } from 'node:stream';

export const ui = {
  success: (msg: string) => console.log(`${chalk.green('✓')} ${msg}`),
  error: (msg: string) => console.error(`${chalk.red('✗')} ${msg}`),
  warn: (msg: string) => console.log(`${chalk.yellow('!')} ${msg}`),
  info: (msg: string) => console.log(`${chalk.cyan('›')} ${msg}`),
  dim: (msg: string) => console.log(chalk.dim(msg)),
  raw: (msg: string) => console.log(msg),
};

/** Prompt for a line of input. */
export function prompt(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

/** Prompt for a password without echoing keystrokes. */
export function promptHidden(question: string): Promise<string> {
  const muted = new Writable({
    write(_chunk, _enc, cb) {
      cb();
    },
  });
  const rl = createInterface({ input: process.stdin, output: muted, terminal: true });
  process.stdout.write(question);
  return new Promise((resolve) => {
    rl.question('', (answer) => {
      rl.close();
      process.stdout.write('\n');
      resolve(answer);
    });
  });
}

/** Confirm a destructive action. Returns true only on explicit "yes"/"y". */
export async function confirm(question: string): Promise<boolean> {
  const answer = (await prompt(`${question} ${chalk.dim('(y/N)')} `)).toLowerCase();
  return answer === 'y' || answer === 'yes';
}

/** Fail hard with a friendly message and non-zero exit. */
export function fail(message: string): never {
  ui.error(message);
  process.exit(1);
}

export function fmtTime(ms: number | null | undefined): string {
  if (!ms) return chalk.dim('never');
  const diff = Date.now() - ms;
  const mins = Math.round(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}
