import fs from "fs";
import { S3Service } from "../services/s3.service";
export const handler = async (event: any) => {
    console.log("DOWNLOAD FILES");
    console.log(JSON.stringify(event, null, 2));
    const files = event.files;
    if (!files || files.length === 0) {
        throw new Error("No files found.");
    }
    const localFiles = await S3Service.download(files);
    console.log("========== TMP ==========");
    console.log(fs.readdirSync("/tmp"));
    console.log("=========================");
    return {
        ...event,
        localFiles
    };
};