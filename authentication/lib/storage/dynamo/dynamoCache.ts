import * as AWS from 'aws-sdk';
import { Cacheable } from '../abstract/Cacheable';

export class dynamoCache extends Cacheable {
	private config = {
		region: process.env.REGION || 'eu-west-1'
	};
	private dynamodb: AWS.DynamoDB.DocumentClient;

	constructor(config?: { region: string, endpoint?: string }) {
		super();
		
		this.dynamodb = new AWS.DynamoDB.DocumentClient(config || this.config);
	}

	/**
	 * Creates OAuth State
	 */
	public createState = async (): Promise<string> => {
		const state = this.hash();
		const params = {
			TableName: process.env.CACHE_DB_NAME || '',
			Item: {
				token: state,
				type: 'STATE',
				expired: false
			}
		};

		try {
			await this.dynamodb.put(params).promise();
			return state;
			// .then(() => state)
		} catch(error) {
			throw new Error(`createState: ${error}`);
		}
	}

	/**
	 * Revokes OAuth State
	 * @param state
	 */
	public revokeState = async (state: string) => {
		const queryToken = async () => {
			const params = {
				TableName: process.env.CACHE_DB_NAME || '',
				ProjectionExpression: '#token, #type, Expired',
				KeyConditionExpression: '#token = :token and #type = :type',
				ExpressionAttributeNames: {
					'#token': 'token',
					'#type': 'type'
				},
				ExpressionAttributeValues: {
					':token': state,
					':type': 'STATE'
				}
			};

			try {
				const queryResults = await this.dynamodb.query(params).promise(); 
				return queryResults;
			} catch (error) {
				throw new Error(`revokeState - queryToken: ${error}`);
			}
		};

		const insertToken = async (data: any) => {
			const item = data.Items[0];
			if (item.expired) {
				throw new Error('State expired');
			} else {
				const params = {
					TableName: process.env.CACHE_DB_NAME || '',
					Item: {
						token: state,
						type: 'STATE',
						expired: true
					}
				};

				try {
				 	await this.dynamodb.put(params).promise();
					if(item.token) {
						return <string>item.token;
					} else {
						throw new Error(`revokeState - No Token`);
					}
				// .then(() => item.token)
				} catch (error) {
					throw new Error(`revokeState - insert token: ${error}`);
				}
			}
		};

		const queriedToken = await queryToken();
		const insertedToken = await insertToken(queriedToken);
		if (state !== insertedToken) {
			throw new Error('State mismatch');
		}
		return insertedToken;
	};

	/**
	 * Creates and saves refresh token
	 * @param user
	 */
	public saveRefreshToken = async (user: string, payload: object) => {
		const token = this.hash();
		const params = {
			TableName: process.env.CACHE_DB_NAME || '',
			Item: {
				token: token,
				type: 'REFRESH',
				expired: false,
				userId: user,
				payload: JSON.stringify(payload || {})
			}
		};

		try {
			await this.dynamodb.put(params).promise();
			return token; 	
		} catch (error) {
			throw new Error(`saveRefreshToken: ${error}`);		
		}
	}

	/**
	 * Revokes old refresh token and creates new
	 * @param oldToken
	 */
	public revokeRefreshToken = async (oldToken: string) => {
		if (oldToken.match(/[A-Fa-f0-9]{64}/)) {
			const token = this.hash();
			const queryToken = async () : Promise<any> => {
				const params = {
					TableName: process.env.CACHE_DB_NAME || '',
					ProjectionExpression: '#token, #type, #userId',
					KeyConditionExpression: '#token = :token and #type = :type',
					ExpressionAttributeNames: {
						'#token': 'token',
						'#type': 'type',
						'#userId': 'userId'
					},
					ExpressionAttributeValues: {
						':token': oldToken,
						':type': 'REFRESH'
					}
				};

				try {
					return await this.dynamodb.query(params).promise();
				} catch (error) {
					throw new Error(`revokeRefreshToken - queryToken: ${error}`);
				}
			};

			const newRefreshToken = async (data: any) => {
				const { userId, payload } = data.Items[0];
				const params = {
					TableName: process.env.CACHE_DB_NAME || '',
					Item: {
						token,
						type: 'REFRESH',
						expired: false,
						userId,
						payload
					}
				};

				try {
					await this.dynamodb.put(params).promise();
					return userId;
				} catch(error) {
					throw new Error(`revokeRefreshToken - newRefreshToken: ${error}`);
				}
			};

			const expireRefreshToken = async (userId: string) => {
				const params = {
					TableName: process.env.CACHE_DB_NAME || '',
					Item: {
						token: oldToken,
						type: 'REFRESH',
						expired: true,
						userId: userId
					}
				};

				try {
					await this.dynamodb.put(params).promise();
					return userId;
				} catch(error) {
					throw new Error(`revokeRefreshToken - expireRefreshToken: ${error}`);
				}
			};

			const queriedToken = await queryToken();
			const newToken = await newRefreshToken(queriedToken);
			const userId = await expireRefreshToken(newToken);
			return {
				id: userId,
				token: token,
				payload: queriedToken.payload && JSON.parse(queriedToken.payload)
			};
		} else {
			throw new Error('Invalid token');
		}
	}
}