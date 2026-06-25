import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { createWriteStream } from "fs";
import { pipeline } from "stream/promises";
import path from "path";

const s3 = new S3Client({ region: process.env.AWS_REGION || "us-east-1" });
export class S3Service {
    static async download(files: any[]) {
        const localFiles = [];
        for (const file of files) {
            console.log(`⬇ Downloading ${file.file_name}`);
            const command = new GetObjectCommand({
                Bucket: process.env.S3_BUCKET!,
                Key: file.s3_key
            });
            const response = await s3.send(command);
            if (!response.Body) {
                throw new Error(`Empty body for ${file.file_name}`);
            }
            const localPath = path.join("/tmp", file.file_name);
            await pipeline(
                response.Body as NodeJS.ReadableStream,
                createWriteStream(localPath)
            );
            console.log(`✅ Downloaded ${file.file_name}`);
            localFiles.push({
                ...file,
                local_path: localPath
            });
        }
        return localFiles;
    }
}