// Common
import { Cacheable } from '../abstract/Cacheable';
import * as faunadb from 'faunadb';
// const { log } = require('../../helpers')

export class faunaCache extends Cacheable {
	private config = { secret: process.env.FAUNADB_SECRET || '' };
	private q = faunadb.query;
	private client: faunadb.Client;

	constructor() {
		super();
		this.client = new faunadb.Client(this.config);
	}

	/**
	 * Creates OAuth State
	 */
	createState = async () => {
		const state = this.hash()
		return this.client.query(this.q.Create(this.q.Class('auth_cache'), {
			data: { token: state, type: 'STATE', expired: false }
		})).then(() => state);
	}

	/**
	 * Revokes OAuth State
	 * @param state
	 */
	revokeState = async (state: string) => this.client.query(this.q.Let(
		{ matched: this.q.Get(this.q.Match(this.q.Index('auth_cache'), state)) },
		this.q.If(
			this.q.And(
				this.q.Equals(this.q.Select([ 'data', 'expired' ], this.q.Var('matched')), false),
				this.q.Equals(this.q.Select([ 'data', 'type' ], this.q.Var('matched')), 'STATE')
			),
			this.q.Update(this.q.Select('ref', this.q.Var('matched')), { data: { expired: true } }),
			'expired'
		)
	)).then((result) => {
		// log('revokeState', result)
		return state
	});

	/**
	 * Creates and saves refresh token
	 * @param user
	 */
	saveRefreshToken = async (user: string, payload: object) => {
		const token = this.hash()
		return this.client.query(this.q.Create(this.q.Class('auth_cache'), {
			data: {
				token,
				type: 'REFRESH',
				expired: false,
				userId: user,
				payload: payload || {}
			}
		})).then(() => token);
	}

	/**
	 * Revokes old refresh token and creates new
	 * @param oldToken
	 */
	revokeRefreshToken = async (oldToken: string) => {
		if (!oldToken.match(/[A-Fa-f0-9]{64}/)) {
			return Promise.reject(new Error('Invalid token'))
		}
		const token = this.hash();
		return this.client.query(this.q.Let(
			{ matched: this.q.Get(this.q.Match(this.q.Index('auth_cache'), oldToken)) },
			this.q.If(
				this.q.And(
					this.q.Equals(this.q.Select([ 'data', 'expired' ], this.q.Var('matched')), false),
					this.q.Equals(this.q.Select([ 'data', 'type' ], this.q.Var('matched')), 'REFRESH')
				),
				this.q.Update(this.q.Select('ref', this.q.Var('matched')), { data: { token } }),
				'expired'
			)
		)).then((result: any) => {
			// log('revokeRefreshToken', result)
			return { id: result.data.userId, token, payload: result.data.payload }
		})
	}
}