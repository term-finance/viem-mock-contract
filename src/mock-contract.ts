import { AbiFunction, AbiParametersToPrimitiveTypes } from "abitype";
import {
  encodeFunctionData,
  encodeFunctionResult,
  PublicClient,
  toFunctionSelector,
  WalletClient,
} from "viem";
import {
  abi,
  bytecode,
} from "../artifacts/contracts/Doppelganger.sol/Doppelganger.json";

// Matches viem.sh types for a call
export type MockReadCallExpectation<T extends AbiFunction> = {
  kind: "read";
  abi: T;
  inputs?: AbiParametersToPrimitiveTypes<T["inputs"]>;
  outputs: AbiParametersToPrimitiveTypes<T["outputs"]>;
};
export type MockWriteCallExpectation<T extends AbiFunction> = {
  kind: "write";
  abi: T;
  inputs?: AbiParametersToPrimitiveTypes<T["inputs"]>;
  outputs?: AbiParametersToPrimitiveTypes<T["outputs"]>;
};
export type MockRevertExpectation<T extends AbiFunction> = {
  kind: "revert";
  abi: T;
  inputs?: AbiParametersToPrimitiveTypes<T["inputs"]>;
  reason?: string;
};
export type MockCallExpectation<T extends AbiFunction> =
  | MockReadCallExpectation<T>
  | MockWriteCallExpectation<T>
  | MockRevertExpectation<T>;

export type MockContractController = {
  address: `0x${string}`;
  setup: <T extends AbiFunction>(
    ...calls: MockCallExpectation<T>[] // TODO: Infer types
  ) => Promise<void>;
};

export const calculateFnSigHash = (
  call:
    | MockRevertExpectation<AbiFunction>
    | MockReadCallExpectation<AbiFunction>
    | MockWriteCallExpectation<AbiFunction>,
) => {
  if (call.inputs === undefined || call.inputs === null) {
    return toFunctionSelector(call.abi);
  }
  return encodeFunctionData({
    abi: [call.abi],
    args: call.inputs,
    functionName: call.abi.name,
  });
};

export const deployMock = async (
  signer: WalletClient,
  reader: PublicClient,
) => {
  if (!signer.account) {
    throw new Error("Client must have an account set");
  }
  const deployTxHash = await signer.deployContract({
    abi,
    bytecode: bytecode as `0x${string}`,
    account: signer.account,
    chain: signer.chain,
  });
  const deployTxReceipt = await reader.waitForTransactionReceipt({
    hash: deployTxHash,
  });
  const address = deployTxReceipt.contractAddress;
  if (!address) {
    throw new Error("Contract did not deploy correctly");
  }
  let firstCall = true;
  const controller: MockContractController = {
    address,
    setup: async (...calls) => {
      if (!signer.account) {
        throw new Error("Client must have an account set");
      }
      for (const call of calls) {
        switch (call.kind) {
          case "read": {
            const fnSigHash = calculateFnSigHash(call);
            const fnAbi = call.abi as AbiFunction;
            const encodedOutputs = encodeFunctionResult({
              abi: [fnAbi],
              functionName: call.abi.name,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              result:
                fnAbi.outputs.length === 1 && !fnAbi.outputs[0].name
                  ? (call.outputs[0] as any)
                  : call.outputs,
            });
            // Use a mock function to return the expected return value
            if (firstCall) {
              await signer.writeContract({
                address,
                chain: signer.chain,
                account: signer.account,
                abi: abi,
                functionName: "__doppelganger__mockReturns",
                args: [fnSigHash, encodedOutputs],
              });
              firstCall = false;
            } else {
              await signer.writeContract({
                address,
                chain: signer.chain,
                account: signer.account,
                abi: abi,
                functionName: "__doppelganger__queueReturn",
                args: [fnSigHash, encodedOutputs],
              });
            }
            break;
          }
          case "write": {
            const fnSigHash = calculateFnSigHash(call);
            const fnAbi = call.abi as AbiFunction;
            const encodedOutputs = call.outputs
              ? encodeFunctionResult({
                  abi: [fnAbi],
                  functionName: call.abi.name,
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  result:
                    fnAbi.outputs.length === 1 && !fnAbi.outputs[0].name
                      ? (call.outputs[0] as any)
                      : call.outputs,
                })
              : "0x";
            // Use a mock function to return the expected return value
            if (firstCall) {
              await signer.writeContract({
                address,
                chain: signer.chain,
                account: signer.account,
                abi: abi,
                functionName: "__doppelganger__mockReturns",
                args: [fnSigHash, encodedOutputs],
              });
              firstCall = false;
            } else {
              await signer.writeContract({
                address,
                chain: signer.chain,
                account: signer.account,
                abi: abi,
                functionName: "__doppelganger__queueReturn",
                args: [fnSigHash, encodedOutputs],
              });
            }
            break;
          }
          case "revert": {
            const fnSigHash = calculateFnSigHash(call);
            if (firstCall) {
              await signer.writeContract({
                address,
                chain: signer.chain,
                account: signer.account,
                abi: abi,
                functionName: "__doppelganger__mockReverts",
                args: [fnSigHash, call.reason ?? ""],
              });
              firstCall = false;
            } else {
              await signer.writeContract({
                address,
                chain: signer.chain,
                account: signer.account,
                abi: abi,
                functionName: "__doppelganger__queueRevert",
                args: [fnSigHash, call.reason ?? ""],
              });
            }
            break;
          }
        }
      }
    },
  };

  return controller;
};
