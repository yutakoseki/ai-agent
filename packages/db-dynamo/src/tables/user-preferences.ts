import { createTenantClient } from "../tenant-client-factory";
import { getTableName } from "../table";

export const userPreferencesTable = createTenantClient({
  tableName: getTableName("user_preferences"),
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
} = userPreferencesTable;


