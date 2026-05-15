import {
  initAuthCreds,
  BufferJSON,
  type AuthenticationCreds,
  type AuthenticationState,
  type SignalDataTypeMap,
} from "ourin-baileys";
import mongoose from "mongoose";
import { WhatsAppCreds } from "../models/WhatsAppCreds.js";
import { WhatsAppKey } from "../models/WhatsAppKey.js";

type KeyType = keyof SignalDataTypeMap;

export async function useMongoAuthState(rawBotId: string): Promise<{
  state: AuthenticationState;
  saveCreds: () => Promise<void>;
}> {
  const botId = new mongoose.Types.ObjectId(rawBotId);

  // ── Load or initialise credentials ──────────────────────────────────────────
  const credsDoc = await WhatsAppCreds.findOne({ botId });
  const creds: AuthenticationCreds = credsDoc
    ? (JSON.parse(JSON.stringify(credsDoc.creds), BufferJSON.reviver) as AuthenticationCreds)
    : initAuthCreds();

  // ── Persist credentials back to MongoDB ─────────────────────────────────────
  async function saveCreds(): Promise<void> {
    const serialised = JSON.parse(JSON.stringify(creds, BufferJSON.replacer));
    await WhatsAppCreds.findOneAndUpdate(
      { botId },
      { $set: { creds: serialised } },
      { upsert: true, new: true },
    );
  }

  // ── Signal key store backed by MongoDB ──────────────────────────────────────
  const keys = {
    async get<T extends KeyType>(
      type: T,
      ids: string[],
    ): Promise<{ [id: string]: SignalDataTypeMap[T] }> {
      const docs = await WhatsAppKey.find({ botId, type, keyId: { $in: ids } });
      const result: { [id: string]: SignalDataTypeMap[T] } = {};
      for (const doc of docs) {
        result[doc.keyId] = JSON.parse(
          JSON.stringify(doc.data),
          BufferJSON.reviver,
        ) as SignalDataTypeMap[T];
      }
      return result;
    },

    async set(data: { [T in KeyType]?: { [id: string]: SignalDataTypeMap[T] | null | undefined } }): Promise<void> {
      const ops: mongoose.mongo.AnyBulkWriteOperation<InstanceType<typeof WhatsAppKey>>[] = [];

      for (const [type, entries] of Object.entries(data)) {
        if (!entries) continue;
        for (const [keyId, value] of Object.entries(entries)) {
          if (value == null) {
            ops.push({ deleteOne: { filter: { botId, type, keyId } } });
          } else {
            const serialised = JSON.parse(JSON.stringify(value, BufferJSON.replacer));
            ops.push({
              updateOne: {
                filter: { botId, type, keyId },
                update: { $set: { data: serialised } },
                upsert: true,
              },
            });
          }
        }
      }

      if (ops.length > 0) {
        await WhatsAppKey.bulkWrite(ops, { ordered: false });
      }
    },
  };

  return {
    state: { creds, keys },
    saveCreds,
  };
}

// ── Cleanup: remove all session data for a bot ───────────────────────────────
export async function deleteMongoAuthState(rawBotId: string): Promise<void> {
  const botId = new mongoose.Types.ObjectId(rawBotId);
  await Promise.all([
    WhatsAppCreds.deleteOne({ botId }),
    WhatsAppKey.deleteMany({ botId }),
  ]);
}
