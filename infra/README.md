# Scion on AWS

The production foundation uses CloudFront + private S3 for the React app, HTTP API Gateway + Node.js 24 Lambda for the API, and a private single-AZ `db.t4g.micro` RDS PostgreSQL database. It intentionally has no NAT Gateway, load balancer, Aurora cluster, or multi-AZ database.

## Deploy

Requirements: authenticated AWS CLI, AWS SAM CLI, Node.js 24, and permission to create CloudFormation, IAM, Lambda, API Gateway, RDS, EC2 networking, S3, CloudFront, Secrets Manager, X-Ray, and optionally AWS Budgets resources.

```powershell
aws login
cd infra
sam validate --lint
.\deploy.ps1
```

To enable the `$25` monthly budget notifications, add `BillingAlertEmail=you@example.com` to `parameter_overrides` in `samconfig.toml`. AWS requires the recipient to verify that address.

The stack generates both the database password and Scion signing secret. Neither secret is committed or passed on the command line. The database is isolated in private subnets and accepts PostgreSQL only from the Lambda security group.

## Cost posture

The baseline paid resource is RDS. Lambda, API Gateway, S3, CloudFront, Secrets Manager, logs, and X-Ray remain usage-based. The stack uses one small ARM database, 20 GB fixed storage, one day of backups, and CloudFront Price Class 100. CloudFormation snapshots the database on deletion; retained snapshots and the retained versioned S3 bucket can continue to incur storage charges.
