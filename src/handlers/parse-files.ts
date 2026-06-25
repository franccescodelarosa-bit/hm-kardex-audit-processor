import { InventoryParser } from "../parsers/inventory.parser";
export const handler = async (event: any) => {
    console.log("PARSE FILES");
    console.log(JSON.stringify(event, null, 2));
    return event;
};