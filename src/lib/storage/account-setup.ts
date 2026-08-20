import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  addAccount,
  getAccounts,
  removeAccount,
} from "../server/session";
import {
  ensureValidP8,
  newAccountId,
  newCredentialVersion,
  publicView,
  type Account,
  type PublicAccount,
} from "./accounts-file";

const LABEL_MAX = 80;
const KEY_ID = /^[A-Z0-9]{8,}$/i;
const ISSUER_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class AccountSetupError extends Error {
  constructor(code: string, message: string) {
    super(`${code}: ${message}`);
    this.name = "AccountSetupError";
    this.code = code;
  }
  readonly code: string;
}

export function validateAccountMetadata(input: {
  label: string;
  issuerId: string;
  keyId: string;
}): { label: string; issuerId: string; keyId: string } {
  const label = input.label.trim();
  if (label.length < 1 || label.length > LABEL_MAX) {
    throw new AccountSetupError("INVALID_LABEL", "Account label must be 1-80 characters.");
  }
  const issuerId = input.issuerId.trim();
  if (!ISSUER_ID.test(issuerId)) {
    throw new AccountSetupError("INVALID_ISSUER_ID", "Issuer ID must be a UUID from App Store Connect.");
  }
  const keyId = input.keyId.trim().toUpperCase();
  if (!KEY_ID.test(keyId)) {
    throw new AccountSetupError("INVALID_KEY_ID", "Key ID must be at least 8 alphanumeric characters.");
  }
  return { label, issuerId, keyId };
}

export async function readP8File(p8Path: string): Promise<string> {
  const absolute = resolve(p8Path);
  let contents: string;
  try {
    contents = await readFile(absolute, "utf8");
  } catch (error) {
    throw new AccountSetupError(
      "P8_READ_FAILED",
      `Could not read .p8 file at ${absolute}: ${(error as Error).message}`,
    );
  }
  try {
    ensureValidP8(contents);
  } catch {
    throw new AccountSetupError(
      "INVALID_P8",
      "The file is not a valid App Store Connect .p8 private key.",
    );
  }
  return contents.trim();
}

export async function addAccountFromP8File(input: {
  label: string;
  issuerId: string;
  keyId: string;
  p8Path: string;
}): Promise<PublicAccount> {
  const metadata = validateAccountMetadata(input);
  const p8 = await readP8File(input.p8Path);
  const account: Account = {
    id: newAccountId(),
    ...metadata,
    p8,
    createdAt: Date.now(),
    credentialVersion: newCredentialVersion(),
  };
  await addAccount(account);
  return publicView(account);
}

export async function removeAccountById(accountId: string): Promise<PublicAccount> {
  const id = accountId.trim();
  if (!id) throw new AccountSetupError("INVALID_ACCOUNT_ID", "Account ID is required.");
  const accounts = await getAccounts();
  const match = accounts.find((account) => account.id === id);
  if (!match) throw new AccountSetupError("ACCOUNT_NOT_FOUND", `No local account with id ${id}.`);
  await removeAccount(match.id);
  return publicView(match);
}
