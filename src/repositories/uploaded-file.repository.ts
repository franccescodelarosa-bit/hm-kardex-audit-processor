import { db } from "../database/postgres";
export class UploadedFileRepository {
    static async findByAuditId(auditId: string) {
        const { rows } = await db.query(
            `
            SELECT
                id,
                audit_job_id,
                file_type,
                month,
                file_name,
                s3_key,
                file_size
                status,
                uploaded_at,
                uploaded_by
            FROM uploaded_files
            WHERE audit_job_id = $1
            ORDER BY file_type
            `,
            [auditId]
        );
        return rows;
    }
}