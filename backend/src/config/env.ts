import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

// Productos Plaid permitidos. Cualquier producto de escritura (transfer,
// payment_initiation) queda fuera de esta lista por diseño — ver docs/SECURITY.md.
const ALLOWED_PLAID_PRODUCTS = new Set(["transactions", "auth", "balance", "identity"]);

function parsePlaidProducts(raw: string): string[] {
  const products = raw.split(",").map((p) => p.trim()).filter(Boolean);
  for (const product of products) {
    if (!ALLOWED_PLAID_PRODUCTS.has(product)) {
      throw new Error(
        `Plaid product "${product}" is not allowed. This system is read-only. ` +
          `Allowed products: ${[...ALLOWED_PLAID_PRODUCTS].join(", ")}`
      );
    }
  }
  return products;
}

export const env = {
  port: Number(process.env.PORT ?? 4000),
  corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:5173",
  databaseUrl: required("DATABASE_URL"),
  jwt: {
    accessSecret: required("JWT_ACCESS_SECRET"),
    refreshSecret: required("JWT_REFRESH_SECRET"),
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? "15m",
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? "7d",
  },
  tokenEncryptionKey: required("TOKEN_ENCRYPTION_KEY"),
  plaid: {
    clientId: process.env.PLAID_CLIENT_ID ?? "",
    secret: process.env.PLAID_SECRET ?? "",
    env: process.env.PLAID_ENV ?? "sandbox",
    products: parsePlaidProducts(process.env.PLAID_PRODUCTS ?? "transactions,auth"),
    countryCodes: (process.env.PLAID_COUNTRY_CODES ?? "US").split(","),
  },
};
