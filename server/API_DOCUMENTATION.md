# AudioTalents API Reference

The canonical Phase 2.7 API contract is maintained in [AUDIOTALENTS_API_CONTRACT.md](./AUDIOTALENTS_API_CONTRACT.md).

Authentication is email OTP based: register does not issue tokens until the user verifies email. OTP is never returned by the API. SMTP uses `MAIL_*` environment variables; if mail is not configured, register/resend return `SMTP_NOT_CONFIGURED`.

This file remains as the stable documentation entry point. The backend is still in-memory; MongoDB migration is intentionally deferred.
