# SSL Certificate Setup Guide

This guide covers SSL certificate setup for production deployment.

## Option 1: Cloudflare (Recommended)

1. **Add your domain to Cloudflare**
   - Create a Cloudflare account
   - Add your domain
   - Update nameservers at your domain registrar

2. **Configure SSL in Cloudflare**
   - Go to SSL/TLS → Overview
   - Set encryption mode to "Full (strict)"
   - Enable "Always Use HTTPS"

3. **Deploy to Vercel/Netlify**
   - Connect your repository
   - Add custom domain in platform settings
   - Platform will automatically provision SSL certificate

## Option 2: Let's Encrypt (Self-hosted)

If deploying to your own server with Docker:

```bash
# Install Certbot
sudo apt update
sudo apt install certbot python3-certbot-nginx

# Generate certificate
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Auto-renewal (add to crontab)
0 12 * * * /usr/bin/certbot renew --quiet
```

## Option 3: Vercel/Netlify Automatic SSL

Both platforms provide automatic SSL certificates:

### Vercel
1. Deploy your app to Vercel
2. Add custom domain in project settings
3. SSL certificate is automatically provisioned

### Netlify
1. Deploy your app to Netlify
2. Add custom domain in site settings
3. Enable HTTPS (automatic with custom domains)

## Local Development HTTPS

For local development with HTTPS:

```bash
# Install mkcert
npm install -g mkcert

# Create local certificate
mkcert localhost 127.0.0.1 ::1

# Update vite.config.ts
import { defineConfig } from 'vite'
import fs from 'fs'

export default defineConfig({
  server: {
    https: {
      key: fs.readFileSync('./localhost-key.pem'),
      cert: fs.readFileSync('./localhost.pem'),
    },
    port: 3000
  }
})
```

## Security Headers

Add these security headers to your deployment:

```javascript
// netlify.toml or _headers file
/*
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  X-XSS-Protection: 1; mode=block
  Referrer-Policy: strict-origin-when-cross-origin
  Strict-Transport-Security: max-age=31536000; includeSubDomains
```

## Recommended: Use Platform SSL

For this React application, the easiest approach is:

1. Deploy to Vercel, Netlify, or similar platform
2. Add your custom domain
3. SSL certificate is automatically provisioned and managed

This eliminates the need for manual certificate management and provides automatic renewals.