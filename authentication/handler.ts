import {signinHandler} from './lib/handlers/signinHandler';
import {callbackHandler} from './lib/handlers/callbackHandler';
import {refreshHandler} from './lib/handlers/refreshHandler';
import {authorize} from './lib/handlers/authorizeHandler';
import { ProviderCallbackHandler } from './types/ProviderCallbackHandler';
import { IEventProxy } from './interfaces/IEventProxy';
// import { setupSchemaHandler } from './lib/storage/fauna/faunaUser';

module.exports.signin = async (event: any) => signinHandler(event);

module.exports.callback = async (event: IEventProxy, providerCallbackHandler: ProviderCallbackHandler) => callbackHandler(event, providerCallbackHandler);

module.exports.refresh = async (event: any) => refreshHandler(event);

module.exports.authorize = async (event: any) => authorize(event);

// module.exports.schema = (event, context, cb) => setupSchemaHandler(event, cb)