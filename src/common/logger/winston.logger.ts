import { WinstonModule, WinstonModuleOptions } from 'nest-winston';
import * as winston from 'winston';

export function createLogger() {
  return WinstonModule.createLogger({
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    transports: [
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.ms(),
          winston.format.colorize(),
          winston.format.printf((info) => {
            const str = (v: unknown, fallback = '') =>
              typeof v === 'string' ||
              typeof v === 'number' ||
              typeof v === 'boolean'
                ? String(v)
                : fallback;
            return `${str(info.timestamp)} [${str(info.context, 'App')}] ${str(info.level)}: ${str(info.message)} ${str(info.ms)}`;
          }),
        ),
      }),
      new winston.transports.File({
        filename: 'logs/error.log',
        level: 'error',
        maxsize: 5 * 1024 * 1024,
        maxFiles: 5,
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.json(),
        ),
      }),
      new winston.transports.File({
        filename: 'logs/combined.log',
        maxsize: 5 * 1024 * 1024,
        maxFiles: 5,
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.json(),
        ),
      }),
    ],
  } as WinstonModuleOptions);
}
