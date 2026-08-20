/**
 * Local account service shared by the CLI and the MCP process.
 *
 * Public account metadata lives in `~/.sosis/accounts.json`; private `.p8`
 * values live in AES-GCM envelopes whose master key is in macOS Keychain.
 * Credential versions let each process cache a key in memory without
 * continuing to use it after another process rotates it.
 */

import type {
  Account,
  DataPayload,
  StoredAccount,
} from "../storage/accounts-file";
import {
  loadDataPayload,
  newCredentialVersion,
  savePayload,
} from "../storage/accounts-file";
import {
  ascCredentialStore,
  type CredentialStore,
} from "../storage/credential-store";

export interface AccountServiceDependencies {
  load(): Promise<DataPayload>;
  save(payload: DataPayload): Promise<void>;
  credentials: CredentialStore;
  createCredentialVersion(): string;
}

export interface AccountService {
  getAccounts(): Promise<StoredAccount[]>;
  getAccount(id: string): Promise<Account | null>;
  addAccount(account: Account): Promise<void>;
  removeAccount(id: string): Promise<void>;
  updateAccount(
    id: string,
    patch: Partial<Pick<Account, "label" | "issuerId" | "keyId" | "p8">>,
  ): Promise<StoredAccount | null>;
}

function withoutPrivateKey(account: Account): StoredAccount {
  const { p8: _privateKey, ...stored } = account;
  void _privateKey;
  return stored;
}

export function createAccountService(dependencies: AccountServiceDependencies): AccountService {
  const credentialCache = new Map<string, { version: string; privateKey: string }>();
  let mutationTail: Promise<void> = Promise.resolve();

  function mutate<T>(operation: () => Promise<T>): Promise<T> {
    const result = mutationTail.then(operation, operation);
    mutationTail = result.then(() => undefined, () => undefined);
    return result;
  }

  async function resolvePrivateKey(account: StoredAccount): Promise<string> {
    const cached = credentialCache.get(account.id);
    if (cached?.version === account.credentialVersion) return cached.privateKey;

    const privateKey = await dependencies.credentials.get(account.id);
    if (!privateKey) throw new Error(`CREDENTIAL_NOT_FOUND:${account.id}`);
    credentialCache.set(account.id, { version: account.credentialVersion, privateKey });
    return privateKey;
  }

  return {
    async getAccounts() {
      return (await dependencies.load()).accounts;
    },

    async getAccount(id) {
      const stored = (await dependencies.load()).accounts.find((account) => account.id === id);
      if (!stored) {
        credentialCache.delete(id);
        return null;
      }
      return { ...stored, p8: await resolvePrivateKey(stored) };
    },

    async addAccount(account) {
      await mutate(async () => {
        const current = await dependencies.load();
        if (current.accounts.some((candidate) => candidate.id === account.id)) {
          throw new Error("ACCOUNT_ALREADY_EXISTS");
        }

        await dependencies.credentials.set(account.id, account.p8);
        try {
          await dependencies.save({ accounts: [...current.accounts, withoutPrivateKey(account)] });
        } catch (error) {
          await dependencies.credentials.delete(account.id).catch(() => undefined);
          throw error;
        }
        credentialCache.set(account.id, {
          version: account.credentialVersion,
          privateKey: account.p8,
        });
      });
    },

    async removeAccount(id) {
      await mutate(async () => {
        const current = await dependencies.load();
        if (!current.accounts.some((account) => account.id === id)) {
          credentialCache.delete(id);
          return;
        }

        await dependencies.save({
          accounts: current.accounts.filter((account) => account.id !== id),
        });
        try {
          await dependencies.credentials.delete(id);
        } catch (error) {
          // Keep account metadata if Keychain refused deletion, so the user can
          // retry without leaving an invisible credential behind.
          await dependencies.save(current);
          throw error;
        }
        credentialCache.delete(id);
      });
    },

    async updateAccount(id, patch) {
      return await mutate(async () => {
        const current = await dependencies.load();
        const existing = current.accounts.find((account) => account.id === id);
        if (!existing) return null;

        const { p8: nextPrivateKey, ...metadataPatch } = patch;
        const updated: StoredAccount = {
          ...existing,
          ...metadataPatch,
          credentialVersion: nextPrivateKey
            ? dependencies.createCredentialVersion()
            : existing.credentialVersion,
        };

        let previousPrivateKey: string | null = null;
        if (nextPrivateKey) {
          previousPrivateKey = await dependencies.credentials.get(id);
          await dependencies.credentials.set(id, nextPrivateKey);
        }

        try {
          await dependencies.save({
            accounts: current.accounts.map((account) => account.id === id ? updated : account),
          });
        } catch (error) {
          if (nextPrivateKey) {
            if (previousPrivateKey) await dependencies.credentials.set(id, previousPrivateKey);
            else await dependencies.credentials.delete(id);
          }
          throw error;
        }

        if (nextPrivateKey) {
          credentialCache.set(id, {
            version: updated.credentialVersion,
            privateKey: nextPrivateKey,
          });
        }
        return updated;
      });
    },
  };
}

const service = createAccountService({
  load: () => loadDataPayload(),
  save: savePayload,
  credentials: ascCredentialStore,
  createCredentialVersion: newCredentialVersion,
});

export const getAccounts = service.getAccounts;
export const getAccount = service.getAccount;
export const addAccount = service.addAccount;
export const removeAccount = service.removeAccount;
export const updateAccount = service.updateAccount;
