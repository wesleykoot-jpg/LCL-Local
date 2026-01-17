const pushgatewayUrl = process.env.PUSHGATEWAY_URL ?? 'http://localhost:9091/metrics/job/lcl-sim'

const now = Math.floor(Date.now() / 1000)

const metrics = `
external_requests_total{service="openai",host="api.openai.com",endpoint="/v1",method="POST",environment="prod",region="eu",result_code="200"} 1000
external_requests_total{service="openai",host="api.openai.com",endpoint="/v1",method="POST",environment="prod",region="eu",result_code="429"} 25
external_429_total{service="openai",host="api.openai.com",environment="prod"} 25
external_5xx_total{service="openai",host="api.openai.com",environment="prod"} 5
external_rate_limit_remaining{service="openai",host="api.openai.com",environment="prod"} 40
external_rate_limit_reset_ts{service="openai",host="api.openai.com",environment="prod"} ${now + 1800}
external_rate_limit_retry_after_seconds{service="openai",host="api.openai.com",environment="prod"} 2
external_request_duration_seconds_bucket{service="openai",host="api.openai.com",endpoint="/v1",method="POST",environment="prod",region="eu",le="0.5"} 400
external_request_duration_seconds_bucket{service="openai",host="api.openai.com",endpoint="/v1",method="POST",environment="prod",region="eu",le="1"} 900
external_request_duration_seconds_bucket{service="openai",host="api.openai.com",endpoint="/v1",method="POST",environment="prod",region="eu",le="+Inf"} 1000
external_request_duration_seconds_sum{service="openai",host="api.openai.com",endpoint="/v1",method="POST",environment="prod",region="eu"} 450
external_request_duration_seconds_count{service="openai",host="api.openai.com",endpoint="/v1",method="POST",environment="prod",region="eu"} 1000

token_usage_total{service="openai",model="gpt-4o-mini",org="default",environment="prod"} 800000

tokens_monthly_quota{service="openai",org="default",environment="prod"} 1000000

db_connections_current{db="supabase",environment="prod"} 75

db_connections_limit{db="supabase",environment="prod"} 100

queue_depth{queue_name="extraction",environment="prod"} 600
worker_count{queue_name="extraction",environment="prod"} 12

last_success_timestamp{scraper_domain="example.com",environment="prod"} ${now - 300}

scraper_domain_concurrency{domain="example.com",environment="prod"} 2
`

const pushMetrics = async () => {
  const response = await fetch(pushgatewayUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: metrics,
  })

  if (!response.ok) {
    const text = await response.text()
    console.error('Pushgateway error:', response.status, text)
    process.exit(1)
  }

  console.log('Synthetic metrics pushed to', pushgatewayUrl)
}

pushMetrics().catch((error) => {
  console.error('Failed to push metrics', error)
  process.exit(1)
})
