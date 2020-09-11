
import { IEventProxy } from '../authentication/interfaces/IEventProxy';

const faunadb = require('faunadb');
const userClassName = process.env.USERS_CLASS_NAME || 'users'; // shared with authentication service
const q = faunadb.query
type testResponse = {
  statusCode: number,
  headers: {
    'Access-Control-Allow-Origin': string,
    'Access-Control-Allow-Credentials': boolean   
  },
  body: string
};

const createResponse = (statusCode: number, payload: object) : testResponse => ({
  statusCode: statusCode,
  headers: {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Credentials': true
  },
  body: JSON.stringify(payload)
});

const test = (event: IEventProxy, context: any, cb: (error: any, response: testResponse) => void) => {
  console.log('event', event);
  const authData = event.requestContext.authorizer;
  if (authData.principalId) {
    if (authData.faunadb) {
      const client = new faunadb.Client({ secret: authData.faunadb })
      client.query(q.Get(q.Ref(`classes/${userClassName}/self`)))
        .then((result: any) => {
          console.log('result', result);
          cb(null, createResponse(200, result));
        })
        .catch((error: any) => {
          console.log('error', error)
          cb(null, createResponse(400, error))
        })
    } else {
      cb(null, createResponse(200, { username: authData.principalId }))
    }
  } else {
    cb(null, createResponse(400, { error: 'Invalid request' }))
  }
}

export default test;