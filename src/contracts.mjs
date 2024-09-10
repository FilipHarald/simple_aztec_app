import { AztecAddress, Contract, loadContractArtifact } from '@aztec/aztec.js';
import TokenContractJson from "../contracts/token/target/token-Token.json" assert { type: "json" };

import { readFileSync } from 'fs';

export async function getToken(client) {
  const addresses = JSON.parse(readFileSync('addresses.json'));
  return Contract.at(AztecAddress.fromString(addresses.token), loadContractArtifact(TokenContractJson), client);
}
