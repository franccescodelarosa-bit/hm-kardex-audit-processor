import type { KardexMovement } from "../models/kardex-movement";
import type { KardexProduct } from "../models/kardex-product";
import type { InventoryItem } from "../models/inventory-item";
import type { TransitItem } from "../models/transit-item";
import type { AuditData } from "../models/audit-data";

export function movement(overrides: Partial<KardexMovement>): KardexMovement {
    return {
        date: null,
        document: "",
        operation: "",
        entryQuantity: 0,
        entryUnitCost: 0,
        entryTotalCost: 0,
        exitQuantity: 0,
        exitUnitCost: 0,
        exitTotalCost: 0,
        balanceQuantity: 0,
        balanceUnitCost: 0,
        balanceTotalCost: 0,
        month: 1,
        ...overrides
    };
}

/** TipoOp 16 = Saldo Inicial. */
export function saldoInicial(qty: number, unitCost: number, month = 1): KardexMovement {
    return movement({
        operation: "16",
        document: "00 Saldo Inicial",
        balanceQuantity: qty,
        balanceUnitCost: unitCost,
        balanceTotalCost: Number((qty * unitCost).toFixed(2)),
        month
    });
}

export function entrada(
    qty: number,
    unitCost: number,
    balanceQty: number,
    balanceUnitCost: number,
    month = 1
): KardexMovement {
    return movement({
        operation: "02",
        entryQuantity: qty,
        entryUnitCost: unitCost,
        entryTotalCost: Number((qty * unitCost).toFixed(2)),
        balanceQuantity: balanceQty,
        balanceUnitCost: balanceUnitCost,
        balanceTotalCost: Number((balanceQty * balanceUnitCost).toFixed(2)),
        month
    });
}

export function salida(
    qty: number,
    unitCost: number,
    balanceQty: number,
    balanceUnitCost: number,
    month = 1
): KardexMovement {
    return movement({
        operation: "01",
        exitQuantity: qty,
        exitUnitCost: unitCost,
        exitTotalCost: Number((qty * unitCost).toFixed(2)),
        balanceQuantity: balanceQty,
        balanceUnitCost: balanceUnitCost,
        balanceTotalCost: Number((balanceQty * balanceUnitCost).toFixed(2)),
        month
    });
}

export function kardexProduct(code: string, description: string, movements: KardexMovement[]): KardexProduct {
    return { code, description, unit: "Und", movements };
}

export function inventoryItem(code: string, product: string, stock: number, unitCost: number): InventoryItem {
    return {
        item: 1,
        family: "GENERICO",
        code,
        product,
        unit: "Und",
        stock,
        unitCost,
        totalCost: Number((stock * unitCost).toFixed(2))
    };
}

export function transitItem(overrides: Partial<TransitItem>): TransitItem {
    return {
        item: 1,
        issueDate: new Date(2024, 11, 1),
        warehouseDate: new Date(2024, 11, 15),
        document: "",
        acquiredCodes: "",
        supplierRuc: "",
        supplier: "",
        subtotal: 0,
        igv: 0,
        freight: 0,
        otherCosts: 0,
        expectedCost: 0,
        ...overrides
    };
}

export function auditData(overrides: Partial<AuditData>): AuditData {
    return {
        year: 2024,
        initialInventory: [],
        finalInventory: [],
        transit: [],
        kardex: [],
        ...overrides
    };
}
