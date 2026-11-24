// Test stand-in for firebase-admin/auth: the tests hand the portal their own fake auth object.
export const getAuth = () => ({ tenantManager: () => ({ authForTenant: () => ({}) }) });
