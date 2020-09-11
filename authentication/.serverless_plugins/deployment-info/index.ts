/**
 * Created by eetut on 23/11/2016.
 */
'use strict'

import * as _ from 'lodash';
import * as chalkMain from 'chalk';
const chalk = chalkMain.default;

export class Deploy {
	private serverless: any;
	private options: any;
	private provider: any;
	private commands: any;
	private hooks: any;

	constructor(serverless, options) {
		this.serverless = serverless
		this.options = options
		this.provider = this.serverless.providers.aws
		this.commands = {
			authentication: {
				commands: {
					info: {
						usage: 'Get info',
						lifecycleEvents: ['info']
					}
				}
			}
		};

		this.hooks = {
			'authentication:info:info': this.info.bind(this),
			'after:info:info': this.info.bind(this),
			'after:deploy:deploy': this.info.bind(this)
		};
	}

	info() {
		const providers = _(this.serverless.service.provider.environment)
			.keys()
			.filter(key => /PROVIDER_.+_ID/.test(key))
			.map(provider =>
				provider
					.replace(/PROVIDER_/, '')
					.replace(/_ID/, '')
					.replace(/_/, '-')
					.toLowerCase()
			)
			.value();
		//
		const stackName = this.provider.naming.getStackName(this.options.stage)

		return this.provider
			.request(
				'CloudFormation',
				'describeStacks',
				{ StackName: stackName },
				this.options.stage,
				this.options.region
			)
			.then(result => {
				const stack = _.first(result.Stacks)
				let authorizerFunction = _(stack.Outputs).find({
					OutputKey: 'AuthorizeLambdaFunctionQualifiedArn'
				}).OutputValue;

				if (this.serverless.service.provider.versionFunctions) {
					authorizerFunction = authorizerFunction.substr(
						0,
						authorizerFunction.lastIndexOf(':')
					)
				}

				const serviceEndpoint = _.find(stack.Outputs, {
					OutputKey: 'ServiceEndpoint'
				}).OutputValue
				return { authorizerFunction, serviceEndpoint }
			})
			.then(resources => {
				const domain = this.serverless.service.provider.environment
					.REDIRECT_DOMAIN_NAME
					? `https://${
							this.serverless.service.provider.environment.REDIRECT_DOMAIN_NAME
						}`
					: resources.serviceEndpoint
				let message: string[] = [];
				message.push(`${chalk.yellow.underline('\nAuthentication Service Information')}`);
				message.push(`${chalk.yellow('Authorizer function:')} ${resources.authorizerFunction}`);
				message.push(`${chalk.yellow('Signin endpoints:\n')}`);
				message.push(...providers.map(provider => {
						return `${domain}/authentication/signin/${provider}`
				}));
				message.push(`\n${chalk.yellow('Callback endpoints:\n')}`);
				message.push(...providers.map(provider => {
						return `${domain}/authentication/callback/${provider}`
				}));
				this.serverless.cli.consoleLog(message.join('\n'));
			})
	}
}
