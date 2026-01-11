# Security Policy

## Known Vulnerabilities

### Moderate: esbuild Development Server Vulnerability (GHSA-67mh-4wv8-2f99)

**Status**: Known issue, development-only impact  
**Severity**: Moderate (CVSS 5.3)  
**Affected**: esbuild <=0.24.2 (via vite 5.x)

**Description**: 
esbuild's development server allows any website to send requests to the dev server and read responses. This is a CORS-related issue that only affects local development environments.

**Impact**: 
- Only affects development server (`npm run dev`)
- Does NOT affect production builds (`npm run build`)
- Requires attacker to have network access to the development server

**Mitigation**:
1. Only run development server on trusted networks
2. Do not expose development server to the internet
3. Use firewall rules to restrict access to localhost only

**Fix Available**: 
Upgrading to vite 7.x would resolve this issue, but it's a breaking change that requires:
- Major version updates to multiple dependencies
- React 19 compatibility testing
- Potential breaking changes in Vite plugin ecosystem

**Recommendation**: 
Accept this risk for now as it only affects development environments. Plan upgrade to vite 7.x in a future major release cycle.

## Reporting a Vulnerability

If you discover a security vulnerability, please email the maintainers or open a private security advisory on GitHub.

## Security Best Practices

1. Never commit `.env` files or expose API keys
2. Always validate user input on both client and server
3. Use the latest stable versions of dependencies when possible
4. Review code changes for potential security issues
5. Run `npm audit` regularly to check for new vulnerabilities
