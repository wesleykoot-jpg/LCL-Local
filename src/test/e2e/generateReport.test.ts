import { describe, it } from 'vitest';
import { E2EAuditDashboard, knownAuditFindings } from './auditDashboard';
import { writeFileSync } from 'fs';
import { resolve } from 'path';

/**
 * E2E Audit Report Generator
 * 
 * Generates comprehensive audit reports from all E2E tests
 */

describe('E2E Audit Report Generation', () => {
  it('should generate comprehensive audit report', () => {
    const dashboard = new E2EAuditDashboard();

    // Add all known findings
    for (const finding of knownAuditFindings) {
      dashboard.addResult(finding);
    }

    // Generate reports
    const markdownReport = dashboard.formatReportAsMarkdown();
    const jsonReport = dashboard.formatReportAsJSON();

    // Save reports to disk
    const outputDir = resolve(__dirname, '../../../');
    
    writeFileSync(
      resolve(outputDir, 'E2E_AUDIT_REPORT.md'),
      markdownReport
    );

    writeFileSync(
      resolve(outputDir, 'E2E_AUDIT_REPORT.json'),
      jsonReport
    );

    console.log('\n📊 E2E Audit Reports Generated:');
    console.log('   - E2E_AUDIT_REPORT.md');
    console.log('   - E2E_AUDIT_REPORT.json');
    console.log('\n' + markdownReport);
  });
});
