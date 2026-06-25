import { UploadedFileRepository } from "../repositories/uploaded-file.repository";

export const handler = async (event: any) => {
    console.log("READ FILES");
    console.log(event);
    const audit = event.audit;
    if (!audit) {
        throw new Error("audit is required");
    }
    const files = await UploadedFileRepository.findByAuditId(audit.id);
    return {
        ...event,
        files
    };
};