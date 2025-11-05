#!/usr/bin/env node

/**
 * Comprehensive Code Analysis Script
 * Searches for common bugs, antipatterns, and issues
 */

const fs = require('fs');
const path = require('path');

const issues = [];

function analyzeFile(filePath, content) {
  const lines = content.split('\n');

  lines.forEach((line, index) => {
    const lineNum = index + 1;

    // Check for missing await on promises
    if (line.match(/=\s*fetch\(/) && !line.match(/await\s+fetch\(/)) {
      issues.push({
        file: filePath,
        line: lineNum,
        severity: 'HIGH',
        type: 'Missing await',
        message: 'fetch() called without await',
        code: line.trim()
      });
    }

    // Check for unhandled promise rejections
    if (line.match(/\.then\(/) && !line.match(/\.catch\(/)) {
      const nextLines = lines.slice(index, index + 5).join('\n');
      if (!nextLines.match(/\.catch\(/)) {
        issues.push({
          file: filePath,
          line: lineNum,
          severity: 'MEDIUM',
          type: 'Unhandled promise',
          message: '.then() without .catch()',
          code: line.trim()
        });
      }
    }

    // Check for == instead of ===
    if (line.match(/[^=!]={2}[^=]/) && !line.match(/\/\/|\/\*/)) {
      issues.push({
        file: filePath,
        line: lineNum,
        severity: 'LOW',
        type: 'Loose equality',
        message: 'Use === instead of ==',
        code: line.trim()
      });
    }

    // Check for var instead of let/const
    if (line.match(/^\s*var\s+/) && !line.match(/\/\/|\/\*/)) {
      issues.push({
        file: filePath,
        line: lineNum,
        severity: 'LOW',
        type: 'var usage',
        message: 'Use let or const instead of var',
        code: line.trim()
      });
    }

    // Check for missing try-catch around JSON.parse
    if (line.match(/JSON\.parse\(/) && !line.match(/try|catch/)) {
      const prevLines = lines.slice(Math.max(0, index - 2), index).join('\n');
      if (!prevLines.match(/try\s*{/)) {
        issues.push({
          file: filePath,
          line: lineNum,
          severity: 'MEDIUM',
          type: 'Unprotected JSON.parse',
          message: 'JSON.parse() without try-catch',
          code: line.trim()
        });
      }
    }

    // Check for console.log (should use logger in production)
    if (line.match(/console\.log\(/) && !line.match(/\/\/|\/\*/) && !filePath.includes('test')) {
      issues.push({
        file: filePath,
        line: lineNum,
        severity: 'INFO',
        type: 'console.log',
        message: 'console.log found (consider using logger)',
        code: line.trim()
      });
    }

    // Check for potential XSS with innerHTML
    if (line.match(/\.innerHTML\s*=/) && !line.match(/\/\/|\/\*/)) {
      issues.push({
        file: filePath,
        line: lineNum,
        severity: 'HIGH',
        type: 'Potential XSS',
        message: 'innerHTML assignment (potential XSS)',
        code: line.trim()
      });
    }

    // Check for eval usage
    if (line.match(/\beval\(/) && !line.match(/\/\/|\/\*/)) {
      issues.push({
        file: filePath,
        line: lineNum,
        severity: 'CRITICAL',
        type: 'eval usage',
        message: 'eval() usage detected (security risk)',
        code: line.trim()
      });
    }

    // Check for missing null checks before property access
    if (line.match(/\w+\.\w+\.\w+/) && !line.match(/if|&&|\?\.|\|\|/)) {
      // Deep property access without optional chaining or null check
      issues.push({
        file: filePath,
        line: lineNum,
        severity: 'LOW',
        type: 'Potential null reference',
        message: 'Deep property access without null check',
        code: line.trim()
      });
    }
  });
}

// Scan JavaScript files
const jsFiles = [
  'data.js',
  'server.js',
  'database.js',
  'admin.js',
  'js/booking-app.js',
  'js/booking-form.js',
  'js/calendar.js',
  'js/edit-page.js',
  'js/bulk-booking.js',
  'js/single-room-booking.js',
  'js/shared/BaseCalendar.js',
  'js/shared/EditBookingComponent.js',
  'js/shared/validationUtils.js',
  'js/shared/emailService.js',
  'js/shared/priceCalculator.js'
];

console.log('🔍 Analyzing JavaScript files for potential issues...\n');

jsFiles.forEach(file => {
  const fullPath = path.join(__dirname, file);
  if (fs.existsSync(fullPath)) {
    const content = fs.readFileSync(fullPath, 'utf-8');
    analyzeFile(file, content);
  } else {
    console.log(`⚠️  File not found: ${file}`);
  }
});

// Group and display issues by severity
const grouped = {
  CRITICAL: issues.filter(i => i.severity === 'CRITICAL'),
  HIGH: issues.filter(i => i.severity === 'HIGH'),
  MEDIUM: issues.filter(i => i.severity === 'MEDIUM'),
  LOW: issues.filter(i => i.severity === 'LOW'),
  INFO: issues.filter(i => i.severity === 'INFO')
};

console.log('═══════════════════════════════════════════════════════════');
console.log('CODE ANALYSIS RESULTS');
console.log('═══════════════════════════════════════════════════════════\n');

if (grouped.CRITICAL.length > 0) {
  console.log(`🔴 CRITICAL ISSUES (${grouped.CRITICAL.length}):`);
  grouped.CRITICAL.slice(0, 10).forEach(issue => {
    console.log(`  ${issue.file}:${issue.line}`);
    console.log(`     Type: ${issue.type}`);
    console.log(`     ${issue.message}`);
    console.log(`     Code: ${issue.code}`);
    console.log('');
  });
}

if (grouped.HIGH.length > 0) {
  console.log(`🟠 HIGH PRIORITY (${grouped.HIGH.length}):`);
  grouped.HIGH.slice(0, 15).forEach(issue => {
    console.log(`  ${issue.file}:${issue.line} - ${issue.type}: ${issue.message}`);
  });
  console.log('');
}

if (grouped.MEDIUM.length > 0) {
  console.log(`🟡 MEDIUM PRIORITY (${grouped.MEDIUM.length}):`);
  console.log(`  Found ${grouped.MEDIUM.length} medium priority issues`);
  console.log('');
}

if (grouped.LOW.length > 0) {
  console.log(`🔵 LOW PRIORITY (${grouped.LOW.length}):`);
  console.log(`  Found ${grouped.LOW.length} low priority issues`);
  console.log('');
}

if (grouped.INFO.length > 0) {
  console.log(`ℹ️  INFO (${grouped.INFO.length}):`);
  console.log(`  Found ${grouped.INFO.length} informational items`);
  console.log('');
}

console.log('═══════════════════════════════════════════════════════════');
console.log(`TOTAL ISSUES: ${issues.length}`);
console.log('═══════════════════════════════════════════════════════════');

// Save detailed report
const report = {
  timestamp: new Date().toISOString(),
  totalIssues: issues.length,
  bySeverity: {
    critical: grouped.CRITICAL.length,
    high: grouped.HIGH.length,
    medium: grouped.MEDIUM.length,
    low: grouped.LOW.length,
    info: grouped.INFO.length
  },
  issues: issues
};

fs.writeFileSync(
  path.join(__dirname, 'code-analysis-report.json'),
  JSON.stringify(report, null, 2)
);

console.log('\n📄 Detailed report saved to: code-analysis-report.json');

process.exit(grouped.CRITICAL.length > 0 ? 1 : 0);
