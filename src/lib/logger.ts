// Privacy-safe logger - only works in development
// NO data is sent to Lovable in production

const isDevelopment = import.meta.env.DEV;

export const logger = {
  info: (...args: any[]) => {
    if (isDevelopment) {
      console.info(...args);
    }
  },
  
  warn: (...args: any[]) => {
    if (isDevelopment) {
      console.warn(...args);
    }
  },
  
  error: (...args: any[]) => {
    if (isDevelopment) {
      console.error(...args);
    }
  },
  
  log: (...args: any[]) => {
    if (isDevelopment) {
      console.log(...args);
    }
  }
};
