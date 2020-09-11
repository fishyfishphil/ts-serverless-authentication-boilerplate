import { utils, config, IConfigValues } from 'ts-serverless-authentication';
import {ImportMock} from 'ts-mock-imports';
import * as AWS from 'aws-sdk';
import * as url from 'url';
import {refreshHandler} from '../authentication/lib/handlers/refreshHandler';
import {callbackHandler} from '../authentication/lib/handlers/callbackHandler';
import {signinHandler} from '../authentication/lib/handlers/signinHandler';
import {callbackHandler as googleCustomCallbackHandler} from '../authentication/lib/custom-google';
import { expect } from 'chai';
import 'mocha';
import { IEventProxy } from '../authentication/interfaces/IEventProxy';

const nock = require('nock');

const docMock = ImportMock.mockClass<AWS.DynamoDB.DocumentClient>(AWS.DynamoDB, 'DocumentClient');
docMock.mock('put', Promise.resolve({}));
docMock.mock('get', Promise.resolve({}));
const queryMock = docMock.mock('query', (()=>{
  Promise.resolve({
    Items: [
      {
        token: process.env.STATE,
        userId: 'mock-user'
      }
    ]
  })
})());
docMock.mock('update', Promise.resolve({}));

// jest.mock('aws-sdk', () => {
//   const mocks = {
//     getMock: jest.fn().mockResolvedValue({}),
//     putMock: jest.fn().mockResolvedValue({}),
//     queryMock: jest.fn().mockImplementation((params) => {
//       if (params.TableName === process.env.CACHE_DB_NAME) {
//         return Promise.resolve({
//           Items: [
//             {
//               token: process.env.STATE,
//               userId: 'mock-user'
//             }
//           ]
//         })
//       }
//       return Promise.reject(new Error('Invalid table'))
//     }),
//     updateMock: jest.fn().mockResolvedValue({}),
//     adminCreateUserMock: jest.fn().mockResolvedValue({}),
//     adminUpdateUserAttributesMock: jest.fn().mockResolvedValue({}),
//     adminGetUserMock: jest.fn().mockResolvedValue({})
//   }

//   const DocumentClient = {
//     get: (obj) => ({
//       promise: () => mocks.getMock(obj)
//     }),
//     put: (obj) => ({
//       promise: () => mocks.putMock(obj)
//     }),
//     query: (obj) => ({
//       promise: () => mocks.queryMock(obj)
//     }),
//     update: (obj) => ({
//       promise: () => mocks.updateMock(obj)
//     })
//   }

//   const CognitoIdentityServiceProvider = {
//     adminCreateUser: (obj) => ({
//       promise: () => mocks.adminCreateUserMock(obj)
//     }),
//     adminUpdateUserAttributes: (obj) => ({
//       promise: () => mocks.adminUpdateUserAttributesMock(obj)
//     }),
//     adminGetUser: (obj) => ({
//       promise: () => mocks.adminGetUserMock(obj)
//     })
//   }

//   return {
//     mocks,
//     DynamoDB: {
//       DocumentClient: jest.fn().mockImplementation(() => DocumentClient)
//     },
//     CognitoIdentityServiceProvider: jest
//       .fn()
//       .mockImplementation(() => CognitoIdentityServiceProvider)
//   }
// })

afterEach(() => {
  ImportMock.restore();
})

// afterAll(() => {
//   jest.restoreAllMocks()
// })

