import { createTenantClient } from "../tenant-client-factory";
import { getTableName } from "../table";

export const pushSubscriptionsTable = createTenantClient({
  tableName: getTableName("push_subscriptions"),
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
} = pushSubscriptionsTable;


