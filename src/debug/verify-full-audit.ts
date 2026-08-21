
import fs from "fs";
import { InventoryParser } from "../parsers/inventory.parser";
import { KardexParser } from "../parsers/kardex.parser";
import { TransitParser } from "../parsers/transit.parser";
import { RuleEngine } from "../services/rule-engine.service";
import { AuditData } from "../models/audit-data";
import { Finding } from "../models/finding";

interface Manifest {
    year: number;
    initialInventory: string;
    finalInventory: string;
    transit: string;
    kardex: string[];
}

const TOTAL_RULES = 14;

function computeEconomicImpact(findings: Finding[]): number {
    let economicImpact = 0;
    for (const finding of findings) {
        const metadata: any = finding.metadata ?? {};
        switch (finding.ruleId) {
            case "RULE_001":
                economicImpact += Math.abs(
                    Number(metadata.inventoryTotalCost ?? 0) -
                    Number(metadata.kardexTotalCost ?? 0)
                );
                break;
            case "RULE_002":
            case "RULE_003":
            case "RULE_013":
            case "RULE_014":
                economicImpact += Math.abs(
                    Number(metadata?.difference?.totalCost ?? metadata?.difference ?? 0)
                );
                break;
            case "RULE_012":
                economicImpact += Math.abs(Number(metadata.difference ?? 0));
                break;
        }
        economicImpact = Number(economicImpact.toFixed(2));
    }
    return economicImpact;
}

/** Replica EXACTO el switch de audit-results.repository.ts::getFindings() del back. */
function computeRiskSummary(findings: Finding[]) {
    const summary = { critical: 0, high: 0, medium: 0, unmapped: 0 };
    for (const finding of findings) {
        const level = String(finding.riskLevel ?? "").toUpperCase();
        switch (level) {
            case "CRITICO":
            case "CRÍTICO":
                summary.critical++;
                break;
            case "ALTO":
                summary.high++;
                break;
            case "MEDIO":
                summary.medium++;
                break;
            default:
                summary.unmapped++;
        }
    }
    return summary;
}

async function main() {
    const manifestPath = process.argv[2];
    if (!manifestPath) {
        console.log("Uso: npx ts-node src/debug/verify-full-audit.ts \"<manifest.json>\"");
        process.exit(1);
    }

    const manifest: Manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));

    console.log("================================================");
    console.log("Parseando archivos reales...");
    console.log("================================================");

    const initialInventory = await InventoryParser.parse(manifest.initialInventory);
    console.log(`Inventario Inicial: ${initialInventory.length} productos`);

    const finalInventory = await InventoryParser.parse(manifest.finalInventory);
    console.log(`Inventario Final:   ${finalInventory.length} productos`);

    const transit = await TransitParser.parse(manifest.transit);
    console.log(`Mercadería en Tránsito: ${transit.length} facturas`);

    const kardex: any[] = [];
    for (const kardexPath of manifest.kardex) {
        const products = await KardexParser.parse(kardexPath);
        console.log(`Kardex (${kardexPath.split(/[\\/]/).pop()}): ${products.length} productos`);
        kardex.push(...products);
    }
    console.log(`TOTAL bloques de Kardex (todos los meses): ${kardex.length}`);

    const auditData: AuditData = {
        year: manifest.year,
        initialInventory,
        finalInventory,
        transit,
        kardex
    };

    console.log("\n================================================");
    console.log("Corriendo las 14 reglas (RuleEngine.execute)...");
    console.log("================================================");

    const findings = RuleEngine.execute(auditData);

    const byRule = new Map<string, number>();
    for (const f of findings) {
        byRule.set(f.ruleId, (byRule.get(f.ruleId) ?? 0) + 1);
    }

    const failedRules = byRule.size;
    const passedRules = TOTAL_RULES - failedRules;
    const compliance = Number(((passedRules / TOTAL_RULES) * 100).toFixed(2));

    const riskSummary = computeRiskSummary(findings);
    const economicImpact = computeEconomicImpact(findings);

    const affectedProducts = new Set(
        findings.map(f => f.productCode).filter(Boolean)
    ).size;

    console.log("\n================================================");
    console.log("RESUMEN — comparar contra el dashboard del front");
    console.log("================================================");
    console.log(`Reglas Ejecutadas:   ${TOTAL_RULES}`);
    console.log(`Reglas Incumplidas:  ${failedRules}`);
    console.log(`Reglas Aprobadas:    ${passedRules}`);
    console.log(`Cumplimiento:        ${compliance}%`);
    console.log(`Productos Afectados: ${affectedProducts}`);
    console.log(`Impacto Económico:   S/. ${economicImpact.toLocaleString()}`);
    console.log(`Hallazgos (total):   ${findings.length}`);
    console.log(`  CRÍTICO: ${riskSummary.critical}`);
    console.log(`  ALTO:    ${riskSummary.high}`);
    console.log(`  MEDIO:   ${riskSummary.medium}`);
    if (riskSummary.unmapped > 0) {
        console.log(`  (sin mapear, ej. BAJO u otro): ${riskSummary.unmapped}`);
    }
    console.log(`  Suma categorías: ${riskSummary.critical + riskSummary.high + riskSummary.medium + riskSummary.unmapped}`);

    console.log("\n--- Reglas Incumplidas (detalle por regla) ---");
    for (const [ruleId, count] of [...byRule.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
        console.log(`${ruleId}: ${count}`);
    }

    // Volcar el detalle COMPLETO de cada hallazgo, agrupado por regla, para
    // poder comparar fila por fila contra el Excel exportado por el back
    // (Rule00XExporter.ts) sin tener que volver a correr todo de cero.
    const outDir = process.argv[3];
    if (outDir) {
        fs.mkdirSync(outDir, { recursive: true });
        const findingsByRule = new Map<string, Finding[]>();
        for (const f of findings) {
            if (!findingsByRule.has(f.ruleId)) {
                findingsByRule.set(f.ruleId, []);
            }
            findingsByRule.get(f.ruleId)!.push(f);
        }
        for (const [ruleId, ruleFindings] of findingsByRule) {
            const filePath = `${outDir}/${ruleId}.json`;
            fs.writeFileSync(filePath, JSON.stringify(ruleFindings, null, 2), "utf-8");
        }
        console.log(`\nDetalle completo de cada hallazgo volcado a: ${outDir}/RULE_XXX.json (uno por regla)`);
    }
}

main().catch(err => {
    console.error("ERROR:", err);
    process.exit(1);
});
