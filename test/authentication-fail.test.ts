import { ImportMock } from 'ts-mock-imports';
import * as AWS from 'aws-sdk';
import { signinHandler } from '../authentication/lib/handlers/signinHandler';
import { expect } from 'chai';
import 'mocha';

const docMock = ImportMock.mockClass<AWS.DynamoDB.DocumentClient>(AWS.DynamoDB, 'DocumentClient');
docMock.mock('put', Promise.resolve({}));

afterEach(() => {
  ImportMock.restore();
});

describe('Authentication', () => {
  beforeEach(() => {
    process.env.STAGE = 'dev'
    process.env.CACHE_DB_NAME = 'dev-serverless-authentication-cache'
    process.env.REDIRECT_CLIENT_URI = 'http://127.0.0.1:3000/'
    process.env.TOKEN_SECRET = 'token-secret-123'
  })

  describe('Signin', () => {
    it('should fail to return token for invalid provider', async () => {
      const event = {
        pathParameters: {
          provider: 'invalid'
        },
        requestContext: {
          stage: 'dev'
        },
        headers: {
          Host: 'api-id.execute-api.eu-west-1.amazonaws.com'
        }
      }

      const data = await signinHandler(event)
      expect(data.statusCode).to.equal(302)
      expect(data.headers.Location).to.be.equal(
        'http://127.0.0.1:3000/?exception=Error: createState: UnrecognizedClientException: The security token included in the request is invalid.'
      )
    }).timeout(10000)
  })
})
