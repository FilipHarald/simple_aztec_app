import { getInitialTestAccountsWallets } from "@aztec/accounts/testing";
import {
  ExtendedNote,
  Fr,
  Note,
  computeSecretHash,
  createPXEClient,
} from "@aztec/aztec.js";
import { fileURLToPath } from "@aztec/foundation/url";

import { getToken } from "./contracts.mjs";

const { PXE_URL = "http://localhost:8080" } = process.env;

async function showAccounts(pxe) {
  const accounts = await pxe.getRegisteredAccounts();
  console.log(`User accounts:\n${accounts.map((a) => a.address).join("\n")}`);
}

async function showPrivateBalances(pxe) {
  const accounts = await pxe.getRegisteredAccounts();
  const token = await getToken(pxe);

  for (const account of accounts) {
    const balance = await token.methods
      .balance_of_private(account.address)
      .simulate();
    console.log(`Balance of ${account.address}: ${balance}`);
  }
}

// function logTokenArtifact(art) {
//   console.log(`Token artifact: ${JSON.stringify(art.notes, null, 2)}`);
// }

async function mintPrivateFunds(pxe) {
  console.log("Minting private funds");
  const [owner] = await getInitialTestAccountsWallets(pxe);
  console.log(`Owner address: ${owner.getAddress()}`);
  const token = await getToken(owner);
  console.log(`Token address: ${token.address}`);

  await showPrivateBalances(pxe);

  const mintAmount = 20n;
  const secret = Fr.random();
  console.log(`Minting ${mintAmount} with secret ${secret}`);
  const secretHash = await computeSecretHash(secret);
  console.log(`Secret hash: ${secretHash}`);

  //logTokenArtifact(token.artifact);
  const receipt = await token.methods
    .mint_private(mintAmount, secretHash)
    .send()
    .wait();
  console.log(`Receipt: ${JSON.stringify(receipt, null, 2)}`);

  const storageSlot = token.artifact.storageLayout["pending_shields"].slot;
  const noteTypeId = token.artifact.notes["TransparentNote"].id;
  //logTokenArtifact(token.artifact);

  //console.log(`Creating extended note with storage slot ${storageSlot} and note type ID ${noteTypeId}`);

  const note = new Note([new Fr(mintAmount), secretHash]);
  const extendedNote = new ExtendedNote(
    note,
    owner.getAddress(),
    token.address,
    storageSlot,
    noteTypeId,
    receipt.txHash
  );
  console.log(`Adding note: ${extendedNote}`);
  await pxe.addNote(extendedNote);

  console.log(`Redeeming shield`);
  await token.methods
    .redeem_shield(owner.getAddress(), mintAmount, secret)
    .send()
    .wait();

  await showPrivateBalances(pxe);
}

async function transferPrivateFunds(pxe) {
  const [owner, recipient] = await getInitialTestAccountsWallets(pxe);
  const token = await getToken(owner);

  const tx = token.methods
    .transfer(owner.getAddress(), recipient.getAddress(), 1n, 0)
    .send();
  console.log(`Sent transfer transaction ${await tx.getTxHash()}`);
  await showPrivateBalances(pxe);

  console.log(`Awaiting transaction to be mined`);
  const receipt = await tx.wait();
  console.log(`Transaction has been mined on block ${receipt.blockNumber}`);
  await showPrivateBalances(pxe);
}

async function showPublicBalances(pxe) {
  const accounts = await pxe.getRegisteredAccounts();
  const token = await getToken(pxe);

  for (const account of accounts) {
    // highlight-next-line:showPublicBalances
    const balance = await token.methods
      .balance_of_public(account.address)
      .simulate();
    console.log(`Balance of ${account.address}: ${balance}`);
  }
}

async function mintPublicFunds(pxe) {
  const [owner] = await getInitialTestAccountsWallets(pxe);
  const token = await getToken(owner);

  const tx = token.methods.mint_public(owner.getAddress(), 100n).send();
  console.log(`Sent mint transaction ${await tx.getTxHash()}`);
  await showPublicBalances(pxe);

  console.log(`Awaiting transaction to be mined`);
  const receipt = await tx.wait();
  console.log(`Transaction has been mined on block ${receipt.blockNumber}`);
  await showPublicBalances(pxe);

  const blockNumber = await pxe.getBlockNumber();
  const logs = (await pxe.getUnencryptedLogs(blockNumber, 1)).logs;
  const textLogs = logs.map((extendedLog) =>
    extendedLog.toHumanReadable().slice(0, 200)
  );
  for (const log of textLogs) console.log(`Log emitted: ${log}`);
}

async function main() {
  const pxe = createPXEClient(PXE_URL);
  const info = await pxe.getNodeInfo();
  console.log(`Connected to chain ${info.l1ChainId}`);

  console.log("⚽️SHOW ACCOUNTS");
  await showAccounts(pxe);

  console.log("⚽️SHOW PRIVATE BALANCES");
  await mintPrivateFunds(pxe);

  console.log("⚽️TRANSFER PRIVATE FUNDS");
  await transferPrivateFunds(pxe);

  console.log("⚽️SHOW PUBLIC BALANCES");
  await mintPublicFunds(pxe);
}

// Execute main only if run directly
if (
  process.argv[1].replace(/\/index\.m?js$/, "") ===
  fileURLToPath(import.meta.url).replace(/\/index\.m?js$/, "")
) {
  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  main()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(`Error in app: ${err}`);
      process.exit(1);
    });
}

export { main };