describe('Authentication Provider', () => {
  describe('Google', () => {
    beforeEach(() => {
      process.env.STAGE = 'dev'
      process.env.CACHE_DB_NAME = 'dev-serverless-authentication-cache'
      process.env.REDIRECT_CLIENT_URI = 'http://127.0.0.1:3000/'
      process.env.TOKEN_SECRET = 'token-secret-123'
      process.env.PROVIDER_CUSTOM_GOOGLE_ID = 'cg-mock-id'
      process.env.PROVIDER_CUSTOM_GOOGLE_SECRET = 'cg-mock-secret'

      const reduceKeyPair = (obj: object) => {
        return Object.entries(obj).map(v => `${v[0]}=${encodeURIComponent(v[1])}`).join('&');
      };

      const payload = {
        client_id: 'cg-mock-id',
        redirect_uri:
          'https://api-id.execute-api.eu-west-1.amazonaws.com/dev/authentication/callback/custom-google',
        client_secret: 'cg-mock-secret',
        code: 'code',
        grant_type: 'authorization_code'
      };

      nock('https://www.googleapis.com')
        // .log(console.log)
        .post(
          '/oauth2/v4/token',
          reduceKeyPair(payload)
        )
        .reply(200, {
          access_token: 'access-token-123'
        });

      nock('https://www.googleapis.com')
        // .log(console.log)
        .get('/plus/v1/people/me')
        .query({ access_token: 'access-token-123' })
        .reply(200, {
          id: 'user-id-1',
          displayName: 'Eetu Tuomala',
          emails: [
            {
              value: 'email@test.com'
            }
          ],
          image: {
            url: 'https://avatars3.githubusercontent.com/u/4726921?v=3&s=460'
          }
        })
    });

    let refreshToken = ''

    it('should return oauth signin url', async () => {
      const event = {
        pathParameters: {
          provider: 'custom-google'
        },
        requestContext: {
          stage: 'dev'
        },
        headers: {
          Host: 'api-id.execute-api.eu-west-1.amazonaws.com'
        }
      }

      const data = await signinHandler(event)
      const { query } = url.parse(data.headers.Location, true)
      const queryState = query.state
      process.env.STATE = (queryState ?? [])[0]
      expect(data.headers.Location).to.match(
        /https:\/\/accounts\.google\.com\/o\/oauth2\/v2\/auth\?client_id=cg-mock-id&redirect_uri=https:\/\/api-id\.execute-api\.eu-west-1\.amazonaws\.com\/dev\/authentication\/callback\/custom-google&response_type=code&scope=profile email&state=.{64}/
      )
    }).timeout(10000)

    it('should return local client url', async () => {
      const event: IEventProxy = {
        pathParameters: {
          provider: 'custom-google'
        },
        queryStringParameters: {
          code: 'code',
          state: process.env.STATE || ''
        },
        requestContext: {
          stage: 'dev'
        },
        headers: {
          Host: 'api-id.execute-api.eu-west-1.amazonaws.com'
        }
      };

      const configValues: IConfigValues = {
       provider: event.pathParameters.provider,
       host: event.headers.Host,
       stage: event.requestContext.stage
      };

      const providerConfig = config({ provider: event.pathParameters.provider, host: event.headers.Host, stage: event.requestContext.stage });
      const data = await callbackHandler(event, googleCustomCallbackHandler);
      const { query } = url.parse(data.headers.Location, true)
      refreshToken = (query.refresh_token ?? [])[0] || ''
      console.log('Refresh token', refreshToken);
      expect(query.authorization_token).to.match(
        /[a-zA-Z0-9\-_]+?\.[a-zA-Z0-9\-_]+?\.([a-zA-Z0-9\-_]+)?/
      );
      expect(refreshToken).to.match(/[A-Fa-f0-9]{64}/)

      const tokenData: any = utils.readToken(
        (query.authorization_token ?? [])[0] || '',
        providerConfig.token_secret || ''
      );

      console.log('TokenData', tokenData);
      expect(tokenData.id).to.be(
        '46344f93c18d9b70ddef7cc5c24886451a0af124f74d84a0c89387b5f7c70ff4'
      )
    })

    it('should get new authorization token', async () => {
      const event = {
        refresh_token: refreshToken
      }
      const data = await refreshHandler(event)
      expect(data.authorization_token).to.match(
        /[a-zA-Z0-9\-_]+?\.[a-zA-Z0-9\-_]+?\.([a-zA-Z0-9\-_]+)?/
      )
      expect(data.refresh_token).to.match(/[A-Fa-f0-9]{64}/)
      expect(data.id).to.be('mock-user')
    })
  })
})
