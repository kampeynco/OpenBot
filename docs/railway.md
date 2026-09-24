# Railway single-container deployment

Use the repository-root Dockerfile for one `server` service. Leave custom build
and start commands empty, expose port 3001, and use `/health` as the health check.
The built app and API share one origin; no separate frontend service is needed.

Mount a persistent volume at `/var/lib/postgresql`, then set:

```text
EMBEDDED_POSTGRES=on
OPENBOT_COMPUTER_DATA_DIR=/var/lib/postgresql/openbot
EMBEDDED_WORKER=on
```

The database stays on loopback. Its migrations run before the API starts.
`OPENBOT_COMPUTER_DATA_DIR` preserves `/workspace` and `/profiles` on the same
volume. Startup refuses to replace a nonempty directory; when migrating an
existing deployment, copy its files to persistent storage before redeploying.

`EMBEDDED_WORKER=on` starts the existing routine worker under s6, with the same
database and `WORKER_SHARED_SECRET` as the API. It also runs the existing cleanup
script hourly for unsent attachments older than 24 hours. Leave the standalone
Railway worker stopped when using this mode. These jobs are disabled by default.

Configure the production credentials and identity provider in
[deployment.md](deployment.md). Set `BETTER_AUTH_URL`, `OPENBOT_PUBLIC_URL`,
`OPENBOT_APP_URL`, and `TRUSTED_ORIGINS` to the same public HTTPS origin. For Google,
register `<origin>/api/auth/callback/google` and set `INITIAL_ADMIN_EMAILS`.
Never enable the single-user bypass on the public endpoint.

Keep one replica when using embedded PostgreSQL. Browser sessions are shared
between coworkers in this image. A separate computer per coworker requires the
supervisor and a host that can run its containers.
