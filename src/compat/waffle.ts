/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  Abi,
  AbiFunction,
  AbiParametersToPrimitiveTypes,
  ExtractAbiFunctionNames,
  formatAbiItem,
} from "abitype";
import {
  deployMock,
  MockCallExpectation,
  MockContractController,
} from "../mock-contract.js";
import { PublicClient, WalletClient } from "viem";

export const doppelgangerAbi = [
  {
    stateMutability: "payable",
    type: "fallback",
  },
  {
    inputs: [
      {
        internalType: "bytes",
        name: "data",
        type: "bytes",
      },
      {
        internalType: "bytes",
        name: "value",
        type: "bytes",
      },
    ],
    name: "__doppelganger__mockReturns",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "bytes",
        name: "data",
        type: "bytes",
      },
      {
        internalType: "string",
        name: "reason",
        type: "string",
      },
    ],
    name: "__doppelganger__mockReverts",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "bytes",
        name: "data",
        type: "bytes",
      },
      {
        internalType: "bytes",
        name: "value",
        type: "bytes",
      },
    ],
    name: "__doppelganger__queueReturn",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "bytes",
        name: "data",
        type: "bytes",
      },
      {
        internalType: "string",
        name: "reason",
        type: "string",
      },
    ],
    name: "__doppelganger__queueRevert",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "string",
        name: "reason",
        type: "string",
      },
    ],
    name: "__doppelganger__receiveReverts",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    stateMutability: "payable",
    type: "receive",
  },
] as const;

interface StubInterface extends Pick<Promise<void>, "then"> {
  returns(...args: any): StubInterface;
  reverts(): StubInterface;
  revertsWithReason(reason: string): StubInterface;
  withArgs(...args: any[]): StubInterface;
}

export interface MockContract<T extends Abi> {
  mock: {
    [key in ExtractAbiFunctionNames<T> | "receive"]: StubInterface;
  };
  address: `0x${string}`;
}

class Stub<T extends AbiFunction> implements StubInterface {
  calls: MockCallExpectation<T>[] = [];
  inputs: AbiParametersToPrimitiveTypes<T["inputs"]> | undefined = undefined;

  revertSet = false;
  argsSet = false;

  constructor(
    private readonly mockContract: MockContractController,
    private readonly func: T,
  ) {}

  private err(reason: string): never {
    this.revertSet = false;
    this.argsSet = false;
    throw new Error(reason);
  }

  returns(...args: AbiParametersToPrimitiveTypes<T["outputs"]>) {
    if (this.revertSet) this.err("Revert must be the last call");
    if (!this.func.outputs)
      this.err("Cannot mock return values from a void function");

    if (
      this.func.stateMutability === "pure" ||
      this.func.stateMutability === "view"
    ) {
      this.calls.push({
        kind: "read",
        abi: this.func,
        inputs: this.inputs,
        outputs: args,
      });
    } else {
      this.calls.push({
        kind: "write",
        abi: this.func,
        inputs: this.inputs,
        outputs: args.length === 0 ? undefined : args,
      });
    }

    return this;
  }

  reverts() {
    if (this.revertSet) this.err("Revert must be the last call");

    this.calls.push({
      kind: "revert",
      abi: this.func,
      inputs: this.inputs,
      reason: "Mock revert",
    });

    this.revertSet = true;
    return this;
  }

  revertsWithReason(reason: string) {
    if (this.revertSet) this.err("Revert must be the last call");

    this.calls.push({
      kind: "revert",
      abi: this.func,
      inputs: this.inputs,
      reason,
    });

    this.revertSet = true;
    return this;
  }

  withArgs(...params: AbiParametersToPrimitiveTypes<T["inputs"]>) {
    if (this.argsSet) this.err("withArgs can be called only once");
    this.inputs = params;
    this.argsSet = true;
    return this;
  }

  async then<TResult1 = void, TResult2 = never>(
    resolve?:
      | ((value: void) => TResult1 | PromiseLike<TResult1>)
      | null
      | undefined,
    reject?:
      | ((reason: any) => TResult2 | PromiseLike<TResult2>)
      | null
      | undefined,
  ): Promise<TResult1 | TResult2> {
    if (this.argsSet) {
      this.calls.push({
        kind: "write",
        abi: this.func,
        inputs: this.inputs,
      });
    }

    try {
      await this.mockContract.setup(...this.calls);
    } catch (e) {
      this.argsSet = false;
      this.revertSet = false;
      reject?.(e);
      return undefined as never;
    }
    this.argsSet = false;
    this.revertSet = false;
    resolve?.();
    return undefined as never;
  }
}

function createMock<T extends Abi>(
  abi: T,
  mockContractInstance: MockContractController,
  // wallet: WalletClient,
): MockContract<T>["mock"] {
  const functions = abi.filter((f) => f.type === "function");
  const mockedAbi = Object.values(functions).reduce(
    (acc, func) => {
      const stubbed = new Stub(mockContractInstance, func);
      return {
        ...acc,
        [func.name]: stubbed,
        [formatAbiItem(func)]: stubbed,
      };
    },
    {} as MockContract<T>["mock"],
  );

  // (mockedAbi as any).receive = {
  //   returns: () => {
  //     throw new Error("Receive function return is not implemented.");
  //   },
  //   withArgs: () => {
  //     throw new Error("Receive function return is not implemented.");
  //   },
  //   reverts: () => wallet.writeContract({
  //     address: mockContractInstance.address,
  //     abi: doppelgangerAbi,
  //     functionName: "__doppelganger__receiveReverts",
  //     account: wallet.account!,
  //     chain: wallet.chain,
  //     args: ["Mock Revert"],
  //   }),
  //   revertsWithReason: (reason: string) => wallet.writeContract({
  //     address: mockContractInstance.address,
  //     abi: doppelgangerAbi,
  //     functionName: "__doppelganger__receiveReverts",
  //     account: wallet.account!,
  //     chain: wallet.chain,
  //     args: [reason],
  //   }),
  // };

  return mockedAbi;
}

export async function deployMockContract<T extends Abi>(
  wallet: WalletClient,
  reader: PublicClient,
  abi: T,
): Promise<MockContract<T>> {
  const mockContractInstance = await deployMock(wallet, reader);

  const mock = createMock<T>(
    abi,
    mockContractInstance as unknown as MockContractController,
    // wallet,
  );

  return {
    mock,
    address: mockContractInstance.address,
  };
}
