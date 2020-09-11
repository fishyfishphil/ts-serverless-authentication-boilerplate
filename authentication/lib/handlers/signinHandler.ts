// Config
import { config, utils, IProviderCallbackEvent } from 'ts-serverless-authentication';

// Providers
// import * as facebook from 'serverless-authentication-facebook';
// import * as google from 'serverless-authentication-google';
// import * as microsoft from 'serverless-authentication-microsoft';
import * as customGoogle from '../custom-google';

// Common
import { dynamoCache } from '../storage/dynamo/dynamoCache';

const cache = new dynamoCache({ region: 'us-west-2', endpoint: 'http://localhost:8000' });

/**
 * Signin Handler
 * @param proxyEvent
 * @param context
 */
export async function signinHandler(proxyEvent: any) {
	const event: IProviderCallbackEvent = <IProviderCallbackEvent>{
		provider: proxyEvent.pathParameters.provider,
		stage: proxyEvent.requestContext.stage,
		host: proxyEvent.headers.Host
	};
	const providerConfig = config(event);
	let data;
	try {
		const state = await cache.createState();

		if(!state) {
			throw new Error('State is unassigned.');
		}

		switch (event.provider) {
			// case 'facebook':
			//   data = facebook.signinHandler(providerConfig, {
			//     scope: 'email',
			//     state
			//   });
			//   break;
			// case 'google':
			//   data = google.signinHandler(providerConfig, {
			//     scope: 'profile email',
			//     state
			//   });
			//   break;
			// case 'microsoft':
			//   data = microsoft.signinHandler(providerConfig, {
			//     scope: 'wl.basic wl.emails',
			//     state
			//   });
			//   break;
			case 'custom-google':
				// See ./customGoogle.js
				data = await customGoogle.signinHandler(providerConfig, { state });
				break;
			default:
				data = utils.errorResponse(
					{ error: `Invalid provider: ${event.provider}` },
					providerConfig
				);
			break;
		}
	} catch (exception) {
		console.log('Caught in signinHandler');
		data = utils.errorResponse({ exception }, providerConfig);
	}
	return {
		statusCode: 302,
		headers: {
			Location: data.url
		}
	};
}