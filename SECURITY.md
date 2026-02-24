# Security Architecture

## Overview

This application implements a secure, production-ready architecture for accessing AWS S3 buckets without storing long-term AWS credentials in the database.

## Security Principles

### 1. Zero Credential Storage
- **What we store**: Only `roleArn` and `externalId` in the database
- **What we DON'T store**: AWS Access Key ID, Secret Access Key, Session Tokens
- **Why**: Even if the database is compromised, attackers cannot access AWS resources

### 2. Temporary Credentials
- **Mechanism**: AWS STS AssumeRole generates temporary credentials per request
- **Lifetime**: 1 hour (configurable)
- **Scope**: Each API request assumes the role fresh - no credential caching

### 3. Environment-Based Base Credentials
- **Location**: Base AWS credentials stored ONLY in environment variables (Vercel)
- **Access**: Server-side only, never exposed to client
- **Rotation**: Can be rotated without code changes

### 4. Cross-Account Security
- **External ID**: Required for all role assumptions (prevents confused deputy attacks)
- **Trust Policy**: IAM role trust policy restricts which accounts can assume the role
- **Principle of Least Privilege**: Each role has minimal required S3 permissions

## Data Flow

### Connection Setup Flow
```
1. User enters roleArn + externalId in UI
2. POST /api/aws/verify
3. Backend assumes role using base credentials from env vars
4. Verifies access by listing buckets
5. On success: Store ONLY roleArn + externalId in DB
```

### S3 Access Flow (Every Request)
```
1. User requests bucket list
2. GET /api/s3/buckets
3. Backend fetches roleArn + externalId from DB
4. Backend calls STS AssumeRole (using base creds from env)
5. Receives temporary credentials (valid 1 hour)
6. Uses temp credentials to call S3 API
7. Returns results to user
8. Temporary credentials discarded (not stored)
```

## Threat Model

### Protected Against

1. **Database Compromise**
   - Attacker gets roleArn + externalId only
   - Cannot access AWS without base credentials (in env vars)

2. **Code Injection**
   - No credentials in codebase
   - All credentials from environment variables

3. **Client-Side Attacks**
   - No AWS credentials exposed to browser
   - All AWS operations server-side

4. **Credential Leakage**
   - Temporary credentials expire after 1 hour
   - No long-term credential storage

### Additional Security Measures Needed

1. **Rate Limiting**: Add rate limiting to API endpoints
2. **Audit Logging**: Log all AssumeRole calls (CloudTrail)
3. **MFA**: Consider requiring MFA for base AWS account
4. **IP Restrictions**: Restrict base credentials to specific IPs if possible
5. **Monitoring**: Alert on unusual AssumeRole patterns
6. **Encryption**: Encrypt database at rest
7. **HTTPS**: Always use HTTPS (Vercel provides automatically)

## IAM Role Best Practices

### Base Account Role/User Permissions
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "sts:AssumeRole",
      "Resource": "arn:aws:iam::*:role/S3HelperRole"
    }
  ]
}
```

### Target Account Role Permissions (Example)
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:ListBucket",
        "s3:GetObject",
        "s3:PutObject"
      ],
      "Resource": [
        "arn:aws:s3:::bucket-name",
        "arn:aws:s3:::bucket-name/*"
      ]
    }
  ]
}
```

### Trust Policy (Target Account)
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::BASE_ACCOUNT_ID:user/base-user"
      },
      "Action": "sts:AssumeRole",
      "Condition": {
        "StringEquals": {
          "sts:ExternalId": "unique-external-id-here"
        }
      }
    }
  ]
}
```

## Environment Variables Security

### Vercel Environment Variables
- Mark sensitive variables as "Encrypted" in Vercel dashboard
- Use different values for production/staging
- Rotate credentials regularly
- Never commit `.env` files to git

### Required Variables
- `AWS_ACCESS_KEY_ID`: Base account access key
- `AWS_SECRET_ACCESS_KEY`: Base account secret key (most sensitive)
- `AWS_REGION`: AWS region
- `DATABASE_URL`: PostgreSQL connection string
- `NEXTAUTH_SECRET`: NextAuth secret (generate with `openssl rand -base64 32`)
- `NEXTAUTH_URL`: Application URL

## Compliance Considerations

### GDPR
- User data stored in PostgreSQL
- AWS connections are user-specific
- Consider data retention policies

### SOC 2 / ISO 27001
- Audit logs via CloudTrail
- Access controls via IAM
- Encryption in transit (HTTPS) and at rest (database)

### PCI DSS
- If handling payment data, ensure S3 buckets are PCI-compliant
- Consider additional encryption layers

## Incident Response

### If Base Credentials Compromised
1. Immediately rotate AWS credentials in Vercel
2. Revoke old credentials in AWS IAM
3. Review CloudTrail logs for unauthorized access
4. Notify affected users if necessary

### If Database Compromised
1. Rotate database credentials
2. Review access logs
3. Verify no AWS credentials were stored (should be none)
4. Attackers only have roleArn + externalId (cannot access AWS without base creds)

### If Role Credentials Compromised
1. Temporary credentials expire after 1 hour (self-limiting)
2. Review CloudTrail for unauthorized S3 access
3. Consider rotating external IDs if needed

## Security Checklist

- [ ] Base AWS credentials stored in environment variables only
- [ ] Database contains only roleArn + externalId (no credentials)
- [ ] External ID required for all role assumptions
- [ ] IAM roles follow principle of least privilege
- [ ] HTTPS enabled (automatic on Vercel)
- [ ] Database encryption at rest enabled
- [ ] CloudTrail enabled for audit logging
- [ ] Rate limiting implemented (recommended)
- [ ] Error messages don't leak sensitive information
- [ ] Input validation on all API endpoints
- [ ] Authentication required for all AWS operations
- [ ] Regular credential rotation schedule
