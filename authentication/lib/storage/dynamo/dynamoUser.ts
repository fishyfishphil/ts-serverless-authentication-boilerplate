import* as AWS from 'aws-sdk';

// empty strings cannot be saved to dynamo
const sanitize = (obj: any) => {
  const clone = Object.assign({}, obj);
  Object.keys(clone).forEach((key) => {
    if (key === '_raw') {
      clone[key] = sanitize(clone[key])
    } else if (clone[key] === '' || clone[key] === undefined) {
      delete clone[key];
    }
  })
  return clone;
}

const saveUser = async (profile: object) => {
  const config = {
    region: process.env.REGION || 'eu-west-1'
  };  
  const dynamodb = new AWS.DynamoDB.DocumentClient(config);
 
  const params = {
    TableName: process.env.USERS_DB_NAME || '',
    Item: sanitize(profile)
  };
  return await dynamodb.put(params).promise();
}

export default saveUser;