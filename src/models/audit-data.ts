import { InventoryItem } from "./inventory-item";
import { TransitItem } from "./transit-item";
import { KardexProduct } from "./kardex-product";

export interface AuditData {
    /**
     * Año fiscal auditado (audit_jobs.year). Opcional por compatibilidad
     * con datos viejos que no lo tenían — pero cualquier regla que
     * compare fechas de un documento contra un mes del ejercicio (ej.
     * RULE_004, mercadería en tránsito) lo necesita para no comparar
     * fechas de años distintos entre sí.
     */
    year?: number;
    initialInventory: InventoryItem[];
    finalInventory: InventoryItem[];
    transit: TransitItem[];
    kardex: KardexProduct[];
}