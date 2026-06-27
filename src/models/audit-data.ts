import { InventoryItem } from "./inventory-item";
import { TransitItem } from "./transit-item";
import { KardexProduct } from "./kardex-product";

export interface AuditData {
    initialInventory: InventoryItem[];
    finalInventory: InventoryItem[];
    transit: TransitItem[];
    kardex: KardexProduct[];
}