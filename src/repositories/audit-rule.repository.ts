import { db } from "../database/postgres";

export class AuditRuleRepository {

    static async loadMap(): Promise<Map<string,string>>{

        const result = await db.query(`
            SELECT
                id,
                code
            FROM audit_rules
        `);

        const map = new Map<string,string>();

        for(const row of result.rows){

            map.set(
                row.code,
                row.id
            );

        }

        return map;

    }

}