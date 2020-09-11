import * as AWS from 'aws-sdk';

const cognitoIdentityServiceProvider =
  new AWS.CognitoIdentityServiceProvider();

const getUserAttributes = (profile: any) => {
  const attributes = [
    'address',
    'birthdate',
    'email',
    'family_name',
    'gender',
    'given_name',
    'locale',
    'middle_name',
    'name',
    'nickname',
    'phone_number',
    'picture',
    'preferred_username',
    'profile',
    'timezone',
    'website'
  ];

  return attributes.filter((key: string) => {
    return Object.prototype.hasOwnProperty.call(profile, key);
  }).map((v) => {return { Name: v, Value: profile[v] }});
}

const saveUser = async (profile: any) => {
  const params = {
    UserPoolId: process.env.USER_POOL_ID || '',
    Username: profile.userId,
    DesiredDeliveryMediums: [
      'EMAIL'
    ],
    ForceAliasCreation: false,
    MessageAction: 'SUPPRESS',
    TemporaryPassword: 'tempPassword1!',
    UserAttributes: getUserAttributes(profile)
  };

  return await cognitoIdentityServiceProvider
    .adminCreateUser(params).promise();
}

const updateUser = async (profile: any) => {
  const params = {
    UserAttributes: getUserAttributes(profile),
    UserPoolId: process.env.USER_POOL_ID || '',
    Username: profile.userId
  };

  return await cognitoIdentityServiceProvider
    .adminUpdateUserAttributes(params).promise();
}

const saveOrUpdateUser = async (profile: any) => {
  const params = {
    UserPoolId: process.env.USER_POOL_ID || '',
    Username: profile.userId
  };

  return cognitoIdentityServiceProvider
    .adminGetUser(params).promise()
    .then(() => updateUser(profile))
    .catch((error) => {
      if (error.code === 'UserNotFoundException') {
        return saveUser(profile)
      }
      throw error
    })
}

module.exports = {
  saveOrUpdateUser,
  saveUser,
  updateUser
}