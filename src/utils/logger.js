const LOG_LEVELS = {
  ERROR: "ERROR",
  WARN: "WARN",
  INFO: "INFO",
  DEBUG: "DEBUG",
};

const formatLog = (level, message, data = null) => {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [${level}] ${message}`;
  return data ? `${logMessage} ${JSON.stringify(data)}` : logMessage;
};

const isTestEnv = process.env.NODE_ENV === "test";
const noOp = () => {};

export const logger = {
  info: isTestEnv ? noOp : (message, data) => {
    console.log(formatLog(LOG_LEVELS.INFO, message, data));
  },
  error: isTestEnv ? noOp : (message, data) => {
    console.error(formatLog(LOG_LEVELS.ERROR, message, data));
  },
  warn: isTestEnv ? noOp : (message, data) => {
    console.warn(formatLog(LOG_LEVELS.WARN, message, data));
  },
  debug: (message, data) => {
    if (process.env.DEBUG && !isTestEnv) {
      console.debug(formatLog(LOG_LEVELS.DEBUG, message, data));
    }
  },
};
