export interface KardexMovement {
    date: Date | null;
    document: string;
    operation: string;
    entryQuantity: number;
    entryUnitCost: number;
    entryTotalCost: number;
    exitQuantity: number;
    exitUnitCost: number;
    exitTotalCost: number;
    balanceQuantity: number;
    balanceUnitCost: number;
    balanceTotalCost: number;
    month: number | null;
}