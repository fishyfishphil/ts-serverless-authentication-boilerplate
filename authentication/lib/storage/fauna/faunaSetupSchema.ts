// call this with `STAGE=dev npm run setup:fauna` before anything else
import * as faunadb from 'faunadb';
import * as fs from 'fs/promises';
import * as yaml from 'js-yaml'; // eslint-disable-line import/no-extraneous-dependencies

const readFile = async (filePath: string) => {
		return await fs.readFile(filePath, 'utf8');
};

const setupSchema = (config: {secret: string}, userClassName: string) => {
	const q = faunadb.query;
	const client = new faunadb.Client(config);
	return client
		.query(q.CreateClass({ name: 'auth_cache' }))
		.then(() =>
			client.query(
				q.Create(q.Ref('indexes'), {
					name: 'auth_cache',
					source: q.Class('auth_cache'),
					terms: [{ field: [ 'data', 'token' ] }],
					unique: true
				})
			))
		.then(() => client.query(q.CreateClass({ name: userClassName })))
		.then(() =>
			client.query(
				q.Create(q.Ref('indexes'), {
					name: 'auth_userId',
					source: q.Class(userClassName),
					terms: [{ field: [ 'data', 'userId' ] }],
					unique: true
				})
			))
		.then(() =>
			client.query(
				q.Create(q.Ref('indexes'), {
					// this index is optional but useful in development for browsing users
					name: `all_${userClassName}`,
					source: q.Class(userClassName)
				})
		));
};

const run = async () => {
	const file = await readFile('./authentication/env.yml');
	const yamlData: any = yaml.safeLoad(file);
	if(yamlData === undefined || typeof(yamlData) === 'string') {
		throw new Error('yamlData cannot be undefined or a string.');
	}
	const env = yamlData[process.env.STAGE || 'dev'];
	const userClassName = env.USERS_CLASS_NAME || 'users'; // should be shared with content app
	const config = { secret: env.FAUNADB_SECRET };
	process.env.FAUNADB_SECRET = env.FAUNADB_SECRET;
	try {
		await setupSchema(config, userClassName);
	} catch (exception) {
		console.error(JSON.stringify(exception, null, 2)) // eslint-disable-line no-console
	}
};

run();
