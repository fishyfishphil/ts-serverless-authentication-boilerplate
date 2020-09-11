export interface IAuthorizationEvent {
	type: string;
	authorizationToken: string;
	methodArn: string;
}