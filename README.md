# S3 Helper - Secure AWS S3 Dashboard

A production-ready Next.js application for managing AWS S3 buckets securely using AWS STS AssumeRole. **No AWS access keys or secret keys are stored in the database** - only IAM Role ARNs and External IDs.

## 🔒 Security Features

- **Zero credential storage**: Only `roleArn` and `externalId` stored in database
- **Temporary credentials**: STS AssumeRole generates temporary credentials per request
- **Cross-account access**: Supports cross-account IAM role assumption
- **Principle of least privilege**: Each role should have minimal required permissions
- **Environment-based credentials**: Base AWS credentials read ONLY from environment variables

## 🏗️ Architecture

```
┌─────────────┐
│   Browser   │
└──────┬──────┘
       │
       ▼
┌─────────────────┐     ┌──────────────┐     ┌─────────────┐
│  Next.js App    │────▶│   Prisma     │────▶│  PostgreSQL │
│  (Vercel)       │     │   Database   │     │             │
└────────┬────────┘     └──────────────┘     └─────────────┘
         │
         │ AssumeRole (per request)
         ▼
┌─────────────────┐     ┌──────────────┐     ┌─────────────┐
│  AWS STS        │────▶│  IAM Role   │────▶│     S3       │
│  (Temporary     │     │  (Cross-    │     │   Buckets    │
│   Credentials)  │     │   Account)  │     │              │
└─────────────────┘     └──────────────┘     └─────────────┘
```

## 📋 Prerequisites

- Node.js 20+ 
- PostgreSQL database
- AWS Account with:
  - IAM Role configured for cross-account access
  - Base IAM user/role with `sts:AssumeRole` permission
  - S3 buckets with appropriate permissions

## 🚀 Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Copy `.env.example` to `.env` and fill in the values:

```bash
cp .env.example .env
```

Required environment variables:

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/s3helper"

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="generate-with-openssl-rand-base64-32"

# AWS Base Credentials (for assuming roles)
AWS_ACCESS_KEY_ID="your-base-aws-access-key"
AWS_SECRET_ACCESS_KEY="your-base-aws-secret-key"
AWS_REGION="us-east-1"
```

**Generate NEXTAUTH_SECRET:**
```bash
openssl rand -base64 32
```

### 3. Setup Database

```bash
# Generate Prisma Client
npx prisma generate

# Run migrations
npx prisma migrate dev --name init

# (Optional) Open Prisma Studio
npx prisma studio
```

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## 🔧 AWS IAM Setup

### Step 1: Create IAM Role (in target AWS account)

1. Go to IAM → Roles → Create Role
2. Select "Another AWS account"
3. Enter your application's AWS account ID
4. Enable "Require external ID" and set a unique external ID
5. Attach S3 read permissions (e.g., `AmazonS3ReadOnlyAccess` or custom policy)
6. Name the role (e.g., `S3HelperRole`)
7. Copy the Role ARN (format: `arn:aws:iam::ACCOUNT_ID:role/ROLE_NAME`)

### Step 2: Configure Base Credentials

The base AWS credentials (in environment variables) need permission to assume the role:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "sts:AssumeRole",
      "Resource": "arn:aws:iam::TARGET_ACCOUNT_ID:role/S3HelperRole"
    }
  ]
}
```

### Step 3: Trust Relationship (in target account)

