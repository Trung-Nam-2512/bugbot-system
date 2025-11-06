#!/usr/bin/env node

/**
 * Verify Setup Script
 * Check if all dependencies and services are properly configured
 * Run: node scripts/verify-setup.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🔍 Verifying IoT Platform Setup...\n');

let hasErrors = false;
let hasWarnings = false;

// Colors for terminal
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
};

function success(msg) {
    console.log(`${colors.green}✅ ${msg}${colors.reset}`);
}

function error(msg) {
    console.log(`${colors.red}❌ ${msg}${colors.reset}`);
    hasErrors = true;
}

function warning(msg) {
    console.log(`${colors.yellow}⚠️  ${msg}${colors.reset}`);
    hasWarnings = true;
}

function info(msg) {
    console.log(`${colors.blue}ℹ️  ${msg}${colors.reset}`);
}

// Check Node.js version
function checkNodeVersion() {
    const version = process.version;
    const major = parseInt(version.slice(1).split('.')[0]);
    
    if (major >= 18) {
        success(`Node.js version: ${version}`);
    } else {
        error(`Node.js version ${version} is too old. Need v18 or higher.`);
    }
}

// Check npm
function checkNpm() {
    try {
        const version = execSync('npm --version', { encoding: 'utf8' }).trim();
        success(`npm version: ${version}`);
    } catch (err) {
        error('npm not found. Please install Node.js with npm.');
    }
}

// Check Docker
function checkDocker() {
    try {
        const version = execSync('docker --version', { encoding: 'utf8' }).trim();
        success(`Docker: ${version}`);
    } catch (err) {
        error('Docker not found. Please install Docker Desktop.');
    }
}

// Check Docker Compose
function checkDockerCompose() {
    try {
        const version = execSync('docker-compose --version', { encoding: 'utf8' }).trim();
        success(`Docker Compose: ${version}`);
    } catch (err) {
        error('Docker Compose not found. Please install Docker Desktop.');
    }
}

// Check if node_modules exists
function checkNodeModules() {
    const nodeModulesPath = path.join(process.cwd(), 'node_modules');
    if (fs.existsSync(nodeModulesPath)) {
        success('node_modules directory exists');
        
        // Check critical packages
        const criticalPackages = ['express', 'kafkajs', 'minio', '@clickhouse/client', 'mongodb', 'pino', 'zod'];
        criticalPackages.forEach(pkg => {
            const pkgPath = path.join(nodeModulesPath, pkg);
            if (fs.existsSync(pkgPath)) {
                success(`  ✓ ${pkg} installed`);
            } else {
                error(`  ✗ ${pkg} not installed`);
            }
        });
    } else {
        error('node_modules not found. Run: npm install');
    }
}

// Check .env file
function checkEnvFile() {
    const envPath = path.join(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
        success('.env file exists');
    } else {
        warning('.env file not found. Copy from env.sample: cp env.sample .env');
    }
}

// Check infrastructure files
function checkInfrastructure() {
    const infraFiles = [
        'infra/docker-compose.yml',
        'infra/clickhouse/init/01-create-tables.sql',
        'infra/mongodb/init/01-init.js',
    ];
    
    let allExist = true;
    infraFiles.forEach(file => {
        const filePath = path.join(process.cwd(), file);
        if (fs.existsSync(filePath)) {
            success(`  ✓ ${file}`);
        } else {
            error(`  ✗ ${file} not found`);
            allExist = false;
        }
    });
    
    if (allExist) {
        success('All infrastructure files present');
    }
}

// Check Docker containers
function checkDockerContainers() {
    try {
        const output = execSync('docker ps --format "{{.Names}}" 2>/dev/null || echo ""', { encoding: 'utf8' });
        const containers = output.trim().split('\n').filter(Boolean);
        
        const requiredContainers = ['redpanda', 'minio', 'clickhouse', 'mongodb'];
        const runningRequired = requiredContainers.filter(c => containers.includes(c));
        
        if (runningRequired.length === requiredContainers.length) {
            success(`All required containers running: ${runningRequired.join(', ')}`);
        } else {
            const missing = requiredContainers.filter(c => !containers.includes(c));
            warning(`Some containers not running: ${missing.join(', ')}`);
            info('Start infrastructure: npm run dev:infra');
        }
    } catch (err) {
        warning('Could not check Docker containers. Is Docker running?');
    }
}

// Check ports availability
function checkPorts() {
    const ports = [1435, 19092, 9000, 9001, 8123, 27017];
    info('Checking if required ports are available...');
    
    // This is a basic check, may not work on all systems
    try {
        const netstat = execSync('netstat -an 2>/dev/null || ss -an 2>/dev/null || echo ""', { encoding: 'utf8' });
        
        ports.forEach(port => {
            if (netstat.includes(`:${port}`)) {
                info(`  Port ${port}: In use (OK if services are running)`);
            } else {
                info(`  Port ${port}: Available`);
            }
        });
    } catch (err) {
        info('Could not check ports. This is normal on some systems.');
    }
}

// Main verification
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('📋 System Requirements');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

checkNodeVersion();
checkNpm();
checkDocker();
checkDockerCompose();

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('📦 Project Dependencies');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

checkNodeModules();

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🔧 Configuration Files');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

checkEnvFile();
checkInfrastructure();

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🐳 Docker Services');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

checkDockerContainers();
checkPorts();

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('📊 Summary');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

if (hasErrors) {
    console.log(`${colors.red}❌ Setup has errors. Please fix them before proceeding.${colors.reset}\n`);
    process.exit(1);
} else if (hasWarnings) {
    console.log(`${colors.yellow}⚠️  Setup has warnings. Review them and continue if OK.${colors.reset}\n`);
    console.log('Next steps:');
    console.log('  1. npm install (if not done)');
    console.log('  2. cp env.sample .env (if not done)');
    console.log('  3. npm run dev:infra');
    console.log('  4. npm run kafka:create-topics');
    console.log('  5. npm run sql:init');
    console.log('  6. npm run dev\n');
} else {
    console.log(`${colors.green}✅ All checks passed! System ready.${colors.reset}\n`);
    console.log('To start the application:');
    console.log('  npm run dev\n');
    console.log('Health check:');
    console.log('  curl http://localhost:1435/api/health\n');
}

console.log('For detailed instructions, see:');
console.log('  📖 README.md');
console.log('  🚀 QUICK_START.md\n');

