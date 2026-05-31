# CDK Cleanup Edge Function

Supabase Edge Function for scheduled CDK inventory cleanup operations.

## Overview

This function handles two cleanup operations:
- **Timeout Cleanup**: Releases CDK codes reserved for more than 15 minutes and cancels associated pending orders (Requirements: 6.1, 6.5)
- **Orphan Cleanup**: Releases CDK codes with no valid associated order (Requirement: 6.6)

## Deployment

### 1. Deploy the Edge Function

```bash
cd store-frontend
supabase functions deploy cdk-cleanup
```

### 2. Set up Scheduled Invocation

You have two options for scheduling:

#### Option A: Using pg_cron (Recommended)

Run the following SQL in your Supabase SQL Editor:

```sql
-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule timeout cleanup every 5 minutes
SELECT cron.schedule(
  'cdk-timeout-cleanup',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/cdk-cleanup',
    headers := jsonb_build_object(
      'Authorization', 'Bearer <ANON_KEY>',
      'Content-Type', 'application/json'
    ),
    body := '{"action": "timeout"}'::jsonb
  )
  $$
);

-- Schedule orphan cleanup every hour
SELECT cron.schedule(
  'cdk-orphan-cleanup',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/cdk-cleanup',
    headers := jsonb_build_object(
      'Authorization', 'Bearer <ANON_KEY>',
      'Content-Type', 'application/json'
    ),
    body := '{"action": "orphan"}'::jsonb
  )
  $$
);
```

Replace:
- `<PROJECT_REF>` with your Supabase project reference
- `<ANON_KEY>` with your project's anon key

#### Option B: Using External Cron Service

Use services like:
- [cron-job.org](https://cron-job.org)
- [EasyCron](https://www.easycron.com)
- GitHub Actions scheduled workflows

Configure them to call:
- `POST https://<PROJECT_REF>.supabase.co/functions/v1/cdk-cleanup`
- With header: `Authorization: Bearer <ANON_KEY>`
- With body: `{"action": "timeout"}` or `{"action": "orphan"}`

## API

### Endpoint

`POST /functions/v1/cdk-cleanup`

### Request Body

```json
{
  "action": "timeout" | "orphan" | "all"
}
```

- `timeout`: Run timeout cleanup only
- `orphan`: Run orphan cleanup only
- `all`: Run both cleanups (default)

### Response

```json
{
  "success": true,
  "action": "all",
  "results": {
    "timeout": {
      "releasedCount": 5,
      "cancelledOrders": ["order-id-1", "order-id-2"],
      "errors": []
    },
    "orphan": {
      "releasedCount": 2,
      "cancelledOrders": [],
      "errors": []
    }
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

## Manual Testing

```bash
# Test timeout cleanup
curl -X POST 'https://<PROJECT_REF>.supabase.co/functions/v1/cdk-cleanup' \
  -H 'Authorization: Bearer <ANON_KEY>' \
  -H 'Content-Type: application/json' \
  -d '{"action": "timeout"}'

# Test orphan cleanup
curl -X POST 'https://<PROJECT_REF>.supabase.co/functions/v1/cdk-cleanup' \
  -H 'Authorization: Bearer <ANON_KEY>' \
  -H 'Content-Type: application/json' \
  -d '{"action": "orphan"}'

# Test both cleanups
curl -X POST 'https://<PROJECT_REF>.supabase.co/functions/v1/cdk-cleanup' \
  -H 'Authorization: Bearer <ANON_KEY>' \
  -H 'Content-Type: application/json' \
  -d '{"action": "all"}'
```

## Monitoring

### View Scheduled Jobs

```sql
SELECT * FROM cron.job;
```

### View Job Run History

```sql
SELECT * FROM cron.job_run_details 
ORDER BY start_time DESC 
LIMIT 20;
```

### Unschedule Jobs

```sql
SELECT cron.unschedule('cdk-timeout-cleanup');
SELECT cron.unschedule('cdk-orphan-cleanup');
```

## Environment Variables

The function uses these environment variables (automatically provided by Supabase):
- `SUPABASE_URL`: Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY`: Service role key for admin operations

## Troubleshooting

### Function not executing

1. Check if the function is deployed: `supabase functions list`
2. Verify cron jobs are scheduled: `SELECT * FROM cron.job;`
3. Check function logs in Supabase Dashboard

### Codes not being released

1. Verify `reserved_at` timestamps are being set correctly
2. Check if codes have valid `order_id` associations
3. Review audit logs: `SELECT * FROM cdk_audit_logs ORDER BY created_at DESC LIMIT 20;`

### Orders not being cancelled

1. Verify orders are in `pending` status
2. Check for database permission issues
3. Review function logs for errors