The IAM role's trust policy should allow your base account to assume it:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::YOUR_BASE_ACCOUNT_ID:user/YOUR_USER"
      },
      "Action": "sts:AssumeRole",
      "Condition": {
        "StringEquals": {
          "sts:ExternalId": "your-unique-external-id"
        }
      }
    }
  ]
}
```

## 📚 API Endpoints

### Authentication

- `POST /api/auth/signup` - Create new user account
- `GET/POST /api/auth/[...nextauth]` - NextAuth endpoints

### AWS Connection

- `POST /api/aws/verify` - Verify and save AWS IAM Role connection
  ```json
  {
    "roleArn": "arn:aws:iam::123456789012:role/S3HelperRole",
    "externalId": "unique-external-id",
    "name": "Production Account" // optional
  }
  ```

### S3 Operations

- `GET /api/s3/buckets?connectionId=xxx` - List all S3 buckets
- `GET /api/s3/objects?bucket=BUCKET_NAME&prefix=PREFIX&maxKeys=100` - List objects in bucket
- `POST /api/s3/presigned-url` - Generate presigned URL for uploads
  ```json
  {
    "bucket": "my-bucket",
    "key": "path/to/file.jpg",
    "contentType": "image/jpeg",
    "expiresIn": 3600
  }
  ```

## 🎨 Features

- ✅ User authentication (email/password)
- ✅ AWS connection management (IAM Role + External ID)
- ✅ S3 bucket listing
- ✅ S3 object listing
- ✅ Presigned URL generation for direct uploads
- ✅ Secure credential handling (no keys in DB)
- ✅ TypeScript strict mode
- ✅ Production-ready error handling

## 🏗️ Project Structure

```
├── app/
│   ├── api/
│   │   ├── auth/
│   │   │   ├── [...nextauth]/route.ts    # NextAuth handler
│   │   │   └── signup/route.ts           # User registration
│   │   ├── aws/
│   │   │   └── verify/route.ts            # Verify IAM Role
│   │   └── s3/
│   │       ├── buckets/route.ts          # List buckets
│   │       ├── objects/route.ts          # List objects
│   │       └── presigned-url/route.ts    # Generate presigned URLs
│   ├── auth/
│   │   ├── signin/page.tsx               # Sign in page
│   │   └── signup/page.tsx               # Sign up page
│   ├── buckets/[bucket]/page.tsx         # Bucket detail page
│   └── page.tsx                          # Dashboard
├── components/
│   ├── aws-connection-form.tsx           # AWS connection form
│   ├── bucket-list.tsx                   # Bucket list component
│   └── providers.tsx                     # NextAuth SessionProvider
├── lib/
│   ├── auth.ts                           # NextAuth configuration
│   ├── aws.ts                            # AWS STS/S3 utilities
│   └── prisma.ts                         # Prisma client singleton
├── prisma/
│   └── schema.prisma                     # Database schema
└── types/
    └── next-auth.d.ts                    # NextAuth type extensions
```

## 🔐 Security Best Practices

1. **Never store AWS credentials in database** - Only `roleArn` and `externalId`
2. **Use environment variables** - Store base AWS credentials in Vercel environment variables
3. **Rotate credentials** - Regularly rotate base AWS credentials
4. **Principle of least privilege** - Grant minimal required S3 permissions to IAM roles
5. **Use External IDs** - Always require external ID for cross-account access
6. **Monitor CloudTrail** - Enable CloudTrail to audit AssumeRole calls
7. **Set expiration** - Temporary credentials expire after 1 hour (configurable)

## 🚢 Deployment (Vercel)

1. Push code to GitHub
2. Import project in Vercel
3. Add environment variables in Vercel dashboard
4. Deploy

**Required Vercel Environment Variables:**
- `DATABASE_URL`
- `NEXTAUTH_URL` (e.g., `https://your-app.vercel.app`)
- `NEXTAUTH_SECRET`
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_REGION`

## 🧪 Testing

```bash
# Run linter
npm run lint

# Type check
npx tsc --noEmit

# Database migrations
npx prisma migrate dev
```

## 📝 License

MIT

## 🤝 Contributing

This is a production-ready reference implementation. Feel free to fork and customize for your needs.

## ⚠️ Important Notes

- **Production readiness**: This code is production-grade but should be reviewed for your specific security requirements
- **Database**: Uses PostgreSQL - ensure proper backups and connection pooling in production
- **Rate limiting**: Consider adding rate limiting for API endpoints
- **Monitoring**: Add logging/monitoring (e.g., Sentry, DataDog) for production
- **HTTPS**: Always use HTTPS in production (Vercel provides this automatically)
