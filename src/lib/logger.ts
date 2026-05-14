/**
 * CAVE-LOGGER: Hyper-terse structured logging
 * Style: [LVL] CAT | MSG | keys=vals
 */

type LogLevel = 'INFO' | 'WARN' | 'ERR' | 'SYS';

class Logger {
  private format(level: LogLevel, category: string, msg: string, data?: Record<string, any>) {
    const ts = new Date().toISOString();
    const dataStr = data ? Object.entries(data).map(([k, v]) => `${k}=${v}`).join(' ') : '';
    return `[${level}] ${category.toUpperCase()} | ${msg} | ${dataStr} @${ts}`;
  }

  info(cat: string, msg: string, data?: Record<string, any>) {
    console.log(this.format('INFO', cat, msg, data));
  }

  warn(cat: string, msg: string, data?: Record<string, any>) {
    console.warn(this.format('WARN', cat, msg, data));
  }

  error(cat: string, msg: string, data?: Record<string, any>) {
    console.error(this.format('ERR', cat, msg, data));
  }

  sys(cat: string, msg: string, data?: Record<string, any>) {
    console.log(this.format('SYS', cat, msg, data));
  }
}

export const logger = new Logger();
