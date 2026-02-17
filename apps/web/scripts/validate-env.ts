/**
 * Production Environment Variable Validation Script
 *
 * Checks that all required environment variables are set for production deployment.
 * Prints warnings for recommended but optional variables.
 *
 * Usage:
 *   node --import tsx apps/web/scripts/validate-env.ts
 *
 * Exit codes:
 *   0 - All required variables present
 *   1 - One or more required variables missing
 */

const REQUIRED_VARS: { name: string; description: string }[] = [
    { name: 'INTERNAL_API_URL', description: 'SSR API URL (e.g. http://angple-api:8081/api/v2)' },
    { name: 'DB_HOST', description: 'Database host' },
    { name: 'DB_USER', description: 'Database user' },
    { name: 'DB_PASSWORD', description: 'Database password' },
    { name: 'DB_NAME', description: 'Database name' },
    { name: 'NODE_ENV', description: 'Should be "production"' }
];

const RECOMMENDED_VARS: { name: string; description: string }[] = [
    { name: 'VITE_SITE_NAME', description: 'Site branding name displayed in UI' },
    { name: 'PUBLIC_TURNSTILE_SITE_KEY', description: 'Cloudflare Turnstile CAPTCHA site key' },
    { name: 'TURNSTILE_SECRET_KEY', description: 'Cloudflare Turnstile CAPTCHA secret key' },
    { name: 'VITE_GAM_NETWORK_CODE', description: 'Google Ad Manager network code' },
    { name: 'VITE_ADSENSE_CLIENT', description: 'Google AdSense client ID' }
];

function validate(): boolean {
    console.log('=== Angple Production Environment Validation ===\n');

    // Check required variables
    const missingRequired: { name: string; description: string }[] = [];

    for (const v of REQUIRED_VARS) {
        const value = process.env[v.name];
        if (!value || value.trim() === '') {
            missingRequired.push(v);
            console.log(`  [MISSING]  ${v.name} - ${v.description}`);
        } else {
            console.log(`  [OK]       ${v.name}`);
        }
    }

    // Warn if NODE_ENV is set but not "production"
    const nodeEnv = process.env['NODE_ENV'];
    if (nodeEnv && nodeEnv !== 'production') {
        console.log(`\n  [WARN] NODE_ENV is "${nodeEnv}", expected "production"`);
    }

    console.log('');

    // Check recommended variables
    const missingRecommended: { name: string; description: string }[] = [];

    for (const v of RECOMMENDED_VARS) {
        const value = process.env[v.name];
        if (!value || value.trim() === '') {
            missingRecommended.push(v);
        }
    }

    if (missingRecommended.length > 0) {
        console.log('--- Optional (recommended) variables not set ---');
        for (const v of missingRecommended) {
            console.log(`  [WARN]     ${v.name} - ${v.description}`);
        }
        console.log('');
    }

    // Summary
    console.log('=================================================');

    if (missingRequired.length > 0) {
        console.log(`FAILED: ${missingRequired.length} required variable(s) missing.\n`);
        console.log('Missing required variables:');
        for (const v of missingRequired) {
            console.log(`  - ${v.name}: ${v.description}`);
        }
        console.log('\nSet these variables in your .env.local or Docker environment.');
        return false;
    }

    console.log('SUCCESS: All required environment variables are set.');
    if (missingRecommended.length > 0) {
        console.log(
            `(${missingRecommended.length} optional variable(s) not set - see warnings above)`
        );
    }
    return true;
}

const passed = validate();
process.exit(passed ? 0 : 1);
