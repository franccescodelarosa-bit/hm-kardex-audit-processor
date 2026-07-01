import fs from "fs";
import { S3Service } from "../services/s3.service";
import { InventoryParser } from "../parsers/inventory.parser";
import { TransitParser } from "../parsers/transit.parser";
import { KardexParser } from "../parsers/kardex.parser";
import { RuleEngine } from "../services/rule-engine.service";
import { AuditContext } from "../models/audit-context";
import { AuditContextRepository } from "../repositories/audit-context.repository";
import { AuditResultRepository } from "../repositories/audit-results.repository";
import { AuditRuleRepository } from "../repositories/audit-rule.repository";

export const handler = async (event: any) => {
    console.log("PARSE FILES");
    const context: AuditContext = {
        kardexKeys: []
    };
    const files = [...event.files];
    files.sort((a, b) => {    
        if (a.file_type !== "KARDEX" && b.file_type === "KARDEX") {
            return -1;
        }
        if (a.file_type === "KARDEX" && b.file_type !== "KARDEX") {
            return 1;
        }    
        if (a.file_type === "KARDEX" && b.file_type === "KARDEX") {
            return (a.month ?? 0) - (b.month ?? 0);
        }
        return 0;
    });
    console.log(event.files.map((f: any) => ({
        month: f.month,
        type: f.file_type,
        name: f.file_name
    })));
    for (const file of files) {
        let localPath: string | null = null;
        try {
            localPath = await S3Service.download(file);
            switch (file.file_type) {
                case "INITIAL_INVENTORY": {
                    const inventory = await InventoryParser.parse(localPath);
                    context.initialInventoryKey = await AuditContextRepository.saveSection(
                        event.auditJobId,
                        "initial-inventory",
                        inventory
                    );
                    break;
                }
                case "FINAL_INVENTORY": {
                    const inventory = await InventoryParser.parse(localPath);
                    context.finalInventoryKey = await AuditContextRepository.saveSection(
                        event.auditJobId,
                        "final-inventory",
                        inventory
                    );
                    break;
                }
                case "TRANSIT": {
                    const transit = await TransitParser.parse(localPath);
                    context.transitKey = await AuditContextRepository.saveSection(
                        event.auditJobId,
                        "transit",
                        transit
                    );
                    break;
                }
                case "KARDEX": {
                    const kardex = await KardexParser.parse(localPath);
                    const month = file.month?.toString().padStart(2, "0") ?? "00";
                    const key = await AuditContextRepository.saveSection(
                        event.auditJobId,
                        `kardex-${month}`,
                        kardex
                    );
                    context.kardexKeys.push(key);
                    break;
                }
                default:
                    console.log(`Skipping ${file.file_type}`);
            }
        } finally {
            if (localPath && fs.existsSync(localPath)) {
                fs.unlinkSync(localPath);
            }
        }
    }
    const contextKey = await AuditContextRepository.saveContext(
        event.auditJobId,
        context
    );
    // Reconstruir el contexto para ejecutar las reglas
    const auditData = {
        initialInventory: await AuditContextRepository.load(context.initialInventoryKey!),
        finalInventory: await AuditContextRepository.load(context.finalInventoryKey!),
        transit: await AuditContextRepository.load(context.transitKey!),
        kardex: [] as any[]
    };

    console.log(context.kardexKeys);

    for (const key of context.kardexKeys) {
        const products = await AuditContextRepository.load<any[]>(key);
        auditData.kardex.push(...products);
    }
    const ruleMap = await AuditRuleRepository.loadMap();

    const findings = RuleEngine.execute(auditData);
    console.log("======================================");
    console.log("AUDIT ENGINE");
    console.log("======================================");
    console.log(`Total Findings: ${findings.length}`);
    const summary = new Map<string, number>();
    for (const finding of findings) {
        summary.set(
            finding.ruleId,
            (summary.get(finding.ruleId) ?? 0) + 1
        );
    }
    for (const [rule, total] of summary) {
        console.log(`${rule}: ${total}`);
    }
    console.log("======================================");
    // Mostrar solo los primeros hallazgos
    console.log(JSON.stringify(findings.slice(0, 20), null, 2));
    
    await AuditResultRepository.saveAll(
        event.auditJobId,
        findings,
        ruleMap
    );
    return {
        auditJobId: event.auditJobId,
        contextKey
    };
};