import { ICacheable } from '../../../interfaces/ICacheable';
import { TokenPayload } from '../../../types/TokenPayload';
import * as crypto from 'crypto';

export abstract class Cacheable implements ICacheable {
	protected hash = () => crypto.randomBytes(48).toString('hex');
	abstract createState(): Promise<string> | string;
	abstract revokeState(state: string): Promise<string> | string;
	abstract saveRefreshToken(user: string, payload: object): Promise<string> | string;
	abstract revokeRefreshToken(oldToken: string): Promise<TokenPayload> | TokenPayload;
}