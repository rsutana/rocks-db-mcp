import { executeRead } from "./execute_read.js";
import { executeWrite } from "./execute_write.js";
import { listTables } from "./list_tables.js";
import { describeTable } from "./describe_table.js";
export const tools = [
    executeRead,
    executeWrite,
    listTables,
    describeTable
];
export function registerAllTools(server) {
    for (const tool of tools) {
        server.registerTool(tool.name, tool.definition, tool.handler);
    }
}
