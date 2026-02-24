# Quick Setup Guide

## Step-by-Step Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Setup Environment Variables
```bash
# Copy example file
cp .env.example .env

# Edit .env and fill in:
# - DATABASE_URL (PostgreSQL connection string)
# - NEXTAUTH_SECRET (generate with: openssl rand -base64 32)
# - NEXTAUTH_URL (http://localhost:3000 for dev)
# - AWS_ACCESS_KEY_ID (base AWS credentials)
# - AWS_SECRET_ACCESS_KEY (base AWS credentials)
# - AWS_REGION (e.g., us-east-1)
```

### 3. Setup Database
```bash
# Generate Prisma Client
npx prisma generate

# Create database migration
npx prisma migrate dev --name init

# (Optional) Open Prisma Studio to view data
npx prisma studio
```

### 4. Run Development Server
```bash
npm run dev
```

Visit http://localhost:3000

### 5. Create First User
1. Click "Sign Up"
2. Enter email and password
3. Sign in

### 6. Connect AWS Account
1. In AWS Console, create an IAM Role:
   - Trust another AWS account
   - Enter your base AWS account ID
   - Enable "Require external ID"
   - Attach S3 read permissions
   - Copy the Role ARN

2. In the app:
   - Enter Role ARN (e.g., `arn:aws:iam::123456789012:role/S3HelperRole`)
   - Enter External ID (must match the one in trust policy)
   - Optional: Add a friendly name
   - Click "Verify & Connect"

### 7. View Buckets
- After successful connection, buckets will appear automatically
- Click "View" on any bucket to see objects

## Troubleshooting

### "Module '@prisma/client' has no exported member"
**Solution**: Run `npx prisma generate`

### "Failed to assume role"
**Check**:
- Base AWS credentials are correct in `.env`
- Base account has `sts:AssumeRole` permission
- Role ARN format is correct
- External ID matches trust policy
- Trust policy allows your base account

### "No buckets found"
**Check**:
- IAM role has S3 read permissions
- Buckets exist in the target AWS account
- Region is correct

### Database Connection Issues
**Check**:
- PostgreSQL is running
- DATABASE_URL is correct
- Database exists
- User has proper permissions

## Next Steps

- Review `SECURITY.md` for security best practices
- Configure AWS IAM roles with least privilege
- Set up CloudTrail for audit logging
- Deploy to Vercel (see README.md)
