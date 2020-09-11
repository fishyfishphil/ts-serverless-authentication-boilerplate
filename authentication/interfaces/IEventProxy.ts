export interface IEventProxy {
	pathParameters: {
		provider: string;
	};
	requestContext: {
		stage: string;
		authorizer?: any
	};
	headers: {
		Host: string;
	};
	queryStringParameters: {
		code: string;
		state: string;
	}
}