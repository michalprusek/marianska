# SMTP Connectivity Verification Guide

## Overview

The Chata Mariánská booking system uses SMTP to send booking confirmation emails via `hermes.utia.cas.cz:25`.

## Production Verification

### 1. Verify from Docker Container

```bash
# Enter the running web container
docker-compose exec web sh

# Test SMTP connectivity
telnet hermes.utia.cas.cz 25

# Expected output:
# Trying 147.231.12.5...
# Connected to hermes.utia.cas.cz.
# 220 hermes.utia.cas.cz ESMTP
```

If connection fails, check:

- Firewall rules on the server
- Network connectivity to hermes.utia.cas.cz
- DNS resolution

### 2. Verify Email Service Status

Check Docker logs for email service initialization:

```bash
docker-compose logs web | grep "Email service"
```

Expected output:

```
{"level":"INFO","component":"EmailService","message":"Email transporter initialized",...}
{"level":"INFO","component":"EmailService","message":"SMTP connection verified successfully"}
{"level":"INFO","component":"Server","message":"Email service ready"}
```

### 3. Send Test Email (Admin Panel)

1. Login to admin panel: http://chata.utia.cas.cz/admin.html
2. Navigate to "Nastavení systému" tab
3. Use "Test Email" feature
4. Enter a valid UTIA email address (e.g., `your-email@utia.cas.cz`)
5. Click "Odeslat testovací email"

Expected response:

```json
{
  "success": true,
  "message": "Testovací email byl odeslán",
  "messageId": "<message-id@hermes.utia.cas.cz>"
}
```

## Configuration

Email settings are configured in `.env`:

```bash
SMTP_HOST=hermes.utia.cas.cz
SMTP_PORT=25
SMTP_SECURE=false
EMAIL_FROM=noreply@chata.utia.cas.cz
APP_URL=http://chata.utia.cas.cz
```

**Note**: No SMTP authentication required (internal network).

## Troubleshooting

### Email Not Sending

**Check 1**: Verify SMTP connection

```bash
docker-compose exec web node tests/test-email-demo.js
```

**Check 2**: Check email service logs

```bash
docker-compose logs web | grep -i email
```

**Check 3**: Verify DNS resolution

```bash
docker-compose exec web nslookup hermes.utia.cas.cz
```

### Rate Limiting

The test email endpoint is rate-limited to **10 emails per hour** per IP address.

If rate limit exceeded:

```json
{
  "error": "Překročen limit pro odesílání testovacích emailů. Zkuste to za hodinu."
}
```

Wait 1 hour or restart Docker containers to reset the limit.

## Testing Tools

### Test Email Demo (No actual sending)

```bash
node tests/test-email-demo.js
```

Shows configuration and verifies SMTP connection without sending.

### Test Email Send (Actual email)

```bash
node tests/test-email.js your-email@utia.cas.cz
```

Sends a real test email to the specified address.

## Security Notes

- SMTP traffic is **unencrypted** (port 25, no TLS)
- Only internal network traffic (chata.utia.cas.cz ↔ hermes.utia.cas.cz)
- If routing emails outside UTIA network, consider using TLS/SSL
- Edit tokens in emails are 30 characters long and cryptographically secure
- Rate limiting prevents email spam abuse

## Monitoring

Email delivery status is logged:

```bash
# Success
{"level":"INFO","component":"EmailService","message":"Booking confirmation email sent",...}

# Failure
{"level":"ERROR","component":"EmailService","message":"Failed to send booking confirmation email",...}
```

Monitor these logs for email delivery issues.
