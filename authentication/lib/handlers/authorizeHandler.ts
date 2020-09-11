// Config
import { config, IAuthResponse, utils } from 'ts-serverless-authentication';
import { IAuthorizationEvent } from '../../interfaces/IAuthorizationEvent';

const policyContext = (data: object) => {
  let context: { [key: string]: boolean | number | string } = {};
  const validTypes = ['boolean', 'number', 'string'];

  for(const [key, value] of Object.entries(data)) {
    if(key !== 'id' && validTypes.indexOf(typeof value) !== -1) {
      context[key] = value;
    }
  }

  return context;
}

// Authorize
export async function authorize(event: IAuthorizationEvent) {
  const stage = event.methodArn.split('/')[1] || 'dev' // @todo better implementation
  let error = null;
  let policy: IAuthResponse = {};
  const { authorizationToken } = event;
  if (authorizationToken) {
    try {
      // this example uses simple expiration time validation
      const providerConfig = config({ provider: '', stage });
      if (!providerConfig.token_secret) throw new Error('Authorize: No token secret configured.');
      const data: any = utils.readToken(authorizationToken, providerConfig.token_secret);
      policy = utils.generatePolicy(data.id, 'Allow', event.methodArn);
      policy.context = policyContext(data);
    } catch (err) {
      error = 'Unauthorized';
    }
  } else {
    error = 'Unauthorized';
  }

  if (policy === {}) {
    error = 'No policy.';
  }
 
  if (error) {
    throw new Error(error);
  }
  return policy;
}