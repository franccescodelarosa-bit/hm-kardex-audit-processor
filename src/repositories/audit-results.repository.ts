import { db } from "../database/postgres";
import { Finding } from "../models/finding";

export class AuditResultRepository {

    static async saveAll(
        auditJobId: string,
        findings: Finding[],
        ruleMap: Map<string, string>
    ): Promise<void> {

        if (findings.length === 0) {
            return;
        }

        const client = await db.connect();

        try {

            await client.query("BEGIN");

            for (const finding of findings) {
                const ruleId = ruleMap.get(finding.ruleId);
                if (!ruleId) {
                    throw new Error(`Rule ${finding.ruleId} no existe.`);
                }
                await client.query(
                    `
                    INSERT INTO audit_results
                    (
                        audit_job_id,
                        rule_id,
                        month,
                        product_code,
                        product_name,
                        error_type,
                        description,
                        recommendation,
                        risk_level,
                        metadata
                    )
                    VALUES
                    (
                        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10
                    )
                    `,
                    [
                        auditJobId,
                        ruleId,
                        this.getMonth(finding),
                        finding.productCode,
                        finding.productName,
                        finding.errorType,
                        finding.description,
                        finding.recommendation,
                        finding.riskLevel,
                        JSON.stringify(finding.metadata ?? {})
                    ]
                );

            }

            await client.query("COMMIT");

        } catch (error) {

            await client.query("ROLLBACK");
            throw error;

        } finally {

            client.release();

        }

    }

    private static getMonth(finding: Finding): number | null {

        const metadata: any = finding.metadata;

        return (
            metadata?.month ??
            metadata?.currentMonth ??
            metadata?.fromMonth ??
            null
        );

    }

}