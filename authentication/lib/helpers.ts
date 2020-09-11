import * as logjs from 'log4js';
const logger = logjs.getLogger();

export function createResponseData(id: string, options?: any) {
  // sets 15 seconds expiration time as an example
  const authorizationToken = {
    payload: {
      id
    },
    options: {
      expiresIn: 15
    }
  };

  return { authorizationToken };
}

export function log(message: any) {
  logger.debug(message);
}