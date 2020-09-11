// Config
import { config, utils, IProviderCallbackEvent, IConfigValues, Profile } from 'ts-serverless-authentication';
import { IEventProxy } from '../../interfaces/IEventProxy';
import { Cacheable } from '../storage/abstract/Cacheable';
import { ProviderCallbackHandler } from '../../types/ProviderCallbackHandler';

import * as crypto from 'crypto';
// import * as customGoogle from '../custom-google';

// Common
import {dynamoCache} from '../storage/dynamo/dynamoCache';
import * as users from '../storage/usersStorage';
import { createResponseData } from '../helpers';

function createUserId(data: string, secret: string) {
	const hmac = crypto.createHmac('sha256', secret);
	hmac.update(data);
	return hmac.digest('hex');
}

/**
 * Error response
 * @param error
 */
function errorResponse(error: object, providerConfig: IConfigValues) {
	const { url } = utils.errorResponse(error, providerConfig);
	return {
		statusCode: 302,
		headers: {
			Location: url
		}
	};
}

/**
 * Token response
 * @param data
 */
function tokenResponse(data: any, providerConfig: IConfigValues) {
	const { url } = utils.tokenResponse(data, providerConfig);
	return {
		statusCode: 302,
		headers: {
			Location: url
		}
	};
}

/**
 * Handles the response
 * @param error
 * @param profile
 * @param state
 * User Saved in this function.
 */
const handleResponse = async (profileState: { profile: Profile, state: string }, providerConfig: IConfigValues, cache: Cacheable) => {
	try {
		await cache.revokeState(profileState.state);

		if(!providerConfig.token_secret) {
			throw new Error('No token secret provided.');
		}

		const id = createUserId(
			`${profileState.profile.provider}-${profileState.profile.id}`,
			providerConfig.token_secret
		);

		const data = createResponseData(id, providerConfig);
		const userContext = await users.saveUser(
			{...profileState.profile, ...{ userId: id }}
		);

		// saveUser can optionally return an authorizer context map
		// see http://docs.aws.amazon.com/apigateway/latest/developerguide/use-custom-authorizer.html
		if (typeof userContext === 'object' && !Array.isArray(userContext)) {
			data.authorizationToken.payload = { ...userContext, ...data.authorizationToken.payload };
		}

		const result = await cache.saveRefreshToken(id, data.authorizationToken.payload);

		return tokenResponse(
			{ ...data, ...{ refreshToken: result }},
			providerConfig
		);
	} catch (exception) {
		return errorResponse({ error: exception }, providerConfig);
	}
}

/**
 * Callback Handler
 * @param proxyEvent
 * @param context
 */
export async function callbackHandler(proxyEvent: IEventProxy, providerCallbackHandler: ProviderCallbackHandler) {
	const event: IProviderCallbackEvent = {
		provider: proxyEvent.pathParameters.provider,
		stage: proxyEvent.requestContext.stage,
		host: proxyEvent.headers.Host,
		code: proxyEvent.queryStringParameters.code,
		state: proxyEvent.queryStringParameters.state
	};

	const providerConfig = config(event);
	const response = await providerCallbackHandler(event, providerConfig);
	const cache = new dynamoCache({ region: 'us-west-2', endpoint: 'http://localhost:8000' });

	if(!response) {
		throw new Error('Provider or response was not found.');
	}

	return handleResponse(response, providerConfig, cache);
}
