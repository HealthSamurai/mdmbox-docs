# Monitoring

MDMbox exposes Prometheus metrics at `GET /metrics` on a separate HTTP port. The listener is enabled by default on `127.0.0.1:9464`. The endpoint does not require authentication, so expose it only to trusted monitoring systems.

| Variable | Description | Default |
| --- | --- | --- |
| `MDMBOX_METRICS_ENABLED` | Enable the metrics listener. | `true` |
| `MDMBOX_METRICS_HOST` | Address on which the metrics listener accepts connections. | `127.0.0.1` |
| `MDMBOX_METRICS_PORT` | Metrics listener port. | `9464` |

For a local instance, scrape `http://127.0.0.1:9464/metrics`. In Kubernetes, bind the listener to an address reachable from your monitoring system, expose port `9464` separately from the application API, and restrict access to your monitoring network.

Configure a Grafana Prometheus data source with UID `prometheus`, then import the [MDMbox Grafana dashboard](https://github.com/HealthSamurai/mdmbox/blob/main/monitoring/grafana/mdmbox.json). The dashboard shows request rate and status codes, latency percentiles by route, database pool usage, JVM heap and garbage collection. The **Most frequent route and status combinations** table ranks the method, route and status combinations by response count within the selected time range; **Top route and status rates** shows the busiest combinations per second.

To verify collection, request the metrics endpoint and confirm that the MDMbox target is **UP** in Prometheus.

The HTTP metrics are `mdmbox_http_requests_total`, `mdmbox_http_request_duration_seconds` and `mdmbox_http_requests_in_flight`. Completed requests are split by HTTP method, route template and exact response status code. For example, `/mdmbox/admin/models/123` and `/mdmbox/admin/models/123/` are labeled `/mdmbox/admin/models/:id`; individual resource IDs are never used as labels. Requests forwarded through the Aidbox App proxy use the forwarded method and route. Requests rejected before forwarding use the `/api/aidbox-app-proxy` label. Other unknown paths share the `unmatched` route label, without including their URI values. Datastar requests are included. An accepted SSE stream is recorded with its opening HTTP status, normally `200`; errors delivered later as SSE events do not change that HTTP status. Streaming downloads record the HTTP status when response headers are sent, including a `500` if the download fails before headers. Duration covers response setup for SSE requests and ends when headers are sent for streaming downloads; it does not include the lifetime of a stream.

Latency percentile panels show no data during the first five minutes after MDMbox starts or restarts.

The endpoint also reports JVM heap and non-heap usage, thread count, available processors, garbage collection totals, and active, idle, total and pending connections for the API and bulk matching database pools. Metrics are process-local and reset when the instance restarts.

See [Kubernetes deployment](deployment/kubernetes.md) for chart setup and [Configuration reference](config-reference.md) for other runtime settings.
