$ErrorActionPreference = 'Stop'

$repo = Split-Path -Parent $PSScriptRoot
$env:Path = "$(Join-Path $repo 'backend\node_modules\.bin');$env:Path"
Push-Location $repo
try {
  npm run build
  Push-Location $PSScriptRoot
  try {
    sam build
    sam deploy
  } finally {
    Pop-Location
  }

  $outputs = aws cloudformation describe-stacks --stack-name scion-production --region eu-west-1 --query 'Stacks[0].Outputs' --output json | ConvertFrom-Json
  $bucket = ($outputs | Where-Object OutputKey -eq 'FrontendBucketName').OutputValue
  $distribution = ($outputs | Where-Object OutputKey -eq 'DistributionId').OutputValue
  $migration = ($outputs | Where-Object OutputKey -eq 'MigrationFunctionName').OutputValue

  aws lambda invoke --function-name $migration --region eu-west-1 --cli-binary-format raw-in-base64-out --payload '{}' "$env:TEMP\scion-migration.json" | Out-Null
  aws s3 sync dist "s3://$bucket" --delete --region eu-west-1
  aws cloudfront create-invalidation --distribution-id $distribution --paths '/*' | Out-Null
  ($outputs | Where-Object OutputKey -eq 'SiteUrl').OutputValue
} finally {
  Pop-Location
}
