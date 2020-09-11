import { TokenPayload } from '../types/TokenPayload';

export interface ICacheable {
	createState: () => Promise<string> | string;
	revokeState: (state: string) => Promise<string> | string;
	saveRefreshToken: (user: string, payload: object) => Promise<string> | string;
	revokeRefreshToken: (oldToken: string) => Promise<TokenPayload> | TokenPayload;
}