
import * as faunadb from 'faunadb';

const userClassName = process.env.USERS_CLASS_NAME || 'users'; // should be shared with content app
const config = { secret: process.env.FAUNADB_SECRET || '' };
const q = faunadb.query;
const client = new faunadb.Client(config);

const saveUser = (profile: any) => {
	// profile class: https://github.com/SansDeus/ts-serverless-authentication/blob/master/src/profile.ts
	if (!(profile && profile.userId)) {
		return Promise.reject(new Error('Invalid profile'));
	}
	return client.query(q.Let(
		{ matchRef: q.Match(q.Index('auth_userId'), profile.userId) },
		q.If(
			q.Exists(q.Var('matchRef')),
			q.Update(q.Select('ref', q.Get(q.Var('matchRef'))), { data: profile }),
			q.Create(q.Class(userClassName), { data: profile })
		)
	))
	.then((result: any) => client.query(q.Create(q.Ref('tokens'), { instance: result.ref }))
	.then((key: any) => ({ faunadb: key.secret })));
}

export default saveUser;