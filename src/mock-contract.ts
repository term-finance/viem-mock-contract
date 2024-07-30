import { Abi, AbiFunction, AbiParametersToPrimitiveTypes } from "abitype";
import { encodeFunctionData, encodeFunctionResult } from "viem";
import hre from "hardhat";
import { GetContractReturnType } from "@nomicfoundation/hardhat-viem/types";

// Matches viem.sh types for a call
export type MockReadCallExpectation<T extends AbiFunction> = {
  kind: "read";
  abi: T;
  inputs: AbiParametersToPrimitiveTypes<T["inputs"]>;
  outputs: AbiParametersToPrimitiveTypes<T["outputs"]>;
};
export type MockRevertExpectation<T extends AbiFunction> = {
  kind: "revert";
  abi: T;
  inputs: AbiParametersToPrimitiveTypes<T["inputs"]>;
  reason?: string;
};
export type MockCallExpectation<T extends AbiFunction> =
  | MockReadCallExpectation<T>
  | MockRevertExpectation<T>;

export const deployMock = async <A extends Abi>() => {
  const mock = await hre.viem.deployContract("Doppelganger");
  const mockContract = mock as typeof mock & {
    setup: <T extends Abi>(
      ...calls: MockCallExpectation<AbiFunction>[] // TODO: Infer types
    ) => Promise<void>;
  };
  let firstCall = true;
  mockContract.setup = async (...calls) => {
    for (const call of calls) {
      switch (call.kind) {
        case "read": {
          const fnSigHash = encodeFunctionData({
            abi: [call.abi as AbiFunction],
            args: call.inputs,
            functionName: call.abi.name,
          });
          const encodedOutputs = encodeFunctionResult({
            abi: [call.abi as AbiFunction],
            functionName: call.abi.name,
            result: call.outputs,
          });
          // Use a mock function to return the expected return value
          if (firstCall) {
            await mockContract.write.__doppelganger__mockReturns([
              fnSigHash,
              encodedOutputs,
            ]);
            firstCall = false;
          } else {
            await mockContract.write.__doppelganger__queueReturn([
              fnSigHash,
              encodedOutputs,
            ]);
          }
          break;
        }
        case "revert": {
          const fnSigHash = encodeFunctionData({
            abi: [call.abi as AbiFunction],
            args: call.inputs,
            functionName: call.abi.name,
          });
          if (firstCall) {
            await mockContract.write.__doppelganger__mockReverts([
              fnSigHash,
              call.reason || "",
            ]);
            firstCall = false;
          } else {
            await mockContract.write.__doppelganger__queueRevert([
              fnSigHash,
              call.reason || "",
            ]);
          }
          break;
        }
      }
    }
  };

  return mockContract as any as GetContractReturnType<A> & {
    setup: typeof mockContract.setup;
  };
};
