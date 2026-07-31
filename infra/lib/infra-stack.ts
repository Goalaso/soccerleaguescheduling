import * as path from 'path';
import * as cdk from 'aws-cdk-lib/core';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
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

    // Secrets were provisioned out-of-band (see project plan) — the actual
    // values never pass through this stack's code or CloudFormation template.
    // Using the exact full ARN (not fromSecretNameV2's suffix-less partial
    // ARN) so the ARN used at runtime (GetSecretValue) and the ARN used in
    // the generated IAM policy (grantRead) are the same string — a partial
    // ARN without the random suffix doesn't match grantRead's
    // suffix-wildcard resource pattern, which is an AccessDenied trap.
    const dbUrlSecret = secretsmanager.Secret.fromSecretCompleteArn(
      this,
      'DatabaseUrlSecret',
      'arn:aws:secretsmanager:us-east-1:913524936355:secret:bisl/database-url-RjIb4n'
    );
    const jwtSecret = secretsmanager.Secret.fromSecretCompleteArn(
      this,
      'JwtSecret',
      'arn:aws:secretsmanager:us-east-1:913524936355:secret:bisl/jwt-secret-1KU4vz'
    );

    const apiFunction = new NodejsFunction(this, 'ApiFunction', {
      entry: path.join(__dirname, '../../server/src/lambda.js'),
      depsLockFilePath: path.join(__dirname, '../../server/package-lock.json'),
      runtime: lambda.Runtime.NODEJS_20_X,
      memorySize: 256,
      timeout: cdk.Duration.seconds(15),
      environment: {
        DATABASE_URL_SECRET_ARN: dbUrlSecret.secretArn,
        JWT_SECRET_ARN: jwtSecret.secretArn,
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
    dbUrlSecret.grantRead(apiFunction);
    jwtSecret.grantRead(apiFunction);

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
