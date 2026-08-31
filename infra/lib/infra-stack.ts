import * as path from 'path';
import * as cdk from 'aws-cdk-lib/core';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as apigatewayv2 from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as iam from 'aws-cdk-lib/aws-iam';

const GITHUB_REPO = 'Goalaso/soccerleaguescheduling';
const CDK_QUALIFIER = 'hnb659fds'; // default CDK bootstrap qualifier

export class InfraStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Parameter values were provisioned out-of-band (migrated from the prior
    // Secrets Manager secrets) — the actual values never pass through this
    // stack's code or CloudFormation template. SSM Parameter Store's
    // Standard tier is used instead of Secrets Manager: it's free (no
    // per-parameter monthly fee, unlike Secrets Manager's $0.40/secret/mo),
    // and none of these three ever used Secrets Manager's built-in rotation
    // — the Outlook one rotates its own refresh token in application code
    // (see server/src/services/email.js), so there's no capability lost.
    //
    // Referenced by name (not a `ssm.StringParameter` construct) because the
    // only thing needed here is the ARN for IAM policy scoping — resolving
    // `.stringValue` would bake the decrypted value into the CloudFormation
    // template/Lambda config as a dynamic reference, which is exactly what
    // provisioning out-of-band is meant to avoid. The Lambda reads the
    // actual value at runtime via the SDK instead (same pattern the old
    // Secrets Manager code used).
    const DB_URL_PARAM = '/bisl/database-url';
    const JWT_PARAM = '/bisl/jwt-secret';
    const OUTLOOK_PARAM = '/bisl/outlook-email';
    const ssmParamArn = (name: string) => `arn:aws:ssm:${this.region}:${this.account}:parameter${name}`;

    const apiFunction = new NodejsFunction(this, 'ApiFunction', {
      entry: path.join(__dirname, '../../server/src/lambda.js'),
      depsLockFilePath: path.join(__dirname, '../../server/package-lock.json'),
      runtime: lambda.Runtime.NODEJS_20_X,
      memorySize: 256,
      // HttpApi has a hard, non-configurable 30s integration timeout — this
      // stays under that so a slow request (e.g. season creation's batched
      // bulk-email send, see sendEmailBatch in server/src/services/email.js)
      // gets a real Lambda timeout error instead of a generic API Gateway
      // 504.
      timeout: cdk.Duration.seconds(28),
      environment: {
        DATABASE_URL_PARAM: DB_URL_PARAM,
        JWT_SECRET_PARAM: JWT_PARAM,
        OUTLOOK_SECRET_PARAM: OUTLOOK_PARAM,
        NODE_ENV: 'production',
      },
      bundling: {
        externalModules: [
          // Provided by the Lambda Node 20 runtime itself, not bundled.
          '@aws-sdk/*',
          // pg's optional native binding isn't used by this app (no
          // pg-native require anywhere) and isn't installable by esbuild.
          'pg-native',
        ],
      },
    });
    // ssm:GetParameter alone doesn't decrypt a SecureString — the AWS-managed
    // key's resource policy allows the account to use it, but the calling
    // role still needs its own explicit kms:Decrypt/kms:GenerateDataKey
    // grant. All three parameters share the same default key, so one grant
    // covers all of them.
    apiFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['ssm:GetParameter'],
        resources: [ssmParamArn(DB_URL_PARAM), ssmParamArn(JWT_PARAM), ssmParamArn(OUTLOOK_PARAM)],
      })
    );
    // Only the Outlook parameter is written to at runtime — Microsoft
    // rotates the refresh token on every use (see
    // server/src/services/email.js), so only this one needs write access,
    // unlike the read-only database/JWT parameters.
    apiFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['ssm:PutParameter'],
        resources: [ssmParamArn(OUTLOOK_PARAM)],
      })
    );
    kms.Alias.fromAliasName(this, 'SsmDefaultKey', 'alias/aws/ssm').grantEncryptDecrypt(apiFunction);

    // Polls the waitlist mailbox on a schedule — lambda.js branches on the
    // event shape EventBridge delivers (event.source === 'aws.events') to
    // tell this apart from a normal API Gateway HTTP invocation, so no
    // custom event payload needs to be configured here.
    new events.Rule(this, 'WaitlistPollRule', {
      schedule: events.Schedule.rate(cdk.Duration.minutes(15)),
      targets: [new targets.LambdaFunction(apiFunction)],
    });

    const httpApi = new apigatewayv2.HttpApi(this, 'HttpApi', {
      defaultIntegration: new HttpLambdaIntegration('LambdaIntegration', apiFunction),
    });

    const frontendBucket = new s3.Bucket(this, 'FrontendBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // HttpApi's own domain, without the "https://" scheme HttpOrigin expects.
    const apiDomain = cdk.Fn.select(2, cdk.Fn.split('/', httpApi.apiEndpoint));

    const distribution = new cloudfront.Distribution(this, 'Distribution', {
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(frontendBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      },
      additionalBehaviors: {
        '/api/*': {
          origin: new origins.HttpOrigin(apiDomain),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          // Not ALL_VIEWER: that forwards the viewer's original Host header
          // (the CloudFront domain) straight through to API Gateway, which
          // strictly requires Host to match its own execute-api domain and
          // rejects mismatches with a 403 — silently masked by the
          // distribution's 403->index.html rewrite below, which is what
          // made this look like a routing failure instead of a Host
          // header mismatch.
          originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
        },
      },
      errorResponses: [
        { httpStatus: 403, responseHttpStatus: 200, responsePagePath: '/index.html' },
        { httpStatus: 404, responseHttpStatus: 200, responsePagePath: '/index.html' },
      ],
      defaultRootObject: 'index.html',
    });

    // Same-origin via the distribution above means the browser never sends
    // this as a cross-site request, but it's kept for direct API Gateway
    // invocations (debugging) where the Origin header is actually checked.
    apiFunction.addEnvironment('CLIENT_ORIGIN', `https://${distribution.distributionDomainName}`);

    new s3deploy.BucketDeployment(this, 'DeployFrontend', {
      sources: [s3deploy.Source.asset(path.join(__dirname, '../../build'))],
      destinationBucket: frontendBucket,
      distribution,
      distributionPaths: ['/*'],
    });

    new cdk.CfnOutput(this, 'SiteUrl', { value: `https://${distribution.distributionDomainName}` });
    new cdk.CfnOutput(this, 'ApiEndpoint', { value: httpApi.apiEndpoint });

    // GitHub Actions OIDC: lets the GitHub-hosted runner assume a role via
    // short-lived federated tokens instead of long-lived AWS keys stored as
    // GitHub secrets. The role only trusts pushes to main on this exact
    // repo, and only lets the holder assume the CDK bootstrap roles this
    // account already has (same permissions this stack's own manual
    // deploys have been using) — no separate broad permission set to
    // maintain.
    const githubProvider = new iam.OpenIdConnectProvider(this, 'GitHubOidcProvider', {
      url: 'https://token.actions.githubusercontent.com',
      clientIds: ['sts.amazonaws.com'],
    });

    const githubDeployRole = new iam.Role(this, 'GitHubDeployRole', {
      assumedBy: new iam.WebIdentityPrincipal(githubProvider.openIdConnectProviderArn, {
        StringEquals: {
          'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com',
        },
        StringLike: {
          'token.actions.githubusercontent.com:sub': `repo:${GITHUB_REPO}:ref:refs/heads/main`,
        },
      }),
      description: 'Assumed by GitHub Actions (OIDC) to deploy BislStack on push to main',
    });

    const bootstrapRoleArns = ['deploy-role', 'file-publishing-role', 'lookup-role'].map(
      (role) =>
        `arn:aws:iam::${this.account}:role/cdk-${CDK_QUALIFIER}-${role}-${this.account}-${this.region}`
    );
    githubDeployRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['sts:AssumeRole'],
        resources: bootstrapRoleArns,
      })
    );

    new cdk.CfnOutput(this, 'GitHubDeployRoleArn', { value: githubDeployRole.roleArn });
  }
}
