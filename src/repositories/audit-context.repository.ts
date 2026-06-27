import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { AuditContext } from "../models/audit-context";
const s3 = new S3Client({ region: process.env.AWS_REGION || "us-east-1" });
export class AuditContextRepository {
    static async saveSection( auditJobId: string, section: string, data: any ): Promise<string> {
        const key = `audit-contexts/${auditJobId}/${section}.json`;
        await s3.send(
            new PutObjectCommand({
                Bucket: process.env.S3_BUCKET!,
                Key: key,
                Body: JSON.stringify(data),
                ContentType: "application/json"
            })
        );
        return key;
    }
    static async saveContext( auditJobId: string, context: AuditContext ): Promise<string> {
        const key = `audit-contexts/${auditJobId}/context.json`;
        await s3.send(
            new PutObjectCommand({
                Bucket: process.env.S3_BUCKET!,
                Key: key,
                Body: JSON.stringify(context),
                ContentType: "application/json"
            })
        );
        return key;
    }

    static async load<T = any>(key: string): Promise<T> {
        const response = await s3.send(
            new GetObjectCommand({
                Bucket: process.env.S3_BUCKET!,
                Key: key
            })
        );
        const text = await response.Body!.transformToString();
        return JSON.parse(text);
    }
}