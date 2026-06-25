import { AuditRepository } from "../repositories/audit.repository";
export const handler = async (event: any) => {
    console.log("READ AUDIT");
    console.log(event);
    const auditJobId = event.auditJobId;
    if (!auditJobId) {
        throw new Error("auditJobId is required");
    }
    const audit = await AuditRepository.findById(auditJobId);
    if (!audit) {
        throw new Error("Audit not found");
    }
    return {
        ...event,
        audit
    };
};