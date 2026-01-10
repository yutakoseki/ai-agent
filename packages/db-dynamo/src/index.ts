export * from "./client";
export * from "./table";
export * from "./types";
export * from "./tenant-client";
export * from "./tenant-client-factory";

// multi-table clients (Repo 側はここから import してテーブルを明示する)
export * as tenantsDb from "./tables/tenants";
export * as usersDb from "./tables/users";
export * as emailAccountsDb from "./tables/email-accounts";
export * as emailMessagesDb from "./tables/email-messages";
export * as tasksDb from "./tables/tasks";
export * as userEmailSubscriptionsDb from "./tables/user-email-subscriptions";
export * as pushSubscriptionsDb from "./tables/push-subscriptions";
export * as userPreferencesDb from "./tables/user-preferences";
export * as permissionPoliciesDb from "./tables/permission-policies";
export * as tenantApplicationsDb from "./tables/tenant-applications";
export * as announcementsDb from "./tables/announcements";




