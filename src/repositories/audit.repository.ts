import { db } from "../database/postgres";
export class AuditRepository {
    static async findById(id: string) {
        const result = await db.query(
            `
            SELECT *
            FROM audit_jobs
            WHERE id = $1
            `,
            [id]
        );
        return result.rows[0] ?? null;
    }
    static async complete(id: string): Promise<void> {
        await db.query(
            `
            UPDATE audit_jobs
            SET
                status = 'COMPLETED',
                completed_at = NOW()
            WHERE id = $1;
            `,
            [id]
        );
    }
}