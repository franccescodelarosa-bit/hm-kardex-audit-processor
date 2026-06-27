export interface KardexMovement {
    date: Date;
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
}