import { AuditRepository } from "../repositories/audit.repository";

export const handler = async (event: any) => {
    console.log("FAIL AUDIT");
    console.log(JSON.stringify(event));

    const auditJobId = event.auditJobId ?? event.audit?.id;

    if (!auditJobId) {
        console.error("FAIL AUDIT: no se pudo determinar auditJobId, no se puede marcar el error", event);
        return event;
    }

    const errorMessage =
        event.error?.Cause ??
        event.error?.Error ??
        "Error desconocido en el workflow de auditoría.";

    await AuditRepository.fail(auditJobId, errorMessage);

    return event;
};
