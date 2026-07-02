import { scrubSensitiveData } from './log-scrub.util';

function formatArgs(args: unknown[]): unknown[] {
  return args.map((arg) => {
    if (arg instanceof Error) {
      return scrubSensitiveData({
        name: arg.name,
        message: arg.message,
        stack: process.env.NODE_ENV === 'development' ? arg.stack : undefined,
      });
    }
    if (typeof arg === 'string' || typeof arg === 'object') {
      return scrubSensitiveData(arg);
    }
    return arg;
  });
}

/** Logger que nunca grava senhas, tokens ou PII em texto puro. */
export const safeLogger = {
  error: (...args: unknown[]) => console.error(...formatArgs(args)),
  warn: (...args: unknown[]) => console.warn(...formatArgs(args)),
  info: (...args: unknown[]) => console.info(...formatArgs(args)),
  debug: (...args: unknown[]) => {
    if (process.env.NODE_ENV === 'development') {
      console.debug(...formatArgs(args));
    }
  },
};
