import { Configuration, PlaidApi, PlaidEnvironments, Products, CountryCode } from "plaid";
import { env } from "../../config/env";

/**
 * Cliente Plaid — SOLO LECTURA.
 *
 * Este módulo es el único punto de contacto con Plaid en todo el backend.
 * Deliberadamente NO expone ni implementa:
 *   - /transfer/*            (originación de transferencias)
 *   - /payment_initiation/*  (pagos)
 *   - cualquier producto de escritura de dinero
 *
 * Si en el futuro se necesita agregar un producto Plaid, debe pasar por
 * `env.plaid.products`, que valida contra una allowlist de solo-lectura
 * en src/config/env.ts. No se debe llamar a PlaidApi con métodos fuera de
 * los expuestos aquí.
 */

const configuration = new Configuration({
  basePath: PlaidEnvironments[env.plaid.env as keyof typeof PlaidEnvironments] ?? PlaidEnvironments.sandbox,
  baseOptions: {
    headers: {
      "PLAID-CLIENT-ID": env.plaid.clientId,
      "PLAID-SECRET": env.plaid.secret,
    },
  },
});

const plaidApi = new PlaidApi(configuration);

export const plaidProducts = env.plaid.products as Products[];
export const plaidCountryCodes = env.plaid.countryCodes as CountryCode[];

/** Crea un link_token para que el dueño conecte TD Bank vía Plaid Link. */
export async function createLinkToken(userId: string) {
  const response = await plaidApi.linkTokenCreate({
    user: { client_user_id: userId },
    client_name: "CFO Virtual - Pachos Supermarket",
    products: plaidProducts,
    country_codes: plaidCountryCodes,
    language: "es",
  });
  return response.data;
}

/** Intercambia el public_token (de un solo uso) por un access_token permanente. */
export async function exchangePublicToken(publicToken: string) {
  const response = await plaidApi.itemPublicTokenExchange({ public_token: publicToken });
  return response.data; // { access_token, item_id }
}

/** Solo lectura: saldo actual de las cuentas conectadas. */
export async function getAccountsBalance(accessToken: string) {
  const response = await plaidApi.accountsBalanceGet({ access_token: accessToken });
  return response.data.accounts;
}

/** Solo lectura: sincronización incremental de transacciones. */
export async function syncTransactions(accessToken: string, cursor?: string) {
  const response = await plaidApi.transactionsSync({
    access_token: accessToken,
    cursor,
  });
  return response.data; // { added, modified, removed, next_cursor, has_more }
}

/** Revoca el acceso de Plaid a la cuenta (desconectar el banco). Solo lectura → solo revoca, no mueve nada. */
export async function removeItem(accessToken: string) {
  await plaidApi.itemRemove({ access_token: accessToken });
}
