// Config
import { config, utils } from 'ts-serverless-authentication';

// Common
import { dynamoCache } from '../storage/dynamo/dynamoCache';
import { createResponseData } from '../helpers';
import { TokenPayload } from '../../types/TokenPayload';

/**
 * Refresh Handler
 * @param event
 * @param callback
 */
export async function refreshHandler(event: any) {
  const cache = new dynamoCache({ region: 'us-west-2', endpoint: 'http://localhost:8000' });
  const refreshToken = event.refresh_token;
  // user refresh token to get userid & provider from cache table
  try {
    const results = await cache.revokeRefreshToken(refreshToken);
    const providerConfig = config({ provider: '', stage: event.stage });
    const { id } = results;
    const data = { ...createResponseData(id, providerConfig), ...{refreshToken: results.token}};
    if (typeof results.payload === 'object') {
      data.authorizationToken.payload = { ...data.authorizationToken.payload, ...results.payload };
    }

    if(!providerConfig.token_secret) {
      throw new Error('No token secret provided.');
    }

    const authorization_token = utils.createToken(
      data.authorizationToken.payload,
      providerConfig.token_secret,
      data.authorizationToken.options
    );
    const result = { authorization_token, refresh_token: data.refreshToken, id };
    return result;
  } catch (exception) {
    throw new Error(`refreshHandler: ${exception}`);
  }
}