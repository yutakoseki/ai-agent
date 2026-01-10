import { createTenantClient } from "../tenant-client-factory";
import { getTableName } from "../table";

export const tasksTable = createTenantClient({
  tableName: getTableName("tasks"),
});

export const {
  getItem,
  putItem,
  queryByPrefix,
  queryByPrefixPage,
  queryGSI1,
  queryGSI1Page,
  queryGSI2,
  updateItem,
  deleteItem,
  transactWrite,
  indexes,
} = tasksTable;


